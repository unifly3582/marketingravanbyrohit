// Microphone capture for the website voice agent.
//
// Runs on the audio thread, so it keeps feeding the socket while React
// re-renders, the main thread garbage-collects, or a heavy page animation is
// mid-frame. A ScriptProcessorNode would drop audio in exactly those moments,
// which the visitor hears as the agent mishearing them.
//
// Does two things and nothing else: resample to 16 kHz (what the Gemini Live
// API requires) and batch into ~40 ms chunks. The worklet is handed 128 frames
// at a time — roughly 2.7 ms at 48 kHz — and one WebSocket frame per 2.7 ms of
// speech is a lot of packets for no benefit.

const TARGET_RATE = 16000;
const CHUNK_MS = 40;

class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global inside an AudioWorkletGlobalScope: the rate the
    // context actually got, which is not always the rate that was asked for.
    this.ratio = sampleRate / TARGET_RATE;
    this.chunkSamples = Math.round((TARGET_RATE * CHUNK_MS) / 1000);
    this.buffer = new Int16Array(this.chunkSamples);
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
      this.buffer[this.filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.filled === this.chunkSamples) {
        // Transferred, not copied — the buffer is reallocated rather than
        // reused so the audio thread never blocks on the main thread.
        const out = this.buffer.buffer;
        this.port.postMessage(out, [out]);
        this.buffer = new Int16Array(this.chunkSamples);
        this.filled = 0;
      }
    }
    this.cursor -= input.length;
    return true;
  }
}

registerProcessor("mic-capture", MicCapture);
