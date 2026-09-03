// Batch-generate the landing page imagery with nanobanana (Gemini image gen).
// Run: node scripts/gen-images.mjs
import { generate } from './nanobanana.mjs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'C:/Users/DELL/Downloads/theblossomgreen'
const IMG = `${ROOT}/images/products`
const OUT = `${ROOT}/bloom-green-landing/public/img`
mkdirSync(OUT, { recursive: true })

const REF = {
  jade: `${ROOT}/test-out/jade-bottle-crop.png`,
  jasmine: `${IMG}/divine-jasmine-natural-air-freshener-spray-refreshing-floral-aroma-100ml/01-1_a64a1b69-9f9d-4b47-a1a8-bf83b2baea5a.png`,
  orange: `${IMG}/orange-bliss-natural-air-freshener-spray-citrusy-fresh-room-fragrance-100ml/01-1_46d53975-a8d7-4efd-b8c4-f70f17cfbdff.png`,
  temple: `${IMG}/buy-temple-essence-air-freshener-100ml-get-jade-breeze-air-freshener-100ml-free-bloom-green-combo-offer/01-1_45e2ba1b-326d-4abb-838a-8cf72312abb1.png`,
  candle: `${IMG}/lavender-scented-candle-100gm-relaxing-aromatherapy-soy-wax-candle-long-lasting-floral-home-fragrance-candle-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_36_55_PM.png`,
  cone: `${IMG}/citrus-camphor-cone-60gm-natural-camphor-air-freshener-cones-with-refreshing-citrus-aroma-long-lasting-home-prayer-room-freshener-by-bloom-green/01-ChatGPT_Image_May_31_2026_12_52_30_PM.png`,
  cargel: `${IMG}/forest-breeze-car-gel-freshener-40gm-natural-woody-car-perfume-gel-long-lasting-fresh-forest-dashboard-air-freshener-by-bloom-green/01-7_ddb7db25-2c8f-4dd2-a3f1-a23b8b726d75.png`,
}

const STYLE = 'Photorealistic premium product photography, soft diffused natural light, editorial magazine quality, muted botanical palette of deep forest green, cream and warm sand. Keep the product bottle, its label text and Bloom Green branding EXACTLY as in the reference image — do not alter, redraw or invent label text.'

const jobs = [
  {
    out: 'hero.png', aspect: '16:9', ref: [REF.jade],
    prompt: `${STYLE} Wide hero banner: this exact Bloom Green Jade Breeze spray bottle standing on a low travertine stone pedestal, right of frame, surrounded by eucalyptus sprigs and a fine mist of water droplets in the air, deep forest-green softly blurred backdrop with gentle window light, generous empty space on the left half for headline text, luxurious calm spa mood.`,
  },
  {
    out: 'cat-room.png', aspect: '4:5', ref: [REF.jasmine],
    prompt: `${STYLE} This exact Bloom Green Divine Jasmine room spray bottle on a cream marble shelf beside a small brass tray with fresh white jasmine flowers, soft cream linen curtain background, morning sunbeam, cozy modern home vignette.`,
  },
  {
    out: 'cat-car.png', aspect: '4:5', ref: [REF.cargel],
    prompt: `${STYLE} This exact Bloom Green Forest Breeze car gel freshener jar placed on a modern car dashboard near the windscreen, blurred green trees through the glass, warm sunlight flare, premium automotive lifestyle shot.`,
  },
  {
    out: 'cat-candle.png', aspect: '4:5', ref: [REF.candle],
    prompt: `${STYLE} This exact Bloom Green Lavender Haze candle with its wooden lid set aside and wick softly lit, on a rustic oak side table with dried lavender stems and a linen throw, dusky evening hygge mood, warm glow.`,
  },
  {
    out: 'cat-cone.png', aspect: '4:5', ref: [REF.cone],
    prompt: `${STYLE} This exact Bloom Green Citrus Spark camphor pouch and box arranged on a carved wooden tray with a small brass diya lamp and fresh lemons, serene Indian prayer-room corner, soft incense haze in sunlight.`,
  },
  {
    out: 'story-kannauj.png', aspect: '4:3', ref: [],
    prompt: `Photorealistic documentary photograph, warm golden light: a traditional attar distillery in Kannauj India, artisan hands pouring fresh rose and jasmine petals into a large copper deg vessel over a wood fire, clay pots and glass bottles of essential oil nearby, steam rising, heritage craft atmosphere, earthy tones of copper, clay and cream.`,
  },
  {
    out: 'ingredients.png', aspect: '4:3', ref: [],
    prompt: `Photorealistic overhead flat-lay on cream linen: fresh cucumber slices, a beetroot cut open, carrots, sprigs of lavender, jasmine flowers, lemongrass stalks, and two small amber glass droppers of essential oil, arranged in an elegant loose circle, soft natural window light, deep green and cream styling, botanical apothecary mood.`,
  },
  {
    out: 'petsafe.png', aspect: '4:3', ref: [REF.jade],
    prompt: `${STYLE} A golden retriever and a grey cat dozing together on a cream sofa in a bright plant-filled living room, this exact Bloom Green spray bottle standing on the wooden side table in sharp focus in the foreground, airy and joyful family-home feeling.`,
  },
  {
    out: 'prod-jade.png', aspect: '4:5', ref: [REF.jade],
    prompt: `${STYLE} Clean e-commerce studio shot: this exact Bloom Green Jade Breeze spray bottle centered on a small round cream plaster pedestal, seamless warm ivory background, one soft leaf shadow falling across the backdrop, crisp focus.`,
  },
  {
    out: 'prod-jasmine.png', aspect: '4:5', ref: [REF.jasmine],
    prompt: `${STYLE} Clean e-commerce studio shot: this exact Bloom Green Divine Jasmine spray bottle centered on a small round cream plaster pedestal with two white jasmine blossoms at its base, seamless warm ivory background, soft leaf shadow, crisp focus.`,
  },
  {
    out: 'prod-orange.png', aspect: '4:5', ref: [REF.orange],
    prompt: `${STYLE} Clean e-commerce studio shot: this exact Bloom Green Orange Bliss spray bottle centered on a small round cream plaster pedestal with a fresh orange slice leaning at its base, seamless warm ivory background, soft leaf shadow, crisp focus.`,
  },
  {
    out: 'prod-temple.png', aspect: '4:5', ref: [REF.temple],
    prompt: `${STYLE} Clean e-commerce studio shot: these exact two Bloom Green air freshener bottles from the reference standing side by side on a cream plaster pedestal, seamless warm ivory background, soft leaf shadow, crisp focus, duo combo presentation.`,
  },
]

for (const j of jobs) {
  const dest = join(OUT, j.out)
  process.stdout.write(`>> ${j.out} ... `)
  try {
    const { saved, finishReason } = await generate({ prompt: j.prompt, out: dest, aspect: j.aspect, size: '2K', ref: j.ref })
    console.log(saved ? 'OK' : `NO IMAGE (${finishReason})`)
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 200)}`)
  }
}
console.log('done')
