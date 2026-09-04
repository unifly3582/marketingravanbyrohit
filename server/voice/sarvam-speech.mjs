// Sarvam's plain speech APIs — STT (Saaras) and TTS (Bulbul) — used directly,
// not through the Conversatio/Samvaad hosted-agent product. This is what lets
// Gemini be the brain: we do our own turn-taking and only ask Sarvam to
// convert speech to text and text to speech.
//
// Auth: `SARVAM_API_KEY` if set, else falls back to `SARVAM_SAMVAAD_API_KEY`
// (the Conversatio key already configured) since it's unconfirmed whether
// that key also authorizes these endpoints — see STACK.md/plan open items.

import { stripWavHeader, wrapWav } from "./audio.mjs";

const env = (k, d) => process.env[k] ?? d;
const apiKey = () => env("SARVAM_API_KEY") ?? env("SARVAM_SAMVAAD_API_KEY");

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const STT_MODEL = "saaras:v4";
const TTS_MODEL = "bulbul:v3";

/**
 * Transcribe one caller utterance.
 * @param {Buffer} pcm16Buf  raw PCM16 mono audio (already decoded from mulaw)
 * @param {object} [opts]
 * @param {number} [opts.sampleRate]
 * @param {string} [opts.languageCode]  BCP-47-ish code (e.g. "hi-IN") or "unknown" to auto-detect
 * @returns {Promise<string>} the transcript, "" if nothing usable came back
 */
export async function transcribe(pcm16Buf, { sampleRate = 8000, languageCode = "unknown" } = {}) {
  const key = apiKey();
  if (!key) throw new Error("SARVAM_API_KEY (or SARVAM_SAMVAAD_API_KEY) not configured");

  const wav = wrapWav(pcm16Buf, sampleRate);
  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "caller.wav");
  form.append("model", STT_MODEL);
  form.append("mode", "codemix");
  form.append("language_code", languageCode);

  const res = await fetch(STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`sarvam STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return (data?.transcript ?? "").trim();
}

/**
 * Synthesize speech for one agent reply.
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.speaker]        Bulbul v3 speaker name
 * @param {string} [opts.languageCode]
 * @param {number} [opts.sampleRate]     must match what's declared to Vobiz's playAudio
 * @returns {Promise<Buffer>} raw little-endian PCM16 mono audio, no WAV header
 */
export async function synthesize(
  text,
  { speaker = env("SARVAM_TTS_SPEAKER", "priya"), languageCode = "en-IN", sampleRate = 8000 } = {}
) {
  const key = apiKey();
  if (!key) throw new Error("SARVAM_API_KEY (or SARVAM_SAMVAAD_API_KEY) not configured");

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      target_language_code: languageCode,
      speaker,
      model: TTS_MODEL,
      speech_sample_rate: sampleRate,
      output_audio_codec: "linear16",
    }),
  });
  if (!res.ok) {
    throw new Error(`sarvam TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.audios?.[0];
  if (!b64) throw new Error("sarvam TTS: no audio returned");
  return stripWavHeader(Buffer.from(b64, "base64"));
}
