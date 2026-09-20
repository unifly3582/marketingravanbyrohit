#!/usr/bin/env node
/*
 * veo.mjs — text/image-to-video with Google's Veo 3.1 through the Gemini API,
 * same key and base URL as nanobanana.mjs. Async: submits, polls, downloads.
 *
 *   node scripts/veo.mjs "prompt" --image still.png --out clip.mp4 --aspect 9:16 --duration 4
 *
 * Flags: --out <mp4>  --image <png|jpg>  --aspect 16:9|9:16  --duration 4|6|8
 *        --res 720p|1080p  --model fast|lite|standard|<full id>  --negative "<text>"
 * Key:   GEMINI_API_KEY env, else scripts/gemini-key.txt
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODELS = {
  fast: 'veo-3.1-fast-generate-preview',
  lite: 'veo-3.1-lite-generate-preview',
  standard: 'veo-3.1-generate-preview',
}

function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const f = join(__dirname, 'gemini-key.txt')
  if (existsSync(f)) return readFileSync(f, 'utf8').trim()
  throw new Error('No GEMINI_API_KEY and no scripts/gemini-key.txt')
}

function parseArgs(argv) {
  const a = { prompt: null, out: 'output.mp4', image: null, aspect: '9:16', duration: '4', res: '720p', model: 'fast', negative: null }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--out') a.out = argv[++i]
    else if (t === '--image') a.image = argv[++i]
    else if (t === '--aspect') a.aspect = argv[++i]
    else if (t === '--duration') a.duration = String(argv[++i])
    else if (t === '--res') a.res = argv[++i]
    else if (t === '--model') a.model = argv[++i]
    else if (t === '--negative') a.negative = argv[++i]
    else if (!a.prompt) a.prompt = t
  }
  return a
}

const mime = (p) => /\.jpe?g$/i.test(p) ? 'image/jpeg' : /\.webp$/i.test(p) ? 'image/webp' : 'image/png'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function generateVideo({ prompt, out, image, aspect = '9:16', duration = '4', res = '720p', model = 'fast', negative }) {
  const key = getKey()
  const modelId = MODELS[model] ?? model
  const instance = { prompt }
  if (image) instance.image = { bytesBase64Encoded: readFileSync(image).toString("base64"), mimeType: mime(image) }
  const parameters = { aspectRatio: aspect, resolution: res, durationSeconds: Number(duration) }
  if (negative) parameters.negativePrompt = negative

  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' }
  const submit = await fetch(`${BASE}/models/${modelId}:predictLongRunning`, {
    method: 'POST', headers, body: JSON.stringify({ instances: [instance], parameters }),
  })
  if (!submit.ok) throw new Error(`submit ${submit.status}: ${await submit.text()}`)
  const { name } = await submit.json()
  process.stderr.write(`[veo] ${modelId} ${aspect} ${duration}s ${res} → ${name}\n`)

  let op
  for (let i = 0; i < 90; i++) {
    await sleep(10_000)
    const r = await fetch(`${BASE}/${name}`, { headers: { 'x-goog-api-key': key } })
    if (!r.ok) throw new Error(`poll ${r.status}: ${await r.text()}`)
    op = await r.json()
    process.stderr.write(`[veo] ${i * 10 + 10}s ${op.done ? 'done' : 'rendering…'}\n`)
    if (op.done) break
  }
  if (!op?.done) throw new Error('timed out waiting for Veo')
  if (op.error) throw new Error(`veo error: ${JSON.stringify(op.error)}`)
  const resp = op.response
  const sample = resp?.generateVideoResponse?.generatedSamples?.[0]
  if (!sample) throw new Error(`no sample in response: ${JSON.stringify(resp).slice(0, 800)}`)
  const uri = sample.video.uri
  const dl = await fetch(uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' })
  if (!dl.ok) throw new Error(`download ${dl.status}`)
  writeFileSync(out, Buffer.from(await dl.arrayBuffer()))
  process.stderr.write(`[veo] saved ${out}\n`)
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = parseArgs(process.argv.slice(2))
  if (!a.prompt) { console.error('usage: node scripts/veo.mjs "prompt" [--image x.png] [--out x.mp4] ...'); process.exit(1) }
  generateVideo(a).catch((e) => { console.error(e.message); process.exit(1) })
}
