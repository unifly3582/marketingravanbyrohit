#!/usr/bin/env node
/*
 * nanobanana.mjs — directed image generation with Google's Gemini image models,
 * using plain Node (v18+ global fetch). A drop-in for nanobanana.py when Python
 * isn't installed on Windows.
 *
 *   node scripts/nanobanana.mjs "a tin of dog food, studio lit" --out public/images/x.png
 *
 * Flags: --out <path>  --model <id>  --aspect 1:1  --size 1K  --ref <img> [--ref ...]
 * Key:   reads GEMINI_API_KEY, else scripts/gemini-key.txt
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_MODEL = 'gemini-3.1-flash-image'

function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const keyFile = join(__dirname, 'gemini-key.txt')
  if (existsSync(keyFile)) return readFileSync(keyFile, 'utf8').trim()
  throw new Error('No GEMINI_API_KEY env var and no scripts/gemini-key.txt')
}

function parseArgs(argv) {
  const a = { prompt: null, out: 'output.png', model: DEFAULT_MODEL, aspect: null, size: null, ref: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--out') a.out = argv[++i]
    else if (t === '--model') a.model = argv[++i]
    else if (t === '--aspect') a.aspect = argv[++i]
    else if (t === '--size') a.size = argv[++i]
    else if (t === '--ref') a.ref.push(argv[++i])
    else if (!a.prompt) a.prompt = t
  }
  return a
}

function guessMime(path) {
  const p = path.toLowerCase()
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

export async function generate({ prompt, out, model = DEFAULT_MODEL, aspect, size, ref = [] }) {
  const key = getKey()
  const parts = [{ text: prompt }]
  for (const r of ref) {
    const buf = readFileSync(r)
    parts.push({ inlineData: { mimeType: guessMime(r), data: buf.toString('base64') } })
  }
  const imageConfig = {}
  if (aspect) imageConfig.aspectRatio = aspect
  if (size) imageConfig.imageSize = size

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 800)}`)
  }
  const json = await res.json()
  const cand = json?.candidates?.[0]
  const respParts = cand?.content?.parts || []
  let saved = null
  const texts = []
  for (const part of respParts) {
    if (part.text) texts.push(part.text.trim())
    else if (part.inlineData?.data) {
      writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'))
      saved = out
    }
  }
  return { saved, texts, finishReason: cand?.finishReason, raw: json }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('nanobanana.mjs')) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.prompt) {
    console.error('Give a prompt. e.g. node scripts/nanobanana.mjs "a dog" --out out.png --aspect 1:1 --size 1K')
    process.exit(1)
  }
  try {
    const { saved, texts, finishReason } = await generate(args)
    if (texts.length) console.log('[model]', texts.join(' '))
    if (saved) console.log('Saved:', saved)
    else console.log('No image returned. finishReason:', finishReason)
  } catch (e) {
    console.error('ERROR:', e.message)
    process.exit(1)
  }
}
