import { SarvamAIClient } from "sarvamai";
import { writeFileSync } from "node:fs";

const key = process.env.SARVAM_API_KEY;
if (!key) {
  console.error("SARVAM_API_KEY not set");
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: key });

try {
  const res = await client.textToSpeech.convert({
    text: "Namaste! Marketing Ravan mein aapka swagat hai.",
    target_language_code: "hi-IN",
    speaker: "priya",
    model: "bulbul:v3",
  });
  const audio = res.audios?.[0];
  if (!audio) {
    console.error("No audio in response:", JSON.stringify(res).slice(0, 300));
    process.exit(1);
  }
  writeFileSync("sarvam-test.wav", Buffer.from(audio, "base64"));
  console.log("OK — API key works. Audio saved: sarvam-test.wav,", Buffer.from(audio, "base64").length, "bytes");
} catch (err) {
  console.error("API call failed:", err.statusCode ?? "", err.message ?? err);
  if (err.body) console.error("Body:", JSON.stringify(err.body).slice(0, 500));
  process.exit(1);
}
