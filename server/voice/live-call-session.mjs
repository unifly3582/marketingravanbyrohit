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
// The session is created when the call is *dialed*, not when the stream
// opens: the model connects and speaks the opener while the phone is still
// ringing, the audio is held here, and the moment Vobiz opens the stream it
// is flushed. Measured before this: 2-2.5 s from stream open to first sound,
// on top of Vobiz's own ~1.5 s between pickup and stream — the caller heard
// four seconds of nothing. A session whose call is never answered is closed
// by the hangup callback or a timer, and costs nothing while idle.
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
import { VoiceActivityDetector } from "./audio.mjs";

const env = (k, d) => process.env[k] ?? d;

/** What the answer XML asks Vobiz to send us: the model's own input format. */
export const LIVE_INPUT_CONTENT_TYPE = `audio/x-l16;rate=${INPUT_SAMPLE_RATE}`;

const MAX_CALL_MS = 10 * 60 * 1000; // safety cap if hangup detection ever fails
/** Dialed but no stream yet after this long: nobody picked up. */
const RING_TIMEOUT_MS = 90 * 1000;
/** After end_call: how long to wait for the goodbye to finish playing before cutting. */
const HANGUP_GRACE_MS = 5000;
/** Caller silent for this long after the agent finished: check once, then hang up. */
const IDLE_MS = Number(env("VOICE_IDLE_MS", 10_000));
const IDLE_GRACE_MS = Number(env("VOICE_IDLE_GRACE_MS", 6_000));
/**
 * How a call opens. People answer a phone and say "hello?" — an agent that
 * starts its script the instant the line connects talks over that, and the
 * caller's first words never reach the model. The practice on outbound
 * voice agents is to wait for the callee to speak, then open; if nobody
 * speaks, open anyway after a short pause. The opener audio is already made
 * (the model spoke it while the phone rang), so it starts within a frame of
 * the caller's "hello" — and that hello is dropped rather than sent to the
 * model, which would otherwise answer it on top of the opener.
 */
const OPEN_ON_HELLO_MS = Number(env("VOICE_HELLO_SPEECH_MS", 120));
/** A pickup "hello" is short and often quiet; this is well below the level used for turn-taking. */
const HELLO_RMS = Number(env("VOICE_HELLO_RMS", 300));
// Vobiz opens the stream 1-2 s after pickup, and most people say hello at
// pickup — before the stream exists (logged: near-silence for the whole
// first 2.5 s on a call where the caller had said hello). So the wait is
// short: a late hello still opens instantly, an early one is not waited for.
// Requested 2026-09-15: "very instant after hello" — people who hear
// nothing say hello again. So the wait is zero: the opener starts as soon
// as the stream is up; a hello that lands mid-opener is simply talked over,
// which is what a human caller does too.
const OPEN_AFTER_SILENCE_MS = Number(env("VOICE_OPEN_AFTER_MS", 0));
/** Never play anything in the first moments of the stream; the media path is still settling. */
const MIN_SETTLE_MS = Number(env("VOICE_SETTLE_MS", 150));
/**
 * Outbound audio is paced to real time, keeping this much queued at Vobiz.
 * Measured on live calls: while Vobiz is playing our audio it sends back
 * digital silence for the caller (peak 0), so a whole opener dumped into
 * its queue at once muted the caller for ten seconds, lost their "hello
 * hello", and tripped the silence check. Pacing keeps the muted window to
 * what is actually being said, and makes clearAudio on barge-in drop
 * milliseconds rather than seconds.
 */
const PLAYOUT_LEAD_MS = 350;
/**
 * The opener always plays to the end, and the caller is heard only after it.
 * Requested 2026-09-17: callers say "hello", "haan" or "kaun" over the first
 * sentence, which either cut it short (barge-in) or got answered on top of
 * it. Until the opener has finished playing, caller audio is not forwarded
 * to the model at all; whatever they said during it is simply not heard —
 * the same as a human caller who launches into their line at pickup.
 */
const OPENER_MAX_MS = Number(env("VOICE_OPENER_MAX_MS", 15_000));
/**
 * ...unless they really talk. A website lead (2026-09-17 07:41) spoke for
 * ten straight seconds over the opener, was ignored, went quiet and was
 * hung up on for silence. A "hello" or "haan" is under half a second; this
 * much sustained speech is a person saying something, and the opener yields
 * to it: playback is cut, the model starts hearing them, and is told why.
 */
