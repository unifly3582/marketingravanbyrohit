// One CallSession per live Vobiz WebSocket connection: owns the turn loop —
// caller audio -> VAD -> Sarvam STT -> the shared Gemini agent -> Sarvam TTS
// -> caller audio — plus barge-in and finalizing the `calls` row on hangup.
//
// Deliberately knows nothing about how the call was dialed or how the socket
// was matched to a phone number; voice/index.mjs owns that.

import { mulawToPcm16, VoiceActivityDetector } from "./audio.mjs";
import { transcribe, synthesize } from "./sarvam-speech.mjs";
import { runAgent } from "../agent/whatsapp-agent.mjs";
import { insertMessage, touchConversation, completeCall } from "../db.mjs";

// What she says the moment the call connects, before the caller has said a
// word. Override with VOICE_GREETING in the env (restart to apply). `{name}`
// becomes the caller's first name when the lead has one, and is dropped
// cleanly when it does not.
const DEFAULT_GREETING =
  "Namaste {name}! Main Priya bol rahi hoon, Marketing Ravan se. " +
  "Aapne hamari website par call request ki thi, isliye call kiya hai. " +
  "Kya abhi do minute baat kar sakte hain?";

/**
 * Split a reply into a short first chunk and the rest, at the first sentence
 * or clause boundary past ~25 characters. Short replies stay whole.
 */
export function splitForSpeech(text) {
  const t = String(text ?? "").trim();
  if (t.length < 60) return [t];
  const m = /^(.{25,}?[।.!?,;:])\s+(\S.*)$/s.exec(t);
  if (!m) return [t];
  return [m[1].trim(), m[2].trim()];
}

