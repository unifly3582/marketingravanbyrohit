// Gemini Live API client — one WebSocket per live conversation.
//
// This is the whole brain for the website voice agent: audio in, audio out,
// tool calls, turn-taking and barge-in all happen inside one bidi stream. No
// separate STT or TTS vendor, which is why the browser agent answers in about
// a second where the phone pipeline (Sarvam STT -> Gemini -> Sarvam TTS) needs
// closer to eight. Measured on this account, 2026-09-05: 988 ms to first audio
// byte including a full tool round trip.
//
// Deliberately dumb: it speaks the wire protocol and nothing else. Who the
// visitor is, which tools exist, what gets traced, and how audio reaches a
// browser all belong to web-session.mjs.
//
// Wire-format notes that cost real debugging time:
//   * Audio IN must be 16-bit little-endian PCM, mono, 16 kHz, declared as
//     "audio/pcm;rate=16000". A wrong rate is accepted and then transcribed
//     as silence rather than rejected.
//   * Audio OUT is always 24 kHz PCM16 regardless of the input rate.
//   * activityStart/activityEnd are only legal when automatic VAD is disabled.
//     Server VAD stays on here, so interruption arrives as
//     serverContent.interrupted and we never send activity signals.

import WebSocket from "ws";
import { z } from "zod";

const ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** What the model expects from the microphone, and what the browser must send. */
export const INPUT_SAMPLE_RATE = 16000;
/** What the model returns, regardless of input rate. */
export const OUTPUT_SAMPLE_RATE = 24000;

const apiKey = () => process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

/**
 * Convert one engine-agnostic tool spec (agent/tools.mjs) into a Gemini
 * functionDeclaration, so the Live API can call exactly the same tools Mastra
 * and LangGraph call.
 */
export function toFunctionDeclaration(spec) {
  const parameters = spec.schema ? stripUnsupported(z.toJSONSchema(spec.schema)) : null;
  const hasParams = parameters && Object.keys(parameters.properties ?? {}).length > 0;
  return {
    name: spec.name,
    description: spec.description,
    ...(hasParams ? { parameters } : {}),
  };
}

/**
 * Gemini's schema dialect is OpenAPI 3.0, not JSON Schema. The bookkeeping
 * keys zod emits are rejected with a 400, so they are dropped rather than
 * passed through and discovered at call time.
 */
function stripUnsupported(node) {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;
  const DROP = new Set(["$schema", "additionalProperties", "exclusiveMinimum", "exclusiveMaximum"]);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (DROP.has(k)) continue;
    out[k] = stripUnsupported(v);
  }
  return out;
}

/**
 * An open Live conversation.
 *
 * Handlers (all optional):
 *   onOpen()                       setup acknowledged, safe to send audio
 *   onAudio(Buffer)                24 kHz PCM16 chunk to play
 *   onInputTranscript(text, done)  what the visitor is saying
 *   onOutputTranscript(text, done) what the agent is saying
 *   onToolCall(calls)              [{ id, name, args }] — answer with respondToTools()
 *   onInterrupted()                visitor barged in; drop queued audio
 *   onTurnComplete()               agent finished speaking
 *   onUsage(usageMetadata)         token accounting, arrives per turn
 *   onGoAway(msLeft)               server is about to close the socket
 *   onClose(code, reason)
 *   onError(err)
 */
export class GeminiLiveSession {
  /**
   * @param {object} opts
   * @param {string} opts.model              e.g. "gemini-3.1-flash-live-preview"
   * @param {string} opts.systemInstruction
   * @param {Array}  [opts.tools]            tool specs from agent/tools.mjs
   * @param {string} [opts.voice]            prebuilt voice name
   * @param {string} [opts.language]         BCP-47 hint, e.g. "hi-IN"
   */
  constructor({ model, systemInstruction, tools = [], voice = "Kore", language = null, ...handlers }) {
    if (!apiKey()) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");

    this.model = model;
    this.handlers = handlers;
    this.ready = false;
    this.closed = false;

    this.ws = new WebSocket(`${ENDPOINT}?key=${apiKey()}`);
    this.ws.on("open", () => this._sendSetup({ systemInstruction, tools, voice, language }));
    this.ws.on("message", (raw) => this._onMessage(raw));
    this.ws.on("error", (err) => handlers.onError?.(err));
    this.ws.on("close", (code, reason) => {
      this.closed = true;
      handlers.onClose?.(code, reason?.toString() ?? "");
    });
  }

  _sendSetup({ systemInstruction, tools, voice, language }) {
    const functionDeclarations = tools.map(toFunctionDeclaration);
    this._send({
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            ...(language ? { languageCode: language } : {}),
          },
        },
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
        // Both transcriptions are on because they are the only record of the
        // conversation: the audio itself is never persisted.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.setupComplete) {
      this.ready = true;
      this.handlers.onOpen?.();
      return;
    }

    if (msg.toolCall?.functionCalls?.length) {
      this.handlers.onToolCall?.(
        msg.toolCall.functionCalls.map((f) => ({ id: f.id, name: f.name, args: f.args ?? {} }))
      );
    }

    // "timeLeft" is a protobuf Duration, serialised as e.g. "12.5s".
    if (msg.goAway) {
      this.handlers.onGoAway?.(Math.round(parseFloat(String(msg.goAway.timeLeft ?? "0s")) * 1000) || 0);
    }

    if (msg.usageMetadata) this.handlers.onUsage?.(msg.usageMetadata);

    const sc = msg.serverContent;
    if (!sc) return;

    // Barge-in: the model's own VAD heard the visitor talk over it. Anything
    // already queued for playback is now stale.
    if (sc.interrupted) this.handlers.onInterrupted?.();

    for (const part of sc.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) this.handlers.onAudio?.(Buffer.from(part.inlineData.data, "base64"));
    }

    if (sc.inputTranscription?.text)
      this.handlers.onInputTranscript?.(sc.inputTranscription.text, !!sc.inputTranscription.finished);
    if (sc.outputTranscription?.text)
      this.handlers.onOutputTranscript?.(sc.outputTranscription.text, !!sc.outputTranscription.finished);

    if (sc.turnComplete) this.handlers.onTurnComplete?.();
  }

  /** Feed one chunk of microphone audio: PCM16 mono at INPUT_SAMPLE_RATE. */
  sendAudio(pcm16) {
    if (!this.ready) return;
    this._send({
      realtimeInput: {
        audio: { mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`, data: pcm16.toString("base64") },
      },
    });
  }

  /** Inject a text turn — used for the opening greeting and for system nudges. */
  sendText(text, { turnComplete = true, role = "user" } = {}) {
    if (!this.ready) return;
    this._send({ clientContent: { turns: [{ role, parts: [{ text }] }], turnComplete } });
  }

  /** Answer a toolCall. `results` is [{ id, name, response }]. */
  respondToTools(results) {
    if (!this.ready) return;
    this._send({
      toolResponse: {
        functionResponses: results.map(({ id, name, response }) => ({
          id,
          name,
          // Gemini requires an object here; a bare value gets wrapped.
          response:
            response && typeof response === "object" ? { result: response } : { result: { value: response } },
        })),
      },
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }
  }

  _send(obj) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}
