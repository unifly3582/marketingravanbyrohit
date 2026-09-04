// Smoke test and latency benchmark for the website voice agent.
//
// Connects to the same WebSocket the site uses and prints what comes back:
// transcripts, tool calls, navigation, and how long the visitor waits.
//
//   node test-web-voice.mjs                       # typed turns, scripted
//   node test-web-voice.mjs "your question"       # typed turns, your script
//   SPEAK=1 node test-web-voice.mjs "..."         # speak it, like a real visitor
//   TEST_WS_BASE=wss://marketingravan.com SPEAK=1 node test-web-voice.mjs
//
// SPEAK=1 is the mode that tells the truth. A typed turn skips end-of-speech
// detection entirely, so text-mode latency is always optimistic by roughly a
// second — measuring only in text is how the live site ended up feeling slow
// while every local number looked fine.

import "./env.mjs";
import WebSocket from "ws";

const BASE = process.env.TEST_WS_BASE ?? "ws://localhost:8787";
const SPEAK = process.env.SPEAK === "1";
const TAIL_MS = Number(process.env.TAIL_MS ?? 1500);
const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const lines = process.argv.slice(2);
const script = lines.length
  ? lines
  : [
      "Hi, what does Marketing Ravan actually do?",
      "Show me the voice agent page and tell me what it costs.",
      "Thanks, that's all for now. Bye!",
    ];

/**
 * Speak a line with the TTS model, resampled 24k -> 16k the same way the
 * browser worklet does, with trailing silence so end-of-speech detection has
 * something to detect. A real microphone never just stops sending.
 */
async function utterance(text) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
        },
      }),
    }
  );
  const d = await r.json();
  if (!d.candidates) throw new Error("TTS failed: " + JSON.stringify(d).slice(0, 200));
  const pcm = Buffer.from(d.candidates[0].content.parts[0].inlineData.data, "base64");
  const src = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const n = Math.floor(src.length / 1.5);
  const speech = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * 1.5;
    const j = Math.floor(x);
    const f = x - j;
    const a = src[j];
    const b = j + 1 < src.length ? src[j + 1] : a;
    speech[i] = a + (b - a) * f;
  }
  return speech;
}

const ws = new WebSocket(`${BASE}/api/voice/web?page=/`);
ws.binaryType = "arraybuffer";

let audioBytes = 0;
let turn = 0;
let askedAt = null;
let firstAudioAt = null;
const waits = [];

/** Type a line. */
function type(text) {
  askedAt = Date.now();
  console.log(`\n\x1b[36m> ${text}\x1b[0m`);
  ws.send(JSON.stringify({ type: "text", text }));
}

/** Say a line out loud, at real-time pace, then hold the mic open on silence. */
async function speak(text) {
  console.log(`\n\x1b[36m> (spoken) ${text}\x1b[0m`);
  const pcm = await utterance(text);
  const step = 16000 * 0.04; // 40 ms
  for (let o = 0; o < pcm.length; o += step) {
    const slice = pcm.subarray(o, o + step);
    ws.send(Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength));
    await new Promise((r) => setTimeout(r, 40));
  }
  // The clock starts when the visitor stops talking, not when we stop sending.
  askedAt = Date.now();
  const silence = new Int16Array(step);
  for (let sent = 0; sent < TAIL_MS; sent += 40) {
    ws.send(Buffer.from(silence.buffer));
    await new Promise((r) => setTimeout(r, 40));
  }
}

const next = () => (SPEAK ? speak(script[turn++]) : type(script[turn++]));

ws.on("open", () => console.log(`connected to ${BASE} (${SPEAK ? "speaking" : "typing"})`));

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    audioBytes += data.byteLength ?? data.length;
    firstAudioAt ??= Date.now();
    return;
  }
  const msg = JSON.parse(data.toString());
  switch (msg.type) {
    case "ready":
      console.log(`ready — run ${msg.runId}, output ${msg.sampleRate} Hz`);
      break;
    case "transcript":
      if (msg.final && msg.role === "agent") console.log(`\x1b[33m< ${msg.text}\x1b[0m`);
      if (msg.final && msg.role === "user") console.log(`  (heard: ${msg.text})`);
      break;
    case "tool":
      if (msg.status !== "running") console.log(`  \x1b[35m[tool] ${msg.label} → ${msg.status}\x1b[0m`);
      break;
    case "navigate":
      console.log(`  \x1b[32m[page] → ${msg.path} (${msg.reason})\x1b[0m`);
      break;
    case "identity":
      console.log(`  \x1b[32m[lead] ${msg.name ?? "?"} / ${msg.phone10 ?? "no number"}\x1b[0m`);
      break;
    case "callback":
      console.log(`  \x1b[32m[call] dialing ${msg.phone10}\x1b[0m`);
      break;
    case "whatsapp":
      console.log(`  \x1b[32m[wa] template sent to ${msg.phone10}\x1b[0m`);
      break;
    case "turn_end": {
      if (firstAudioAt && askedAt) {
        const wait = firstAudioAt - askedAt;
        waits.push(wait);
        console.log(`  — \x1b[1m${wait} ms\x1b[0m before the visitor heard anything`);
      } else {
        console.log("  — greeting");
      }
      firstAudioAt = null;
      askedAt = null;
      if (turn < script.length) setTimeout(() => next(), 300);
      else setTimeout(() => ws.send(JSON.stringify({ type: "bye" })), 800);
      break;
    }
    case "error":
      console.log(`\x1b[31m[error] ${msg.message}\x1b[0m`);
      break;
    case "end":
      console.log(`\nsession ended: ${msg.reason}`);
      break;
    default:
      break;
  }
});

ws.on("close", () => {
  if (waits.length) {
    const avg = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
    console.log(`\nwaits: ${waits.join(", ")} ms   average ${avg} ms`);
  }
  console.log(`audio received: ${Math.round(audioBytes / 1024)} kB (~${Math.round(audioBytes / 48000)}s of speech)`);
  process.exit(0);
});
ws.on("error", (e) => {
  console.error("ws error:", e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error("timed out");
  process.exit(1);
}, 180_000);
