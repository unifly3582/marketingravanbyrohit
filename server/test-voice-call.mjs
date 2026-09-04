// One-off test: place a real outbound call through our own Vobiz + Sarvam +
// Gemini voice pipeline (not Sarvam's Conversatio product).
//
//   node test-voice-call.mjs 9876543210
//
// Watch this process's console for STT/brain/TTS logs, and /admin's Calls
// tab for the transcript once the call ends.
import "./env.mjs";
import { dialOut } from "./voice/index.mjs";

const raw = process.argv[2];
if (!raw) {
  console.error("Usage: node test-voice-call.mjs <10-digit-number>");
  process.exit(1);
}
const p10 = raw.replace(/\D/g, "").slice(-10);

try {
  const attemptId = await dialOut(p10, { source: "manual-test" });
  console.log("Dialed. attempt_id:", attemptId);
} catch (err) {
  console.error("Dial failed:", err.message);
  process.exit(1);
}
