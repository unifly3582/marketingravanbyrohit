#!/usr/bin/env node
/*
 * gemini-tts.mjs — natural voiceover with Gemini TTS (Interactions API),
 * same key as nanobanana.mjs. Writes a 24 kHz mono 16-bit WAV.
 *
 *   node scripts/gemini-tts.mjs "Fed up of your workers?" --out vo.wav --voice Charon \
 *        --note "Indian English male ad narrator, deep, confident, punchy"
 *
 * Flags: --out <wav>  --voice <name>  --note "<director's note>"  --model <id>
 * Voices: Charon (informative) Orus/Kore/Alnilam (firm) Algenib (gravelly) Gacrux (mature)
 *         Fenrir (excitable) Puck (upbeat) Sulafat (warm) … 30 total, see docs.
 * Inline tags in the text work: [excited] [serious] [whispers] [sighs] …
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview'

function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const f = join(__dirname, 'gemini-key.txt')
  if (existsSync(f)) return readFileSync(f, 'utf8').trim()
  throw new Error('No GEMINI_API_KEY and no scripts/gemini-key.txt')
}

function parseArgs(argv) {
  const a = { text: null, out: 'vo.wav', voice: 'Charon', note: null, model: DEFAULT_MODEL }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--out') a.out = argv[++i]
    else if (t === '--voice') a.voice = argv[++i]
    else if (t === '--note') a.note = argv[++i]
    else if (t === '--model') a.model = argv[++i]
    else if (!a.text) a.text = t
  }
  return a
}

function wav(pcm, rate = 24000, channels = 1) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

export async function speak({ text, out, voice = 'Charon', note, model = DEFAULT_MODEL }) {
  const key = getKey()
  const input = note ? `Director's note: ${note}\n\n${text}` : text
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice }] } }),
  })
  if (!r.ok) throw new Error(`tts ${r.status}: ${await r.text()}`)
  const d = await r.json()
  const part = d.steps?.flatMap((s) => s.content ?? []).find((c) => c.type === 'audio')
  if (!part) throw new Error(`no audio in response: ${JSON.stringify(d).slice(0, 600)}`)
  const rate = part.sample_rate ?? Number(/rate=(\d+)/.exec(part.mime_type ?? '')?.[1] ?? 24000)
  writeFileSync(out, wav(Buffer.from(part.data, 'base64'), rate, part.channels ?? 1))
  process.stderr.write(`[tts] ${voice} ${d.usage?.total_output_tokens ?? '?'} audio tokens → ${out}\n`)
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = parseArgs(process.argv.slice(2))
  if (!a.text) { console.error('usage: node scripts/gemini-tts.mjs "text" --out x.wav [--voice Charon] [--note "..."]'); process.exit(1) }
  speak(a).catch((e) => { console.error(e.message); process.exit(1) })
}
