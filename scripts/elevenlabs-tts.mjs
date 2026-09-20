#!/usr/bin/env node
/*
 * elevenlabs-tts.mjs — voiceover with ElevenLabs (eleven_v3 by default).
 * Writes MP3 (44.1 kHz, 128 kbps). Audio tags like [confident] [teasing]
 * [whispers] [sighs] work with eleven_v3.
 *
 *   node scripts/elevenlabs-tts.mjs "Fed up of your workers?" --out vo.mp3 --voice 43EwOfIMJShg3J9RLxZJ
 *
 * Flags: --out <mp3>  --voice <voice_id>  --model <id>  --stability 0|0.5|1
 * Key:   ELEVENLABS_API_KEY env, else scripts/elevenlabs-key.txt
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VOICES = {
  boss: '43EwOfIMJShg3J9RLxZJ',   // Muthu's Boss – South Indian storyteller, middle-aged, confident
  sam: 'hyfnu3H2biW7xNFFVMIa',    // Sam – Indian casual explainer
  kumaran: 'rgltZvTfiMmgWweZhh7n',
  adam: 'pNInz6obpgDQGcFmaJgB',
  brian: 'nPczCjzI2devNBz1zQrb',
}

function getKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  const f = join(__dirname, 'elevenlabs-key.txt')
  if (existsSync(f)) return readFileSync(f, 'utf8').trim()
  throw new Error('No ELEVENLABS_API_KEY and no scripts/elevenlabs-key.txt')
}

function parseArgs(argv) {
  const a = { text: null, out: 'vo.mp3', voice: 'boss', model: 'eleven_v3', stability: null }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--out') a.out = argv[++i]
    else if (t === '--voice') a.voice = argv[++i]
    else if (t === '--model') a.model = argv[++i]
    else if (t === '--stability') a.stability = Number(argv[++i])
    else if (!a.text) a.text = t
  }
  return a
}

export async function speak({ text, out, voice = 'boss', model = 'eleven_v3', stability = null }) {
  const key = getKey()
  const id = VOICES[voice] ?? voice
  const body = { text, model_id: model }
  if (stability !== null) body.voice_settings = { stability, similarity_boost: 0.8 }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${await r.text()}`)
  writeFileSync(out, Buffer.from(await r.arrayBuffer()))
  process.stderr.write(`[11labs] ${voice} ${model} ${text.length} chars → ${out}\n`)
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = parseArgs(process.argv.slice(2))
  if (!a.text) { console.error('usage: node scripts/elevenlabs-tts.mjs "text" --out x.mp3 [--voice boss|sam|<id>]'); process.exit(1) }
  speak(a).catch((e) => { console.error(e.message); process.exit(1) })
}
