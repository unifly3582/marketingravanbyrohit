// One-off test: exercise STT -> Gemini brain -> TTS end-to-end on a local WAV
// file, with no telephony involved. Proves the pipeline works before Vobiz
// credentials exist, and is the fastest way to debug a bad answer without
// placing a real call.
//
//   node test-voice-turn.mjs ./sample-question.wav 9876543210
//
// The WAV should be 8kHz mono PCM16 (record with e.g. `ffmpeg -ar 8000 -ac 1`).
// Writes <input>.reply.wav next to the input with the agent's spoken answer.
import "./env.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { stripWavHeader, wrapWav } from "./voice/audio.mjs";
import { transcribe, synthesize } from "./voice/sarvam-speech.mjs";
import { runAgent } from "./agent/whatsapp-agent.mjs";

const [, , wavPath, phoneArg] = process.argv;
if (!wavPath) {
  console.error("Usage: node test-voice-turn.mjs <path-to-8kHz-mono-wav> [10-digit-phone]");
  process.exit(1);
}
const p10 = (phoneArg ?? "9999999999").replace(/\D/g, "").slice(-10);

const pcm16 = stripWavHeader(readFileSync(wavPath));

console.log("Transcribing...");
const transcript = await transcribe(pcm16);
console.log("  ->", transcript || "(empty)");
if (!transcript) process.exit(1);

console.log("Running agent (channel: voice)...");
const result = await runAgent({ channel: "voice", phone10: p10, text: transcript, trigger: "manual" });
console.log("  reply:     ", result.reply || "(none)");
console.log("  status:    ", result.status);
console.log("  escalated: ", result.escalated);
console.log("  endCall:   ", result.endCall);
console.log("  runId:     ", result.runId, "(see /admin agent runs, or agent_runs table)");

if (result.reply) {
  console.log("Synthesizing reply...");
  const pcmOut = await synthesize(result.reply);
  const outPath = wavPath.replace(/\.wav$/i, "") + ".reply.wav";
  writeFileSync(outPath, wrapWav(pcmOut, 8000));
  console.log("  wrote", outPath);
}