const OPENER_BARGE_IN_MS = Number(env("VOICE_OPENER_BARGE_MS", 700));

/** Vobiz's L16 is little-endian on the way out (proven on live calls); flip this if the way in turns out otherwise. */
const SWAP_INPUT_BYTES = env("VOICE_LIVE_SWAP_IN", "0") === "1";

export class LiveCallSession {
  /**
   * @param {object} opts
   * @param {string} opts.attemptId
   * @param {string} opts.phone10
   * @param {string|null} [opts.contactName]
   * @param {(attemptId: string) => void} [opts.onEnd]  registry cleanup
   */
  constructor({ attemptId, phone10, contactName = null, onEnd = null }) {
    this.attemptId = attemptId;
    this.phone10 = phone10;
    this.contactName = contactName;
    this.onEnd = onEnd;

    this.ws = null;
    this.streamId = null;
    this.live = null;
    this.tracer = null;
    this.specs = new Map();
    this.outcome = { escalated: false, endCall: false };
    this.transcript = [];
    this.pending = { user: "", agent: "" };
    /** Model audio waiting to be paced out to Vobiz. */
    this.outQueue = [];
    this.pumping = false;
    /** Wall-clock time up to which audio has been handed to Vobiz for playback. */
    this.playheadAt = 0;
    this.greeted = false;
    /** The model has finished generating the opener turn. */
    this.openerTurnDone = false;
    /** The opener has finished *playing* at the caller's end; listening starts. */
    this.openerDone = false;
    this.openerTimer = null;
    this.ended = false;
    this.createdAt = Date.now();
    this.attachedAt = null;
    this.firstAudioAt = null;
    this.hangupTimer = null;
    this.idleTimer = null;
    this.idleNudged = false;
    /** Until the caller has said hello (or the pause runs out), audio is held both ways. */
    this.gateOpen = false;
    this.gateTimer = null;
    this.helloVad = new VoiceActivityDetector({ sampleRate: INPUT_SAMPLE_RATE, sustainedMs: OPEN_ON_HELLO_MS, speechRms: HELLO_RMS });
    this.openerVad = new VoiceActivityDetector({ sampleRate: INPUT_SAMPLE_RATE, sustainedMs: OPENER_BARGE_IN_MS });
    /** Turn-taking watch: when the caller last went quiet, to time the reply. */
    this.turnVad = new VoiceActivityDetector({ sampleRate: INPUT_SAMPLE_RATE, endOfTurnSilenceMs: 300 });
    this.callerQuietAt = null;
    this.turnNo = 0;

    this.ringTimer = setTimeout(() => {
      if (!this.ws) this._end("no_answer");
    }, RING_TIMEOUT_MS);
    this.maxTimer = null;

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
    if (this.ended) return;
    const opened = await this.tracer.step("inbound-audio", {
      kind: "trigger",
      label: "Call placed",
      input: { phone10: this.phone10, model },
    });
    await opened.ok({ dialed: true });

    // The phone tool set, minus speak_reply: the model speaks for itself here.
    // end_call is reworded for the same reason.
    const specs = buildToolSpecs({
      tracer: this.tracer,
      phone10: this.phone10,
      outcome: this.outcome,
      channel: "voice",
      contactName: this.contactName,
      // Slow side effects report back through the conversation instead of
      // holding the reply (see send_whatsapp_message in tools.mjs).
      notify: (text) => this.live?.sendText(text, { turnComplete: false }),
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

      onOpen: () => this._greet(),
      onAudio: (pcm) => {
        this._play(pcm);
        this._touchIdle();
      },
      onInputTranscript: (text) => {
        this.idleNudged = false;
        this._touchIdle();
        this._transcript("user", text);
      },
      onOutputTranscript: (text) => this._transcript("agent", text),
      onInterrupted: () => {
        this._flush();
        this.outQueue = [];
        this.playheadAt = Date.now();
        this._send({ event: "clearAudio", streamId: this.streamId });
      },
      onTurnComplete: () => {
        this._flush();
        if (!this.openerTurnDone) {
          this.openerTurnDone = true;
          this._maybeOpenerDone();
        }
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
   * The opener, spoken as soon as the model is up — usually while the phone
   * is still ringing. The audio waits in outQueue until the stream opens. The
   * configured script is spoken verbatim, so what the caller hears first is
   * the line the business wrote, in the model's voice.
   */
  _greet() {
    if (this.greeted || !this.live?.ready) return;
    this.greeted = true;
    const line = greeting(this.contactName);
    this.live.sendText(
      `[You have just called ${this.contactName ?? "this person"} and they have picked up. Say exactly this, ` +
        `word for word, and nothing else, then wait for them to reply: "${line}" ` +
        `If they talk over you while you are saying it, do not start it again — answer what they said and carry on.]`
    );
  }

  // ---------------- the call stream ----------------

  /** Vobiz opened the media stream: from here on audio flows both ways. */
  attach(ws) {
    if (this.ended || this.ws) {
      try { ws.close(); } catch { /* ignore */ }
      return;
    }
    this.ws = ws;
    this.attachedAt = Date.now();
    clearTimeout(this.ringTimer);
    this.maxTimer = setTimeout(() => this._end("max_duration"), MAX_CALL_MS);
    ws.on("message", (raw) => this._onVobizMessage(raw));
    ws.on("close", () => this._end("caller_hangup"));
    ws.on("error", (err) => console.error("live-call ws error", this.attemptId, err.message));
    this._touchIdle();
    this.gateTimer = setTimeout(() => this._openGate("silence"), OPEN_AFTER_SILENCE_MS);
    // Whatever happens, start listening after this long.
    this.openerTimer = setTimeout(() => this._openerFinished("timeout"), OPENER_MAX_MS);
    console.log(
      "live-call",
      this.attemptId.slice(0, 8),
      `stream attached ${this.attachedAt - this.createdAt} ms after dial, model ${this.live?.ready ? "ready" : "not ready"}, ${this.outQueue.length} chunks waiting`
    );
  }

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
        break;
      case "media": {
        if (!this.streamId && msg.streamId) this.streamId = msg.streamId;
        const b64 = msg.media?.payload;
        if (!b64) return;
        let pcm = Buffer.from(b64, "base64");
        if (SWAP_INPUT_BYTES) pcm = pcm.swap16();
        this._inboundStats(pcm, msg);
        if (!this.gateOpen) {
          // Listening for the pickup "hello". Not forwarded: the model has
          // already said the opener and must not answer the hello as well.
          if (this.helloVad.push(pcm).sustainedSpeech) this._openGate("hello");
          return;
        }
        // The opener is still playing: a short "hello" over it is not heard,
        // but sustained speech cuts it and hands the line to the caller.
        if (!this.openerDone) {
          if (this.openerVad.push(pcm).sustainedSpeech) this._openerInterrupted();
          else return;
        }
        // Response-time bookkeeping only: our own end-of-turn estimate, so the
        // log can say how long the caller waited after they stopped talking.
        const tv = this.turnVad.push(pcm);
        if (tv.utteranceEnded) this.callerQuietAt = Date.now();
        else if (tv.speechStarted) this.callerQuietAt = null;
        this.live?.sendAudio(pcm);
        break;
      }
      case "playedStream":
        // The goodbye has finished playing; now it is safe to hang up.
        if (this.outcome.endCall) this._end("agent_ended");
        break;
      case "stop":
        this._end("caller_hangup");
        break;
      default:
        break; // clearedAudio and friends
    }
  }

  /**
   * Diagnostic: what is actually arriving from Vobiz in the first seconds —
   * bytes per second (16 kHz L16 should be 32,000), peak and RMS level, and
   * when the first frame came. Three live calls in a row lost the caller's
   * first 10-15 s; this is how that gets pinned down.
   */
  _inboundStats(pcm, msg) {
    const now = Date.now();
    if (!this._in) {
      this._in = { firstAt: now, windowAt: now, bytes: 0, peak: 0, sumSq: 0, n: 0, logged: 0 };
      console.log("live-call", this.attemptId.slice(0, 8), `first inbound frame ${now - (this.attachedAt ?? this.createdAt)} ms after stream open, ${pcm.length} bytes, track=${msg.media?.track ?? "?"}`);
    }
    const st = this._in;
    st.bytes += pcm.length;
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      const v = pcm.readInt16LE(i);
      const a = v < 0 ? -v : v;
      if (a > st.peak) st.peak = a;
      st.sumSq += v * v;
      st.n++;
    }
    if (now - st.windowAt >= 1000 && st.logged < 12) {
      const rms = st.n ? Math.round(Math.sqrt(st.sumSq / st.n)) : 0;
      console.log("live-call", this.attemptId.slice(0, 8), `inbound ${st.bytes} B/s peak=${st.peak} rms=${rms} gate=${this.gateOpen ? "open" : "closed"}`);
      st.windowAt = now; st.bytes = 0; st.peak = 0; st.sumSq = 0; st.n = 0; st.logged++;
    }
  }

  /**
   * The opener counts as finished when the model has completed its turn and
   * every chunk of it has been handed to Vobiz and played out.
   */
  _maybeOpenerDone() {
    if (this.openerDone || !this.openerTurnDone || !this.gateOpen) return;
    if (this.pumping || this.outQueue.length) return;
    const remaining = Math.max(0, this.playheadAt - Date.now());
    setTimeout(() => this._openerFinished("played"), remaining + 100);
  }

  _openerFinished(why) {
    if (this.openerDone || this.ended) return;
    this.openerDone = true;
    clearTimeout(this.openerTimer);
    console.log("live-call", this.attemptId.slice(0, 8), `opener finished (${why}) ${Date.now() - (this.attachedAt ?? this.createdAt)} ms after stream open; listening`);
    this._touchIdle();
  }

  /** The caller talked over the opener for real: stop it and listen. */
  _openerInterrupted() {
    if (this.openerDone || this.ended) return;
    this.outQueue = [];
    this.playheadAt = Date.now();
    this._send({ event: "clearAudio", streamId: this.streamId });
    this._openerFinished("caller spoke over it");
    this.live?.sendText(
      "[The caller started talking over your opening line, so it was cut short. Listen to what they are " +
        "saying now and respond to that. Do not repeat the opening line.]",
      { turnComplete: false }
    );
  }

  /** The caller spoke, or the pause ran out: play the opener, start listening. */
  _openGate(why) {
    if (this.gateOpen || this.ended || !this.ws) return;
    clearTimeout(this.gateTimer);
    const sinceAttach = Date.now() - (this.attachedAt ?? this.createdAt);
    const settle = Math.max(0, MIN_SETTLE_MS - sinceAttach);
    setTimeout(() => {
      if (this.ended) return;
      this.gateOpen = true;
      console.log("live-call", this.attemptId.slice(0, 8), `opening on ${why} ${sinceAttach + settle} ms after stream open`);
      this._flushOut();
      this._touchIdle();
    }, settle);
  }

  // ---------------- model -> Vobiz ----------------

  _play(pcm24k) {
    if (this.openerDone && this.callerQuietAt) {
      const wait = Date.now() - this.callerQuietAt;
      this.callerQuietAt = null;
      console.log("live-call", this.attemptId.slice(0, 8), `turn ${++this.turnNo}: reply audio ${wait} ms after caller went quiet`);
    }
    this.outQueue.push(pcm24k);
    this._pump();
  }

  /** The stream just became playable: start pacing out whatever is queued. */
  _flushOut() {
    this._pump();
  }

  /** Hand chunks to Vobiz just ahead of real time, never as a burst. */
  _pump() {
    if (this.pumping) return;
    this.pumping = true;
    const step = () => {
      if (this.ended || !this.ws || !this.streamId || !this.gateOpen) {
        this.pumping = false;
        return;
      }
      const now = Date.now();
      if (this.playheadAt < now) this.playheadAt = now;
      const lead = this.playheadAt - now;
      if (lead > PLAYOUT_LEAD_MS) {
        setTimeout(step, lead - PLAYOUT_LEAD_MS);
        return;
      }
      const chunk = this.outQueue.shift();
      if (!chunk) {
        this.pumping = false;
        this._touchIdle(); // playback drains: the caller's silence clock starts here
        this._maybeOpenerDone();
        return;
      }
      this._sendAudio(chunk);
      this.playheadAt += (chunk.length / (OUTPUT_SAMPLE_RATE * 2)) * 1000;
      setImmediate(step);
    };
    step();
  }

  _sendAudio(pcm24k) {
    if (!this.firstAudioAt) {
      this.firstAudioAt = Date.now();
      console.log("live-call", this.attemptId.slice(0, 8), `first audio ${this.firstAudioAt - (this.attachedAt ?? this.createdAt)} ms after stream open`);
    }
    // Vobiz queues playAudio and plays it out in order, so the model's bursts
    // go straight through; clearAudio on barge-in drops whatever is queued.
    this._send({
      event: "playAudio",
      streamId: this.streamId,
      media: { contentType: "audio/x-l16", sampleRate: OUTPUT_SAMPLE_RATE, payload: pcm24k.toString("base64") },
    });
  }

  /**
   * end_call was invoked. The goodbye is usually already queued at Vobiz by
   * the time the tool fires, but the model may still be finishing the
   * sentence, so a checkpoint goes out after a short beat and the line is
   * cut when Vobiz reports the checkpoint played — or after a grace period,
   * whichever comes first.
   */
  _hangupAfterAudio() {
    if (this.hangupTimer) return;
    this.hangupTimer = setTimeout(() => {
      this._send({ event: "checkpoint", streamId: this.streamId, name: "bye" });
      this.hangupTimer = setTimeout(() => this._end("agent_ended"), HANGUP_GRACE_MS);
    }, 1200);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // ---------------- silence ----------------

  /**
   * Restart the silence clock: the caller spoke, or the agent is still
   * talking. Time the agent's audio is still playing at Vobiz does not count
   * — the caller cannot be heard during it (see PLAYOUT_LEAD_MS).
   */
  _touchIdle() {
    clearTimeout(this.idleTimer);
    if (!this.ws || this.ended) return;
    const playing = Math.max(0, this.playheadAt - Date.now());
    this.idleTimer = setTimeout(() => this._onIdle(), IDLE_MS + playing);
  }

  /**
   * Nothing from the caller for IDLE_MS after the agent went quiet. Once, she
   * asks whether they can hear her; if that too meets silence, the line is
   * cut — a dead call otherwise bills by the minute until the safety cap.
   */
  _onIdle() {
    if (this.ended || !this.ws) return;
    if (!this.idleNudged) {
      this.idleNudged = true;
      console.log("live-call", this.attemptId.slice(0, 8), "caller silent, checking in");
      this.live?.sendText(
        "[The caller has said nothing for ten seconds. Ask once, in three or four words, whether they can hear you. " +
          "If they still say nothing, say a short goodbye and call end_call.]"
      );
      this.idleTimer = setTimeout(() => this._onIdle(), IDLE_GRACE_MS + 4000);
      return;
    }
    console.log("live-call", this.attemptId.slice(0, 8), "caller still silent, hanging up");
    this._end("idle");
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
        if (name === "end_call") this._hangupAfterAudio();
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
        // A phone call does NOT open WhatsApp's 24-hour window (Meta rule);
        // claiming it did made sendMessage() send free text that Meta rejected.
        openWindow: false,
        bumpUnread: direction === "in",
      }).catch((err) => console.error("live-call touchConversation", err.message));
    }
  }

  // ---------------- teardown ----------------

  /** The call ended before the stream ever opened (hangup callback said so). */
  abandon(reason = "no_answer") {
    if (!this.ws) this._end(reason);
  }

  async _end(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.ringTimer);
    clearTimeout(this.maxTimer);
    clearTimeout(this.hangupTimer);
    clearTimeout(this.idleTimer);
    clearTimeout(this.gateTimer);
    clearTimeout(this.openerTimer);
    this._flush();
    this.onEnd?.(this.attemptId);

    this.live?.close();
    try {
      this.ws?.close();
    } catch {
      /* already closing */
    }

    const answered = !!this.attachedAt;
    const durationSec = answered ? Math.round((Date.now() - this.attachedAt) / 1000) : 0;
    const failed = reason === "boot_failed" || reason === "model_error";
    const spoke = this.transcript.some((t) => t.role === "user");
    // A call that never connected is closed out by the hangup callback with
    // Vobiz's own cause; the session does not overwrite that.
    if (answered || failed) {
      await completeCall(this.attemptId, {
        status: failed ? "failed" : spoke ? "connected" : "no_speech",
        duration: durationSec,
        interaction_transcript: this.transcript,
        failure_reason: failed ? reason : null,
      }).catch((err) => console.error("live-call completeCall", err.message));
    }

    if (this.tracer) {
      const done = await this.tracer.step("done", { kind: "output", label: "Call complete" });
      await done.ok({
        reason,
        answered,
        duration_seconds: durationSec,
        turns: this.transcript.length,
        escalated: this.outcome.escalated,
        cost_usd: Number(this.tracer.totals.cost.toFixed(6)),
      });
      await this.tracer.finish(failed ? "failed" : "succeeded", {
        reason,
        answered,
        duration_seconds: durationSec,
        transcript: this.transcript,
        escalated: this.outcome.escalated,
        end_call: this.outcome.endCall,
      });
    }

    console.log(`live-call ${this.attemptId.slice(0, 8)} ended: ${reason}, ${durationSec}s, ${this.transcript.length} lines`);
  }
}
