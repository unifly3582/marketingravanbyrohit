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

const GREETING = "Namaste! Marketing Ravan se baat kar rahe hain. Main aapki kaise madad kar sakta hoon?";
const MAX_CALL_MS = 10 * 60 * 1000; // safety cap if hangup detection ever fails
const OUT_FRAME_MS = 20;
const SAMPLE_RATE = 8000;

export class CallSession {
  constructor(ws, { attemptId, phone10, contactName = null }) {
    this.ws = ws;
    this.attemptId = attemptId;
    this.phone10 = phone10;
    this.contactName = contactName;

    this.streamId = null;
    this.vad = new VoiceActivityDetector({ sampleRate: SAMPLE_RATE });
    this.turns = [];
    this.startedAt = Date.now();
    this.agentSpeaking = false;
    this.turnInFlight = false;
    this.ended = false;

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
        this._speak(GREETING, { log: true });
        break;
      case "media": {
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

  _handleAudio(pcm16) {
    const { speechStarted, utteranceEnded } = this.vad.push(pcm16);
    if (speechStarted && this.agentSpeaking) this._bargeIn();
    if (utteranceEnded && !this.turnInFlight) this._handleUtterance(utteranceEnded);
  }

  /** Caller started talking while the agent's reply is still playing: stop it and listen. */
  _bargeIn() {
    this.agentSpeaking = false;
    this._send({ event: "clearAudio", streamId: this.streamId });
  }

  async _handleUtterance(pcm16) {
    this.turnInFlight = true;
    try {
      const transcript = await transcribe(pcm16, { sampleRate: SAMPLE_RATE }).catch((err) => {
        console.error("voice STT", this.attemptId, err.message);
        return "";
      });
      if (!transcript) return;

      await this._log("in", transcript);

      const result = await runAgent({
        channel: "voice",
        phone10: this.phone10,
        text: transcript,
        contactName: this.contactName,
        trigger: "voice_inbound",
      });

      if (result.reply) await this._speak(result.reply, { log: true });
      if (result.endCall) this._hangup("agent_ended");
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
      openWindow: direction === "in", // a call is as good a reason as a WhatsApp message to reopen the 24h window
      bumpUnread: direction === "in",
    }).catch((err) => console.error("voice touchConversation", err.message));
  }

  async _speak(text, { log = false } = {}) {
    if (log) await this._log("out", text);

    let pcm16;
    try {
      pcm16 = await synthesize(text, { sampleRate: SAMPLE_RATE });
    } catch (err) {
      console.error("voice TTS", this.attemptId, err.message);
      return;
    }

    this.agentSpeaking = true;
    await this._streamAudioOut(pcm16);
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
