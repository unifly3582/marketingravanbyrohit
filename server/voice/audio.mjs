// Audio plumbing for the voice pipeline: mulaw <-> PCM16, a minimal WAV
// wrapper, and an energy-based voice-activity detector.
//
// Vobiz sends caller audio as 8kHz mu-law (audio/x-mulaw) and wants replies
// back as raw linear16 (no WAV header). Sarvam's STT wants a WAV file; its TTS
// may or may not wrap its response in one. This module is the only place that
// knows any of that, so the rest of the voice pipeline just deals in PCM16
// Buffers and plain text.

// ---------------- mu-law <-> PCM16 ----------------

const MULAW_BIAS = 0x84;

/** One mu-law byte -> a signed 16-bit PCM sample (ITU-T G.711 reference decode). */
function muLawByteToPcm16(byte) {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  return sign ? -sample : sample;
}

/** Decode a Buffer of 8-bit mu-law samples into a Buffer of little-endian PCM16. */
export function mulawToPcm16(mulawBuf) {
  const out = Buffer.alloc(mulawBuf.length * 2);
  for (let i = 0; i < mulawBuf.length; i++) {
    out.writeInt16LE(muLawByteToPcm16(mulawBuf[i]), i * 2);
  }
  return out;
}

// ---------------- WAV wrapping ----------------

/** Wrap raw little-endian PCM16 mono audio in a 44-byte WAV header. */
export function wrapWav(pcm16Buf, sampleRate = 8000) {
  const header = Buffer.alloc(44);
  const dataLen = pcm16Buf.length;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLen, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (2 bytes/sample)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcm16Buf]);
}

/** Strip a RIFF/WAVE header if present, otherwise return the buffer unchanged. */
export function stripWavHeader(buf) {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return buf;
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") return buf.subarray(offset + 8, offset + 8 + chunkSize);
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return buf; // no data chunk found — hand back what we got
}

// ---------------- voice-activity detection ----------------

/**
 * Simple energy-based VAD over a stream of PCM16 chunks.
 *
 * Two independent thresholds because the two things it's used for have very
 * different tolerances: waiting for the caller to finish talking can afford a
 * few hundred ms of silence before deciding the turn is over, but noticing
 * that the caller has started talking *over* the agent (barge-in) needs to
 * fire on the first hint of speech, not after a confirmation window.
 */
export class VoiceActivityDetector {
  /**
   * @param {object} opts
   * @param {number} [opts.sampleRate]        PCM sample rate (Hz)
   * @param {number} [opts.frameMs]           analysis window size
   * @param {number} [opts.speechRms]         RMS above this = speech frame
   * @param {number} [opts.endOfTurnSilenceMs] trailing silence -> utterance ended
   * @param {number} [opts.minSpeechMs]       ignore utterances shorter than this (coughs, clicks)
   */
  constructor({
    sampleRate = 8000,
    frameMs = 20,
    speechRms = 500,
    endOfTurnSilenceMs = 650,
    minSpeechMs = 200,
  } = {}) {
    this.sampleRate = sampleRate;
    this.frameSamples = Math.round((sampleRate * frameMs) / 1000);
    this.speechRms = speechRms;
    this.endOfTurnSilenceFrames = Math.ceil(endOfTurnSilenceMs / frameMs);
    this.minSpeechFrames = Math.ceil(minSpeechMs / frameMs);
    this.reset();
  }

  reset() {
    this._tail = Buffer.alloc(0);
    this._speaking = false;
    this._silenceFrames = 0;
    this._speechFrames = 0;
    this._utterance = [];
  }

  static rms(pcm16Buf) {
    if (pcm16Buf.length < 2) return 0;
    let sum = 0;
    const n = pcm16Buf.length / 2;
    for (let i = 0; i < pcm16Buf.length; i += 2) {
      const s = pcm16Buf.readInt16LE(i);
      sum += s * s;
    }
    return Math.sqrt(sum / n);
  }

  /**
   * Feed one chunk of PCM16 audio. Returns events describing what happened,
   * so the caller can react (start buffering, flush an utterance, treat as
   * barge-in) without the detector knowing anything about calls or sockets.
   *
   * @param {Buffer} pcm16Chunk
   * @returns {{ speechStarted: boolean, utteranceEnded: Buffer|null, isSpeaking: boolean }}
   */
  push(pcm16Chunk) {
    let buf = Buffer.concat([this._tail, pcm16Chunk]);
    const frameBytes = this.frameSamples * 2;
    const usable = buf.length - (buf.length % frameBytes);
    this._tail = buf.subarray(usable);
    buf = buf.subarray(0, usable);

    let speechStarted = false;
    let utteranceEnded = null;

    for (let off = 0; off < buf.length; off += frameBytes) {
      const frame = buf.subarray(off, off + frameBytes);
      const loud = VoiceActivityDetector.rms(frame) >= this.speechRms;

      if (loud) {
        if (!this._speaking && this._speechFrames === 0) speechStarted = true;
        this._speaking = true;
        this._silenceFrames = 0;
        this._speechFrames++;
        this._utterance.push(frame);
      } else if (this._speaking) {
        this._silenceFrames++;
        this._utterance.push(frame); // keep trailing silence, it's natural speech
        if (this._silenceFrames >= this.endOfTurnSilenceFrames) {
          if (this._speechFrames >= this.minSpeechFrames) {
            utteranceEnded = Buffer.concat(this._utterance);
          }
          this._speaking = false;
          this._speechFrames = 0;
          this._silenceFrames = 0;
          this._utterance = [];
        }
      }
    }

    return { speechStarted, utteranceEnded, isSpeaking: this._speaking };
  }
}
