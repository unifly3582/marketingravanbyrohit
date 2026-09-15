// One LiveCallSession per phone call, when the call runs on Gemini Live.
//
//   Vobiz  <--(L16 16k in / L16 24k out)-->  us  <-->  Gemini Live API
//
// The Sarvam pipeline (session.mjs) is STT -> text model -> TTS, three waits
// in a row, and measured 4-5 s from the caller going quiet to the first sound
// of the answer. Gemini Live hears and speaks natively with its own
// turn-taking and barge-in, and answers the website's visitors in about a
// second; this is the same brain on the phone. Vobiz can deliver 16 kHz
// linear audio and play 24 kHz linear audio, which are exactly the model's
// formats, so nothing here resamples anything.
//
// Everything the website session does — tools, tracing, transcript — is
// reused; what differs is the far end of the socket (a caller on the PSTN
// rather than a browser), the opener (the configured script, verbatim) and
// how the call ends (a checkpoint so the goodbye plays out before hangup).

import { GeminiLiveSession, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "./gemini-live.mjs";
import { buildToolSpecs } from "../agent/tools.mjs";
import { currentOffer, systemString, activePlaybook, playbookFitsInline } from "../agent/prompt.mjs";
import { startRun } from "../agent/trace.mjs";
import { liveModel } from "../agent/models.mjs";
import { insertMessage, touchConversation, completeCall } from "../db.mjs";
import { greeting } from "./session.mjs";

const env = (k, d) => process.env[k] ?? d;

/** What the answer XML asks Vobiz to send us: the model's own input format. */
export const LIVE_INPUT_CONTENT_TYPE = `audio/x-l16;rate=${INPUT_SAMPLE_RATE}`;

const MAX_CALL_MS = 10 * 60 * 1000; // safety cap if hangup detection ever fails
/** After end_call: how long to wait for the goodbye to finish playing before cutting. */
const HANGUP_GRACE_MS = 8000;

/** Vobiz's L16 is little-endian on the way out (proven on live calls); flip this if the way in turns out otherwise. */
const SWAP_INPUT_BYTES = env("VOICE_LIVE_SWAP_IN", "0") === "1";

export class LiveCallSession {
  constructor(ws, { attemptId, phone10, contactName = null }) {
    this.ws = ws;
    this.attemptId = attemptId;
    this.phone10 = phone10;
    this.contactName = contactName;

    this.streamId = null;
    this.live = null;
    this.tracer = null;
    this.specs = new Map();
    this.outcome = { escalated: false, endCall: false };
    this.transcript = [];
    this.pending = { user: "", agent: "" };
    this.greeted = false;
    this.ended = false;
    this.startedAt = Date.now();
    this.firstAudioAt = null;
    this.hangupTimer = null;

    this.maxTimer = setTimeout(() => this._end("max_duration"), MAX_CALL_MS);

    ws.on("message", (raw) => this._onVobizMessage(raw));
    ws.on("close", () => this._end("caller_hangup"));
    ws.on("error", (err) => console.error("live-call ws error", this.attemptId, err.message));

    this._boot().catch((err) => {
      console.error("live-call boot", this.attemptId, err.message);
      this._end("boot_failed");
    });
  }

  // ---------------- setup ----------------

  async _boot() {
    const model = liveModel();
    const [offer, playbook] = await Promise.all([currentOffer(), activePlaybook()]);
    const inlinePlaybook = playbookFitsInline(playbook);

    this.tracer = await startRun({
      agentSlug: "voice-live",
      workflow: "voice-responder",
      trigger: "voice_call",
      model,
      engine: "gemini-live",
      phone10: this.phone10,
      input: { attempt_id: this.attemptId, contact_name: this.contactName, playbook: inlinePlaybook ? "inline" : "retrieval" },
      // A live call cannot wait on Supabase either side of every tool call.
      defer: true,
    });
    const opened = await this.tracer.step("inbound-audio", {
      kind: "trigger",
      label: "Call answered",
      input: { phone10: this.phone10, model },
    });
    await opened.ok({ answered: true });

    // The phone tool set, minus speak_reply: the model speaks for itself here.
    // end_call is reworded for the same reason.
    const specs = buildToolSpecs({
      tracer: this.tracer,
      phone10: this.phone10,
      outcome: this.outcome,
      channel: "voice",
      contactName: this.contactName,
    })
      .filter((s) => s.name !== "speak_reply" && !(inlinePlaybook && s.name === "search_playbook"))
      .map((s) =>
        s.name === "end_call"
          ? {
              ...s,
              description:
                "Hang up the call. Use it only after you have said your goodbye out loud — when the " +
                "caller says bye, confirms nothing else is needed, or after you have escalated and told " +
                "them a person will follow up on WhatsApp.",
            }
          : s
      );
    this.specs = new Map(specs.map((s) => [s.name, s]));

    this.live = new GeminiLiveSession({
      model,
      systemInstruction:
        systemString(offer, "call", inlinePlaybook ? playbook : null) +
        `\n\nYou are on a phone call with ${this.contactName ?? "a caller"} (+91${this.phone10}).`,
      tools: [...this.specs.values()],
      voice: env("VOICE_LIVE_VOICE", "Kore"),

      onOpen: () => this._maybeGreet(),
      onAudio: (pcm) => this._play(pcm),
      onInputTranscript: (text) => this._transcript("user", text),
      onOutputTranscript: (text) => this._transcript("agent", text),
      onInterrupted: () => {
        this._flush();
        this._send({ event: "clearAudio", streamId: this.streamId });
      },
      onTurnComplete: () => {
        this._flush();
        if (this.outcome.endCall) this._hangupAfterAudio();
      },
      onToolCall: (calls) => this._runTools(calls),
      onUsage: (usage) => this._recordUsage(usage),
      onGoAway: (ms) => console.log("live-call", this.attemptId.slice(0, 8), `model session expiring in ${ms} ms`),
      onError: (err) => {
        console.error("live-call gemini", this.attemptId, err.message);
        this._end("model_error");
      },
      onClose: () => this._end("model_closed"),
    });
  }

  /**
   * The opener, once both ends are up: the model is ready and Vobiz has sent
   * the stream's "start" (before that there is nowhere to play audio to).
   * The configured script is spoken verbatim, so what the caller hears first
   * is the line the business wrote, in the model's voice.
   */
  _maybeGreet() {
    if (this.greeted || !this.live?.ready || !this.streamId) return;
    this.greeted = true;
    const line = greeting(this.contactName);
    this.live.sendText(
      `[The call has just been answered by ${this.contactName ?? "the caller"}. Say exactly this, ` +
        `word for word, and nothing else, then wait for them to reply: "${line}"]`
    );
  }

  // ---------------- Vobiz -> model ----------------

  _onVobizMessage(raw) {
    if (this.ended) return;
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start":
        this.streamId = msg.start?.streamId ?? msg.streamId ?? null;
        this._maybeGreet();
        break;
      case "media": {
        if (!this.streamId && msg.streamId) {
          this.streamId = msg.streamId;
          this._maybeGreet();
        }
        const b64 = msg.media?.payload;
        if (!b64) return;
        let pcm = Buffer.from(b64, "base64");
        if (SWAP_INPUT_BYTES) pcm = pcm.swap16();
        this.live?.sendAudio(pcm);
        break;
      }
      case "playedStream":
        // The goodbye has finished playing; now it is safe to hang up.
        if (msg.name === "bye") this._end("agent_ended");
        break;
      case "stop":
        this._end("caller_hangup");
        break;
      default:
        break; // clearedAudio and friends
    }
  }

  // ---------------- model -> Vobiz ----------------

  _play(pcm24k) {
    if (!this.streamId) return;
    if (!this.firstAudioAt) {
      this.firstAudioAt = Date.now();
      console.log("live-call", this.attemptId.slice(0, 8), `first audio ${this.firstAudioAt - this.startedAt} ms after stream open`);
    }
    // Vobiz queues playAudio and plays it out in order, so the model's bursts
    // go straight through; clearAudio on barge-in drops whatever is queued.
    this._send({
      event: "playAudio",
      streamId: this.streamId,
      media: { contentType: "audio/x-l16", sampleRate: OUTPUT_SAMPLE_RATE, payload: pcm24k.toString("base64") },
    });
  }

  _hangupAfterAudio() {
    if (this.hangupTimer) return;
    this._send({ event: "checkpoint", streamId: this.streamId, name: "bye" });
    this.hangupTimer = setTimeout(() => this._end("agent_ended"), HANGUP_GRACE_MS);
  }

  _send(obj) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // ---------------- tools ----------------

  async _runTools(calls) {
    const results = await Promise.all(
      calls.map(async ({ id, name, args }) => {
        const spec = this.specs.get(name);
        if (!spec) return { id, name, response: { error: `Unknown tool "${name}".` } };
        // spec.run is traced and turns its own failures into { error }, so a
        // bad tool call is something the model recovers from, not a dropped call.
        const response = await spec.run(args ?? {});
        return { id, name, response };
      })
    );
    this.live?.respondToTools(results);
  }

  _recordUsage(usage) {
    // Cumulative per session; charge the delta.
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
  }

  /** One line per speaker per turn, written to the thread as it happens. */
  _flush() {
    for (const role of ["user", "agent"]) {
      const text = this.pending[role].trim();
      if (!text) continue;
      this.pending[role] = "";
      this.transcript.push({ role: role === "user" ? "user" : "assistant", text, at: new Date().toISOString() });
      const direction = role === "user" ? "in" : "out";
      insertMessage(this.phone10, { direction, type: "voice", text, source: "voice-agent" }).catch((err) =>
        console.error("live-call insertMessage", err.message)
      );
      touchConversation(this.phone10, {
        text,
        direction,
        contactName: this.contactName,
        openWindow: direction === "in",
        bumpUnread: direction === "in",
      }).catch((err) => console.error("live-call touchConversation", err.message));
    }
  }

  // ---------------- teardown ----------------

  async _end(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.maxTimer);
    clearTimeout(this.hangupTimer);
    this._flush();

    this.live?.close();
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }

    const durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    const failed = reason === "boot_failed" || reason === "model_error";
    const spoke = this.transcript.some((t) => t.role === "user");
    await completeCall(this.attemptId, {
      status: failed ? "failed" : spoke ? "connected" : "no_speech",
      duration: durationSec,
      interaction_transcript: this.transcript,
      failure_reason: failed ? reason : null,
    }).catch((err) => console.error("live-call completeCall", err.message));

    if (this.tracer) {
      const done = await this.tracer.step("done", { kind: "output", label: "Call complete" });
      await done.ok({
        reason,
        duration_seconds: durationSec,
        turns: this.transcript.length,
        escalated: this.outcome.escalated,
        cost_usd: Number(this.tracer.totals.cost.toFixed(6)),
      });
      await this.tracer.finish(failed ? "failed" : "succeeded", {
        reason,
        duration_seconds: durationSec,
        transcript: this.transcript,
        escalated: this.outcome.escalated,
        end_call: this.outcome.endCall,
      });
    }

    console.log(`live-call ${this.attemptId.slice(0, 8)} ended: ${reason}, ${durationSec}s, ${this.transcript.length} lines`);
  }
}
