// Smoke test for the website voice agent, without a browser.
//
// Connects to the same WebSocket the site uses, talks to the agent in text
// (the accessibility path, which drives the identical loop), and prints what
// comes back: transcripts, tool calls, navigation, and how much audio arrived.
//
//   node test-web-voice.mjs "what do you charge for a whatsapp agent?"

import "./env.mjs";
import WebSocket from "ws";

const BASE = process.env.TEST_WS_BASE ?? "ws://localhost:8787";
const lines = process.argv.slice(2);
const script = lines.length
  ? lines
  : [
      "Hi, what does Marketing Ravan actually do?",
      "Show me the voice agent page and tell me what it costs.",
      "My name is Rahul, my number is 9876543210.",
      "Thanks, that's all for now. Bye!",
    ];

const ws = new WebSocket(`${BASE}/api/voice/web?page=/`);
let audioBytes = 0;
let turn = 0;
let firstAudioAt = null;
let sentAt = null;

const say = (text) => {
  sentAt = Date.now();
  console.log(`\n\x1b[36m> ${text}\x1b[0m`);
  ws.send(JSON.stringify({ type: "text", text }));
};

ws.on("open", () => console.log("connected, waiting for the agent to greet…"));

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    audioBytes += data.length;
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
      const latency = firstAudioAt && sentAt ? `${firstAudioAt - sentAt} ms to first audio` : "greeting";
      console.log(`  — turn complete (${latency}, ${Math.round(audioBytes / 1024)} kB audio so far)`);
      firstAudioAt = null;
      if (turn < script.length) setTimeout(() => say(script[turn++]), 400);
      else setTimeout(() => ws.send(JSON.stringify({ type: "bye" })), 1000);
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
  console.log(`total audio: ${Math.round(audioBytes / 1024)} kB (24 kHz PCM16 = ~${Math.round(audioBytes / 48000)}s of speech)`);
  process.exit(0);
});
ws.on("error", (e) => {
  console.error("ws error:", e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error("timed out");
  process.exit(1);
}, 120_000);
