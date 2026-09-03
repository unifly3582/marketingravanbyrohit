// Round 2: warm editorial hero imagery for the redesigned theme.
import { generate } from './nanobanana.mjs'

const ROOT = 'C:/Users/DELL/Downloads/theblossomgreen'
const IMG = `${ROOT}/images/products`
const OUT = `${ROOT}/bloom-green-landing/public/img`

const jobs = [
  {
    out: `${OUT}/hero-warm.png`,
    aspect: '16:9',
    ref: [
      `${ROOT}/test-out/jade-bottle-crop.png`,
      `${IMG}/lavender-scented-candle-100gm-relaxing-aromatherapy-soy-wax-candle-long-lasting-floral-home-fragrance-candle-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_36_55_PM.png`,
      `${IMG}/citrus-camphor-cone-60gm-natural-camphor-air-freshener-cones-with-refreshing-citrus-aroma-long-lasting-home-prayer-room-freshener-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_52_30_PM.png`,
    ],
    prompt:
      'Photorealistic warm editorial product photography. The exact Bloom Green spray bottle, the exact blue Lavender Haze candle with wooden lid, and the exact yellow Citrus Spark camphor pouch from the reference images, arranged at different heights on stacked travertine stone blocks, against a warm clay-plaster wall in terracotta and sand tones, hard golden sunlight casting crisp olive-branch shadows across the wall, a sprig of dried grass to one side, generous negative space on the left for headline text, fashion-magazine still life, keep every product label EXACTLY as in the references.',
  },
  {
    out: `${OUT}/marquee.png`,
    aspect: '21:9',
    ref: [
      `${IMG}/divine-jasmine-natural-air-freshener-spray-refreshing-floral-aroma-100ml/01-1_a64a1b69-9f9d-4b47-a1a8-bf83b2baea5a.png`,
      `${IMG}/orange-bliss-natural-air-freshener-spray-citrusy-fresh-room-fragrance-100ml/01-1_46d53975-a8d7-4efd-b8c4-f70f17cfbdff.png`,
      `${ROOT}/test-out/jade-bottle-crop.png`,
    ],
    prompt:
      'Photorealistic ultra-wide warm editorial banner: the exact three Bloom Green spray bottles from the reference images standing in a row on a long sand-toned stone ledge, warm beige seamless background with soft hard-light shadows falling diagonally, small scattered jasmine flowers and an orange slice between the bottles, dried wheat stems at the edges, sun-baked Mediterranean mood in sand, terracotta and olive tones, keep every product label EXACTLY as in the references.',
  },
]

for (const j of jobs) {
  process.stdout.write(`>> ${j.out.split('/').pop()} ... `)
  try {
    const { saved, finishReason } = await generate({ prompt: j.prompt, out: j.out, aspect: j.aspect, size: '2K', ref: j.ref })
    console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 200)}`)
  }
}
console.log('done')
