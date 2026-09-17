// Real-time time-stretch for the agent's voice: play it faster without
// raising the pitch.
//
// Gemini Live has no speaking-rate control, and simply resampling 24 kHz
// audio to play at 1.35x turns a woman's voice into a cartoon. This is a
// small WSOLA (waveform-similarity overlap-add): the signal is cut into
// 40 ms frames taken `rate` times further apart than they are laid down,
// each frame nudged by up to ±8 ms to line up with the tail of the previous
// one, and the two cross-faded. Pitch stays where it was; only the pace
// changes. Streaming: audio is pushed in as it arrives and comes out with
// about 50 ms of added latency.

const clamp16 = (v) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

export class TimeStretcher {
  /**
   * @param {object} opts
   * @param {number} [opts.rate]        1 = unchanged, 1.35 = 35% faster
   * @param {number} [opts.sampleRate]
   * @param {number} [opts.frameMs]     analysis window
   * @param {number} [opts.searchMs]    how far a frame may shift to line up
   */
  constructor({ rate = 1.35, sampleRate = 24000, frameMs = 40, searchMs = 8 } = {}) {
    this.rate = rate;
    this.W = Math.round((sampleRate * frameMs) / 1000); // window
    this.H = this.W >> 1; // synthesis hop = half a window (50% overlap)
    this.Sa = Math.round(this.H * rate); // analysis hop
    this.S = Math.round((sampleRate * searchMs) / 1000); // ± search range
    this.reset();
  }

  reset() {
    this.buf = new Float32Array(0);
    this.pos = 0;
    this.prevTail = null; // Float32Array(H): second half of the previous frame
  }

  /** Feed PCM16 mono; returns the PCM16 that is ready to play (may be empty). */
  push(pcm16) {
    if (this.rate === 1) return pcm16;
    const n = pcm16.length >> 1;
    const joined = new Float32Array(this.buf.length + n);
    joined.set(this.buf);
    for (let i = 0; i < n; i++) joined[this.buf.length + i] = pcm16.readInt16LE(i * 2);
    this.buf = joined;

    const out = [];
    const { W, H, Sa, S } = this;
    while (this.pos + S + W <= this.buf.length) {
      let start = this.pos;
      if (this.prevTail) {
        // Best alignment of this frame's first half with the previous tail.
        let best = -Infinity;
        let bestD = 0;
        for (let d = -S; d <= S; d += 2) {
          const off = this.pos + d;
          if (off < 0) continue;
          let dot = 0;
          let energy = 1e-6;
          for (let i = 0; i < H; i++) {
            const b = this.buf[off + i];
            dot += this.prevTail[i] * b;
            energy += b * b;
          }
          const score = dot / Math.sqrt(energy);
          if (score > best) {
            best = score;
            bestD = d;
          }
        }
        start = this.pos + bestD;
      }
      const frame = this.buf.subarray(start, start + W);
      const hop = new Int16Array(H);
      if (this.prevTail) {
        for (let i = 0; i < H; i++) {
          const t = i / H;
          hop[i] = clamp16(Math.round(this.prevTail[i] * (1 - t) + frame[i] * t));
        }
      } else {
        for (let i = 0; i < H; i++) hop[i] = clamp16(Math.round(frame[i]));
      }
      out.push(Buffer.from(hop.buffer, hop.byteOffset, hop.byteLength));
      this.prevTail = Float32Array.from(frame.subarray(H, W));
      this.pos += Sa;
    }
    // Drop consumed input, keeping what the search may still look back at.
    const keep = Math.max(0, this.pos - S);
    if (keep > 0) {
      this.buf = this.buf.slice(keep);
      this.pos -= keep;
    }
    return out.length ? Buffer.concat(out) : Buffer.alloc(0);
  }

  /** End of an utterance: play out what is left, then start clean. */
  flush() {
    if (this.rate === 1) return Buffer.alloc(0);
    const parts = [];
    if (this.prevTail) {
      const tail = new Int16Array(this.prevTail.length);
      for (let i = 0; i < tail.length; i++) tail[i] = clamp16(Math.round(this.prevTail[i]));
      parts.push(Buffer.from(tail.buffer, tail.byteOffset, tail.byteLength));
    }
    const rest = this.buf.subarray(this.pos);
    if (rest.length) {
      const r = new Int16Array(rest.length);
      for (let i = 0; i < rest.length; i++) r[i] = clamp16(Math.round(rest[i]));
      parts.push(Buffer.from(r.buffer, r.byteOffset, r.byteLength));
    }
    this.reset();
    return parts.length ? Buffer.concat(parts) : Buffer.alloc(0);
  }
}
