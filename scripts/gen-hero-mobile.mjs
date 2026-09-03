// Portrait hero for mobile — same products & warm editorial style, composed for a
// text-panel-above / image-below layout.
import { generate } from './nanobanana.mjs'

const ROOT = 'C:/Users/DELL/Downloads/theblossomgreen'
const IMG = `${ROOT}/images/products`

const { saved, finishReason } = await generate({
  out: `${ROOT}/bloom-green-landing/public/img/hero-mobile.png`,
  aspect: '3:4',
  size: '2K',
  ref: [
    `${ROOT}/test-out/jade-bottle-crop.png`,
    `${IMG}/lavender-scented-candle-100gm-relaxing-aromatherapy-soy-wax-candle-long-lasting-floral-home-fragrance-candle-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_36_55_PM.png`,
    `${IMG}/citrus-camphor-cone-60gm-natural-camphor-air-freshener-cones-with-refreshing-citrus-aroma-long-lasting-home-prayer-room-freshener-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_52_30_PM.png`,
  ],
  prompt:
    'Photorealistic warm editorial product photography, portrait composition for a mobile phone screen. The exact Bloom Green spray bottle, the exact blue Lavender Haze candle with wooden lid, and the exact yellow Citrus Spark camphor pouch from the reference images, arranged in a tight elegant cluster at different heights on stacked travertine stone blocks, centered in the lower two-thirds of the frame, against a warm clay-plaster wall in terracotta and sand tones, hard golden sunlight casting crisp olive-branch shadows across the upper wall, a dried grass stem to one side, sun-baked Mediterranean mood, keep every product label EXACTLY as in the references.',
})
console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
