// NORA-style hero: one product, stone plinth, vast plaster wall for the giant wordmark.
import { generate } from './nanobanana.mjs'

const ROOT = 'C:/Users/DELL/Downloads/theblossomgreen'
const OUT = `${ROOT}/bloom-green-landing/public/img`
const REF = [`${ROOT}/test-out/jade-bottle-crop.png`]

const BASE =
  'Photorealistic minimalist editorial product photography. The exact Bloom Green Jade Breeze spray bottle from the reference, standing alone on a raw travertine stone plinth, centered in the lower third of the frame, vast empty warm greige-sand plaster wall behind with a soft daylight gradient and one faint delicate olive-branch shadow in the upper corner, enormous calm negative space above the bottle reserved for typography, muted warm neutrals, quiet luxury, keep the product label EXACTLY as in the reference.'

const jobs = [
  { out: `${OUT}/nora-wide.png`, aspect: '16:9', prompt: BASE },
  { out: `${OUT}/nora-tall.png`, aspect: '3:4', prompt: BASE },
]

for (const j of jobs) {
  process.stdout.write(`>> ${j.out.split('/').pop()} ... `)
  try {
    const { saved, finishReason } = await generate({ prompt: j.prompt, out: j.out, aspect: j.aspect, size: '2K', ref: REF })
    console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 200)}`)
  }
}
console.log('done')
