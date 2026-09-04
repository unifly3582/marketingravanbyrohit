// Microphone capture for the website voice agent.
//
// Runs on the audio thread, so it keeps feeding the socket while React
// re-renders, the main thread garbage-collects, or a heavy page animation is
// mid-frame. A ScriptProcessorNode would drop audio in exactly those moments,
// which the visitor hears as the agent mishearing them.
//
// Three jobs: resample to 16 kHz (what the Gemini Live API requires), compand
// to 8-bit G.711 µ-law, and batch into ~40 ms chunks. The worklet is handed 128
// frames at a time — roughly 2.7 ms at 48 kHz — and one WebSocket frame per
// 2.7 ms of speech is a lot of packets for no benefit.
//
// The µ-law step is why the agent stopped feeling slow on real connections.
// Raw 16 kHz PCM16 is 32 kB/s, i.e. 256 kbps of sustained *upload*. That is
// more than a lot of Indian mobile and home uplinks actually have — measured
// on one, 23 kB/s — so the microphone stream simply could not keep up, audio
// arrived progressively later than it was spoken, and every reply inherited
// the backlog. µ-law halves it to 128 kbps for a companding loss that speech
// recognition does not care about; it is what the phone network has used for
// this exact trade for fifty years. The server expands it back to PCM16
// before Gemini ever sees it.

const TARGET_RATE = 16000;
const CHUNK_MS = 40;

/**
 * One 16-bit sample to one G.711 µ-law byte.
 * Straight from the standard: clip, bias, then a sign/exponent/mantissa
 * packing that spends its resolution where speech actually lives.
 */
function toMuLaw(sample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global inside an AudioWorkletGlobalScope: the rate the
    // context actually got, which is not always the rate that was asked for.
    this.ratio = sampleRate / TARGET_RATE;
    this.chunkSamples = Math.round((TARGET_RATE * CHUNK_MS) / 1000);
    // One byte per sample, not two — see the µ-law note above.
    this.buffer = new Uint8Array(this.chunkSamples);
    this.filled = 0;
    // Fractional read position into the incoming block, carried across blocks
    // so resampling does not click at every 128-frame boundary.
    this.cursor = 0;
    this.running = true;
    this.port.onmessage = (e) => {
      if (e.data === "stop") this.running = false;
    };
  }

  process(inputs) {
    if (!this.running) return false;
    const input = inputs[0]?.[0];
    if (!input) return true; // no track yet, or a muted frame

    // Linear interpolation is enough here: the source is a mono voice track
    // that the browser has already band-limited, and the destination is a
    // speech model, not a mastering chain.
    for (; this.cursor < input.length; this.cursor += this.ratio) {
      const i = Math.floor(this.cursor);
      const frac = this.cursor - i;
      const a = input[i];
      const b = i + 1 < input.length ? input[i + 1] : a;
      const sample = a + (b - a) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      const pcm16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.buffer[this.filled++] = toMuLaw(pcm16 | 0);

      if (this.filled === this.chunkSamples) {
        // Transferred, not copied — the buffer is reallocated rather than
        // reused so the audio thread never blocks on the main thread.
        const out = this.buffer.buffer;
        this.port.postMessage(out, [out]);
        this.buffer = new Uint8Array(this.chunkSamples);
        this.filled = 0;
      }
    }
    this.cursor -= input.length;
    return true;
  }
}

registerProcessor("mic-capture", MicCapture);
