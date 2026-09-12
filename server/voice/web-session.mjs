// One WebVoiceSession per visitor talking to the website.
//
// It sits between two WebSockets and owns everything in between:
//
//   browser  <--(PCM16 16k up / PCM16 24k down)-->  us  <-->  Gemini Live API
//
// The browser never sees the Google API key and never calls Google directly.
// That is not incidental: the tools the model calls read the client's playbook,
// write lead rows and send WhatsApp messages, all of which must run on the
// server against the service-role key. Relaying costs a few milliseconds and
// buys the entire tool surface.
//
// One tracer run per *conversation*, not per turn. A realtime session has no
// clean turn boundary worth a row of its own, and a visitor watching the
// /live graph wants to see one session fill in, not forty.

import { randomUUID } from "node:crypto";
import { GeminiLiveSession, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "./gemini-live.mjs";
import { mulawToPcm16 } from "./audio.mjs";
import { buildToolSpecs } from "../agent/tools.mjs";
import { buildWebToolSpecs } from "../agent/web-tools.mjs";
import { currentOffer, systemString, activePlaybook, playbookFitsInline } from "../agent/prompt.mjs";
import { startRun } from "../agent/trace.mjs";
import { liveModel } from "../agent/models.mjs";
import { insertMessage, touchConversation } from "../db.mjs";

const env = (k, d) => process.env[k] ?? d;

/** Hard ceiling on one session. Anonymous visitors spend real money per second. */
const MAX_SESSION_MS = Number(env("WEB_VOICE_MAX_SESSION_MS", 5 * 60 * 1000));
/** Nobody has said anything for this long — close rather than bill an empty room. */
const IDLE_MS = Number(env("WEB_VOICE_IDLE_MS", 45_000));
/** Refuse audio frames larger than this; a well-behaved client sends ~1-4 kB. */
const MAX_FRAME_BYTES = 64 * 1024;

export const WEB_STREAM_PATH = "/api/voice/web";

/**
 * Live sessions by run id. The WhatsApp handoff form posts the run id it was
 * shown with, and the server needs to find the session it belongs to: to give
 * it the visitor's number (so the transcript lands on the right thread) and
 * to tell the model the form was filled in. Sessions remove themselves on end.
 */
export const sessionsByRun = new Map();

/**
 * What the opening screen lets a visitor tap, and what the model is told when
 * they do. The panel sends the key; the text here is the whole briefing, so
 * a new track is one line in this table plus one chip in the panel.
 */
export const INTENTS = {
  audit:
    "They tapped 'What could you automate for me?'. Run the quick audit: ask what kind of " +
    "business it is, then how leads reach them, then what eats the most time - one question " +
    "per turn, each with offer_choices. Then give the three things you would automate first, " +
    "open the matching page with navigate_site, and offer to send the plan to their WhatsApp.",
  pricing:
    "They tapped 'Pricing'. Ask which service they are looking at, with offer_choices. Quote " +
    "only what the playbook says; if it depends on volume, ask the volume with offer_choices. " +
    "Offer to send the exact figure to their WhatsApp in writing.",
  voice:
    "They tapped 'Voice agent' and chose to talk in the browser rather than be called. This " +
    "conversation is the demo. Be excellent, keep it moving, and when they have heard enough " +
    "offer to call their phone with request_callback.",
  whatsapp:
    "They have just finished playing with the WhatsApp agent demo in the panel (a scripted " +
    "sample business - a clinic, a furniture store or a coaching institute) and tapped " +
    "'Talk to Ravan about it'. Do not explain what they just saw. Ask what business they run, " +
    "with offer_choices, and take it from there.",
  question:
    "They tapped 'Just a question' and are about to type it. Greet in one short sentence and " +
    "wait for the question.",
};

export class WebVoiceSession {
  /**
   * @param {import('ws').WebSocket} ws  the browser's socket
   * @param {object} opts
   * @param {(p10: string, o: object) => Promise<string>} opts.dialOut
   * @param {string} [opts.page]   the route the visitor is on
   * @param {"voice"|"text"} [opts.mode]  how the visitor started: microphone open, or typing
   * @param {string} [opts.intent] what they tapped on the opening screen (see INTENTS)
   * @param {() => void} [opts.onClose]
   */
  constructor(ws, { dialOut, page = "/", codec = "pcm16", mode = "voice", intent = null, onClose = null } = {}) {
    this.ws = ws;
    this.id = randomUUID();
    this.dialOut = dialOut;
    this.page = page;
    this.mode = mode === "text" ? "text" : "voice";
    this.intent = INTENTS[intent] ? intent : null;
    // The browser sends µ-law to halve its upload; anything speaking this
    // socket directly (the test client, a curl session) sends plain PCM16.
    this.codec = codec === "mulaw" ? "mulaw" : "pcm16";
    this.onCloseCb = onClose;

    this.identity = { phone10: null, name: null, email: null, conversationId: null };
    this.outcome = { escalated: false, endSession: false, navigatedTo: null };
    this.transcript = [];
    this.startedAt = Date.now();
    this.ended = false;
    this.live = null;
    this.tracer = null;

    // Transcription arrives as a stream of fragments; they are accumulated per
    // speaker and flushed to one line when the turn ends, so the log reads like
    // a conversation instead of confetti.
    this.pending = { user: "", agent: "" };

    this.maxTimer = setTimeout(() => this._end("max_duration"), MAX_SESSION_MS);
    this.idleTimer = null;
    this._touch();

    ws.on("message", (data, isBinary) => this._onBrowserMessage(data, isBinary));
    ws.on("close", () => this._end("visitor_left"));
    ws.on("error", (err) => console.error("web-voice browser ws", this.id, err.message));

    this._boot().catch((err) => {
      console.error("web-voice boot", this.id, err.message);
      this._emit({ type: "error", message: "Could not start the agent. Please try again." });
      this._end("boot_failed");
    });
  }

  // ---------------- setup ----------------

  async _boot() {
    const model = liveModel();

    // Both are session setup, not turn work, so they happen once here rather
    // than on the critical path of an answer.
    const [offer, playbook] = await Promise.all([currentOffer(), activePlaybook()]);
    const inlinePlaybook = playbookFitsInline(playbook);

    this.tracer = await startRun({
      agentSlug: "web-voice",
      workflow: "web-voice",
      trigger: "web_voice_session",
      model,
      engine: "gemini-live",
      input: { page: this.page, mode: this.mode, intent: this.intent, playbook: inlinePlaybook ? "inline" : "retrieval" },
      // A live conversation cannot wait ~200 ms on Supabase either side of
      // every tool call just to be observable.
      defer: true,
    });

    sessionsByRun.set(this.tracer.id, this);

    const opened = await this.tracer.step("session", {
      kind: "trigger",
      label: "Session opened",
      input: { page: this.page, model, mode: this.mode, intent: this.intent },
    });
    await opened.ok({ started: true });

    // The shared tools, resolved against whoever this turns out to be, plus
    // the ones that only mean something in a browser.
    //
    // search_playbook is dropped when the playbook is inlined above: leaving it
    // there would let the model spend 1.3 s retrieving text it is already
    // holding, which is exactly the pause visitors noticed.
    // escalate_to_human is dropped too: the web version in web-tools.mjs
    // knows how to open the handoff form for a visitor who has no number yet.
    const shared = buildToolSpecs({
      tracer: this.tracer,
      phone10: () => this.identity.phone10,
      outcome: this.outcome,
      channel: "web",
    }).filter((s) => s.name !== "escalate_to_human" && !(inlinePlaybook && s.name === "search_playbook"));
    const webOnly = buildWebToolSpecs({
      tracer: this.tracer,
      identity: this.identity,
      outcome: this.outcome,
      emit: (msg) => this._emit(msg),
      dialOut: this.dialOut,
    });
    this.specs = new Map([...shared, ...webOnly].map((s) => [s.name, s]));

    this.live = new GeminiLiveSession({
      model,
      systemInstruction:
        `${systemString(offer, "web", inlinePlaybook ? playbook : null)}` +
        `\n\nThe visitor is currently on the page ${this.page}.` +
        (this.mode === "text"
          ? `\n\nThey started by typing, not speaking. They still hear you, so keep talking the way you do; just expect replies as text, and lean on offer_choices so they can tap instead of type.`
          : ""),
      tools: [...this.specs.values()],
      voice: env("WEB_VOICE_VOICE", "Kore"),

      onOpen: () => {
        this._emit({ type: "ready", runId: this.tracer.id, sampleRate: OUTPUT_SAMPLE_RATE });
        // Nudge rather than script: the model opens in its own words, which
        // keeps the greeting in the visitor's language once they reply.
        this.live.sendText(this._greetingNudge());
      },
      onAudio: (pcm) => this._sendBinary(pcm),
      onInputTranscript: (text) => this._transcript("user", text),
      onOutputTranscript: (text) => this._transcript("agent", text),
      onInterrupted: () => {
        this._flush();
        this._emit({ type: "interrupted" });
      },
      onTurnComplete: () => {
        this._flush();
        this._emit({ type: "turn_end" });
        if (this.outcome.endSession) this._end("agent_ended");
      },
      onToolCall: (calls) => this._runTools(calls),
      onUsage: (usage) => this._recordUsage(usage),
      onGoAway: (ms) => {
        // Live sessions have a server-side lifetime. Warn the visitor rather
        // than have the agent vanish mid-word.
        this._emit({ type: "expiring", msLeft: ms });
      },
      onError: (err) => {
        console.error("web-voice gemini", this.id, err.message);
        this._emit({ type: "error", message: "The agent dropped out. Please try again." });
        this._end("model_error");
      },
      onClose: () => this._end("model_closed"),
    });
  }

  /**
   * The first thing the model hears. A nudge rather than a script: the model
   * opens in its own words, which keeps the greeting in the visitor's
   * language once they reply. With an intent it skips "what brought you
   * here" and goes straight into the track they tapped.
   */
  _greetingNudge() {
    const how = this.mode === "text" ? "just opened the panel and is typing" : "just opened the microphone";
    const base =
      `[The visitor ${how}. Greet them in English in one short sentence, once. If a tool result ` +
      `comes back mid-turn, carry on from where you were; never greet a second time. If they reply in ` +
      `another language, switch to it immediately for the rest of the conversation.`;
    if (this.intent) return `${base} ${INTENTS[this.intent]}]`;
    return `${base} Say in one sentence what you are, and ask what brought them to the site.]`;
  }

  // ---------------- browser -> us ----------------

  _onBrowserMessage(data, isBinary) {
    if (this.ended) return;
    this._touch();

    if (isBinary) {
      if (data.length > MAX_FRAME_BYTES) return;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      this.live?.sendAudio(this.codec === "mulaw" ? mulawToPcm16(buf) : buf);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case "text":
        // Typed fallback: accessibility, noisy rooms, and anyone who would
        // rather not talk out loud in an office.
        if (typeof msg.text === "string" && msg.text.trim()) {
          this._transcript("user", msg.text.trim());
          this._flush();
          this.live?.sendText(msg.text.trim().slice(0, 800));
        }
        break;
      case "mode":
        // They switched between typing and the microphone mid-conversation.
        if (msg.mode === "voice" || msg.mode === "text") {
          this.mode = msg.mode;
          this.live?.sendText(
            msg.mode === "voice"
              ? "[The visitor switched their microphone on and will speak from here.]"
              : "[The visitor switched to typing. They still hear you.]",
            { turnComplete: false }
          );
        }
        break;
      case "page":
        // The visitor navigated on their own; keep the model oriented.
        if (typeof msg.path === "string") {
          this.page = msg.path;
          this.live?.sendText(`[The visitor is now looking at the page ${msg.path}.]`, {
            turnComplete: false,
          });
        }
        break;
      case "bye":
        this._end("visitor_left");
        break;
      default:
        break;
    }
  }

  /**
   * The visitor filled in the WhatsApp handoff form while this session was
   * still open. Adopt the identity so the transcript is written to their
   * thread at the end, and let the model know so it can acknowledge it.
   */
  adoptHandoff({ phone10, name, note }) {
    if (phone10) this.identity.phone10 = phone10;
    if (name && !this.identity.name) this.identity.name = name;
    this.outcome.escalated = true;
    this._emit({ type: "identity", name: this.identity.name, phone10: this.identity.phone10 });
    this.live?.sendText(
      `[The visitor just submitted the WhatsApp form${name ? ` as ${name}` : ""}. ` +
        `A message has been sent to their WhatsApp and a person from the team will continue there` +
        `${note ? `. They wrote: "${note}"` : ""}. Acknowledge it in one sentence and ask if there is anything else before they go.]`
    );
  }

  // ---------------- tools ----------------

  async _runTools(calls) {
    const results = await Promise.all(
      calls.map(async ({ id, name, args }) => {
        const spec = this.specs.get(name);
        this._emit({ type: "tool", name, label: spec?.label ?? name, status: "running" });
        if (!spec) {
          this._emit({ type: "tool", name, label: name, status: "error" });
          return { id, name, response: { error: `Unknown tool "${name}".` } };
        }
        // spec.run is already traced and already swallows its own errors into
        // an { error } payload, so a bad tool call becomes something the model
        // can recover from rather than a dropped session.
        const response = await spec.run(args ?? {});
        this._emit({
          type: "tool",
          name,
          label: spec.label,
          status: response?.error ? "error" : "ok",
        });
        return { id, name, response };
      })
    );
    this.live?.respondToTools(results);
  }

  _recordUsage(usage) {
    // The Live API reports cumulative totals for the session, so each report
    // is charged as the delta since the last one.
    const total = usage?.totalTokenCount ?? 0;
    const prompt = usage?.promptTokenCount ?? 0;
    const response = usage?.responseTokenCount ?? usage?.candidatesTokenCount ?? total - prompt;
    const prev = this._usage ?? { input: 0, output: 0 };
    const delta = { input_tokens: Math.max(0, prompt - prev.input), output_tokens: Math.max(0, response - prev.output) };
    this._usage = { input: prompt, output: response };
    if (delta.input_tokens || delta.output_tokens) this.tracer?.addUsage(delta);
  }

  // ---------------- transcript ----------------

  _transcript(role, text) {
    this.pending[role] += text;
    this._emit({ type: "transcript", role, text, final: false });
  }

  /** Close off whatever each speaker had accumulated, as one line each. */
  _flush() {
    for (const role of ["user", "agent"]) {
      const text = this.pending[role].trim();
      if (!text) continue;
      this.pending[role] = "";
      this.transcript.push({ role, text, at: new Date().toISOString() });
      this._emit({ type: "transcript", role, text, final: true });
    }
  }

  // ---------------- us -> browser ----------------

  _emit(obj) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }

  _sendBinary(buf) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(buf, { binary: true });
  }

  _touch() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this._end("idle"), IDLE_MS);
  }

  // ---------------- teardown ----------------

  async _end(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.maxTimer);
    clearTimeout(this.idleTimer);
    this._flush();
    if (this.tracer) sessionsByRun.delete(this.tracer.id);

    this._emit({ type: "end", reason });
    this.live?.close();
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }

    const durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    // Only persist the conversation if we know whose it is; an anonymous
    // session leaves a run and a transcript on the run, and nothing else.
    if (this.identity.phone10 && this.transcript.length) {
      for (const turn of this.transcript) {
        await insertMessage(this.identity.phone10, {
          direction: turn.role === "user" ? "in" : "out",
          type: "voice",
          text: turn.text,
          source: "web-voice",
        }).catch(() => {});
      }
      await touchConversation(this.identity.phone10, {
        text: this.transcript.at(-1).text,
        direction: this.transcript.at(-1).role === "user" ? "in" : "out",
        contactName: this.identity.name,
        openWindow: false,
        bumpUnread: true,
      }).catch(() => {});
    }

    if (this.tracer) {
      const done = await this.tracer.step("done", { kind: "output", label: "Session complete" });
      await done.ok({
        reason,
        duration_seconds: durationSec,
        turns: this.transcript.length,
        identified: !!this.identity.phone10,
        escalated: this.outcome.escalated,
        handoff_reason: this.outcome.handoffReason ?? null,
        cost_usd: Number(this.tracer.totals.cost.toFixed(6)),
      });
      await this.tracer.finish(reason === "boot_failed" || reason === "model_error" ? "failed" : "succeeded", {
        reason,
        duration_seconds: durationSec,
        page: this.page,
        transcript: this.transcript,
        lead: this.identity.phone10 ? { phone10: this.identity.phone10, name: this.identity.name } : null,
        escalated: this.outcome.escalated,
        handoff_reason: this.outcome.handoffReason ?? null,
        handoff_summary: this.outcome.handoffSummary ?? null,
      });
    }

    console.log(
      `web-voice ${this.id} ended: ${reason}, ${durationSec}s, ${this.transcript.length} turns` +
        (this.identity.phone10 ? `, lead ${this.identity.phone10}` : "")
    );
    this.onCloseCb?.();
  }
}

export { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE };
