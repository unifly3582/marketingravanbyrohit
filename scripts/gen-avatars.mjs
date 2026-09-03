// Testimonial avatar portraits — warm editorial style matching the site palette.
import { generate } from './nanobanana.mjs'
import { mkdirSync } from 'node:fs'

const OUT = 'C:/Users/DELL/Downloads/theblossomgreen/bloom-green-landing/public/img'
mkdirSync(OUT, { recursive: true })

const STYLE =
  'Photorealistic warm editorial portrait, shoulders-up, soft golden window light, warm sand and terracotta toned plaster wall background, softly blurred, genuine natural smile, looking at camera, premium lifestyle magazine quality, natural skin texture.'

const jobs = [
  { out: 'av-palak.png', prompt: `${STYLE} An Indian woman in her late twenties with long dark hair, wearing a cream linen kurta, small gold earrings.` },
  { out: 'av-divya.png', prompt: `${STYLE} An Indian woman in her early thirties with shoulder-length wavy hair, wearing a soft olive-green top and a thin scarf.` },
  { out: 'av-venkatesh.png', prompt: `${STYLE} An Indian man in his mid thirties with short neat hair and trimmed beard, wearing a light beige cotton shirt.` },
  { out: 'av-sainy.png', prompt: `${STYLE} An Indian woman in her forties with hair tied back, wearing an elegant rust-orange cotton saree with a small bindi.` },
  { out: 'av-manish.png', prompt: `${STYLE} An Indian man in his late twenties with slightly wavy hair, wearing a casual white shirt, friendly relaxed expression.` },
]

for (const j of jobs) {
  process.stdout.write(`>> ${j.out} ... `)
  try {
    const { saved, finishReason } = await generate({ prompt: j.prompt, out: `${OUT}/${j.out}`, aspect: '1:1', size: '1K', ref: [] })
    console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 200)}`)
  }
}
console.log('done')