export function renderGreeting(template, contactName) {
  const first = (contactName ?? "").trim().split(/\s+/)[0];
  const out = first ? template.replace(/\{name\}/g, `${first} ji`) : template.replace(/\s*\{name\}/g, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

export const greeting = (contactName) => renderGreeting(process.env.VOICE_GREETING || DEFAULT_GREETING, contactName);
const MAX_CALL_MS = 10 * 60 * 1000; // safety cap if hangup detection ever fails
const OUT_FRAME_MS = 20;
const SAMPLE_RATE = 8000;

export class CallSession {
  /**
   * @param {object} opts
   * @param {Promise<Buffer>|null} [opts.greetingAudio]  opener already synthesised
   *   while Vobiz was still connecting the stream (see voice/index.mjs)
   */
  constructor(ws, { attemptId, phone10, contactName = null, greetingAudio = null }) {
    this.ws = ws;
    this.attemptId = attemptId;
    this.phone10 = phone10;
    this.contactName = contactName;
    this.greetingAudio = greetingAudio;
    this.connectedAt = Date.now();

    this.streamId = null;
    this.vad = new VoiceActivityDetector({ sampleRate: SAMPLE_RATE, endOfTurnSilenceMs: 500 });
    this.turns = [];
    this.startedAt = Date.now();
    this.agentSpeaking = false;
    this.turnInFlight = false;
    this.ended = false;
    this.greeted = false;
    this.greetingPlaying = false;

    this.maxDurationTimer = setTimeout(() => this._hangup("max_duration"), MAX_CALL_MS);

    ws.on("message", (raw) => this._onMessage(raw));
    ws.on("close", () => this._onClose());
    ws.on("error", (err) => console.error("voice ws error", this.attemptId, err.message));
  }

  async _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start":
        this.streamId = msg.start?.streamId ?? msg.streamId ?? null;
        this._greet();
        break;
      case "media": {
        // Every media frame carries the streamId too, so a lost or late
        // "start" event no longer costs the greeting or the reply audio.
        if (!this.streamId && msg.streamId) this.streamId = msg.streamId;
        if (!this.greeted) this._greet();
        const b64 = msg.media?.payload;
        if (!b64) return;
        this._handleAudio(mulawToPcm16(Buffer.from(b64, "base64")));
        break;
      }
      case "stop":
        this._hangup("caller_hangup");
        break;
      default:
        break; // playedStream / clearedAudio acks — nothing to react to
    }
  }

  /**
   * Say hello once, however the stream announced itself. The opener plays
   * through whatever the caller does: nearly everyone says "hello?" as they
   * pick up, and treating that as a barge-in cut the script off within a
   * second on every live call of 2026-09-15. Audio heard meanwhile is
   * discarded — it is the pickup "hello", not an answer to anything.
   */
  async _greet() {
    if (this.greeted) return;
    this.greeted = true;
    this.greetingPlaying = true;
    try {
      await this._speak(greeting(this.contactName), { log: true, audio: this.greetingAudio });
    } finally {
      this.greetingPlaying = false;
      this.vad.reset();
    }
  }

  _handleAudio(pcm16) {
    const { sustainedSpeech, utteranceEnded } = this.vad.push(pcm16);
    if (this.greetingPlaying) return;
    // Interrupt only on sustained speech: a click, a cough or a stray syllable
    // used to clear the reply mid-sentence.
    if (sustainedSpeech && this.agentSpeaking) this._bargeIn();
    if (utteranceEnded && !this.turnInFlight) this._handleUtterance(utteranceEnded);
  }

  /** Caller started talking while the agent's reply is still playing: stop it and listen. */
  _bargeIn() {
    this.agentSpeaking = false;
    this._send({ event: "clearAudio", streamId: this.streamId });
  }

  async _handleUtterance(pcm16) {
    this.turnInFlight = true;
    const t0 = Date.now();
    const marks = {};
    try {
      const transcript = await transcribe(pcm16, { sampleRate: SAMPLE_RATE }).catch((err) => {
        console.error("voice STT", this.attemptId, err.message);
        return "";
      });
      marks.stt = Date.now() - t0;
      if (!transcript) return;

      // The call so far, before this utterance is added to it. Logging the
      // utterance is two Supabase writes; nothing here waits for them.
      const turns = this.turns.slice();
      this._log("in", transcript);

      // Start speaking the moment the model calls speak_reply, not when the
      // whole run returns: the engine keeps reasoning for a couple of seconds
      // after the reply tool (bookkeeping, then a trailing "ready for the
      // next turn" step), and on a phone every one of those seconds is dead
      // air. The microphone is handed back as soon as the reply has been
      // spoken, too — the run's tail end finishes in the background, and a
      // caller who answers quickly is heard rather than dropped.
      let resolveFirst;
      const firstReply = new Promise((r) => { resolveFirst = r; });
      const run = runAgent({
        channel: "voice",
        phone10: this.phone10,
        text: transcript,
        contactName: this.contactName,
        trigger: "voice_inbound",
        turns,
        onSpeak: (text) => resolveFirst(text),
      }).then((result) => {
        resolveFirst(result.reply || null); // no-op if speak_reply already fired
        return result;
      });

      const text = await firstReply;
      marks.brain = Date.now() - t0 - marks.stt;
      const speech = text ? this._speak(text, { log: true, onAudio: () => { marks.tts = Date.now() - t0 - marks.stt - marks.brain; } }) : Promise.resolve();
      this.lastSpeech = speech;
      await speech;
      // stt / brain / tts are the three waits between the caller going quiet
      // and hearing the first sound of the answer.
      console.log("voice turn", this.attemptId.slice(0, 8), JSON.stringify(marks), `"${transcript.slice(0, 40)}"`);

      run
        .then(async (result) => {
          if (!result.endCall) return;
          await this.lastSpeech; // let the goodbye finish playing first
          this._hangup("agent_ended");
        })
        .catch((err) => console.error("voice agent run", this.attemptId, err.message));
    } finally {
      this.turnInFlight = false;
    }
  }

  async _log(direction, text) {
    this.turns.push({ role: direction === "in" ? "user" : "assistant", text, at: new Date().toISOString() });
    await insertMessage(this.phone10, { direction, type: "voice", text, source: "voice-agent" }).catch((err) =>
      console.error("voice insertMessage", err.message)
    );
    await touchConversation(this.phone10, {
      text,
      direction,
      contactName: this.contactName,
      // A phone call does NOT open WhatsApp's 24-hour window — only a WhatsApp
      // message from the customer does. Setting it here made sendMessage()
      // pick free-form text, which Meta rejects outside a real window.
      openWindow: false,
      bumpUnread: direction === "in",
    }).catch((err) => console.error("voice touchConversation", err.message));
  }

  async _speak(text, { log = false, audio = null, onAudio = null } = {}) {
    // Logging is two Supabase writes; nothing waits for them. _log() already
    // swallows its own failures.
    if (log) this._log("out", text);

    // Sarvam's TTS is a whole-utterance round trip (1-2.4 s measured for one
    // sentence), so a two-sentence reply is split at the first boundary and
    // both halves are synthesised at once: the caller hears the first half
    // while the second is still being made.
    const parts = audio ? [audio] : splitForSpeech(text).map((t) => synthesize(t, { sampleRate: SAMPLE_RATE }));

    this.agentSpeaking = true;
    let first = true;
    for (const part of parts) {
      let pcm16;
      try {
        pcm16 = await part;
      } catch (err) {
        console.error("voice TTS", this.attemptId, err.message);
        continue;
      }
      if (!pcm16) continue;
      if (first) { onAudio?.(); first = false; }
      if (!this.agentSpeaking) break; // barged in during an earlier part
      await this._streamAudioOut(pcm16);
    }
    this.agentSpeaking = false;
    this._send({ event: "checkpoint", streamId: this.streamId, name: "tts" });
  }

  async _streamAudioOut(pcm16) {
    const bytesPerFrame = Math.round((SAMPLE_RATE * OUT_FRAME_MS) / 1000) * 2; // 16-bit samples
    for (let off = 0; off < pcm16.length; off += bytesPerFrame) {
      if (!this.agentSpeaking) return; // interrupted mid-stream by barge-in
      const frame = pcm16.subarray(off, off + bytesPerFrame);
      this._send({
        event: "playAudio",
        streamId: this.streamId,
        media: { contentType: "audio/x-l16", sampleRate: SAMPLE_RATE, payload: frame.toString("base64") },
      });
      await new Promise((r) => setTimeout(r, OUT_FRAME_MS));
    }
  }

  _send(obj) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }

  async _hangup(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.maxDurationTimer);
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }
    await this._finalize(reason);
  }

  async _onClose() {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.maxDurationTimer);
    await this._finalize("caller_hangup");
  }

  async _finalize(reason) {
    const duration = Math.round((Date.now() - this.startedAt) / 1000);
    const failed = reason !== "agent_ended" && reason !== "caller_hangup";
    await completeCall(this.attemptId, {
      status: this.turns.length ? "connected" : "no_speech",
      duration,
      interaction_transcript: this.turns,
      final_agent_variables: null,
      failure_reason: failed ? reason : null,
    }).catch((err) => console.error("voice completeCall", err.message));
  }
}
