#!/usr/bin/env node
/*
 * gen-webdev.mjs — pictures for the Website Development story page
 * (site/src/pages/WebsiteDev.jsx), generated with nano banana (Gemini image).
 *
 *   node scripts/gen-webdev.mjs            # everything that is missing
 *   node scripts/gen-webdev.mjs wall       # one set
 *   node scripts/gen-webdev.mjs wall ev    # one image
 *   FORCE=1 node scripts/gen-webdev.mjs    # regenerate existing ones
 *
 * Output: assets-src/webdev/<set>-<key>.png, then
 *   python scripts/webdev-to-webp.py
 * writes site/src/assets/webdev/<set>-<key>.webp for the page to import.
 *
 * Sets: wall  — tall 9:16 phone captures of futuristic websites (the wall of work)
 *       card  — square illustrations for the sticker stack
 *       detail — the one photo that grows behind "in every detail"
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generate } from './nanobanana.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'assets-src', 'webdev')

const STYLE = `Futuristic, premium web design in the Linear / Apple / Vercel school, dark mode: near-black background (#0d0907 family),
warm amber-gold (#F0A32F) and ember-orange (#E2571E) accents, soft glows, thin hairline grid, glassy translucent panels,
refined grotesque typography, generous spacing. Pixel-crisp, flat, front-on capture. No device frame, no browser chrome, no hands,
no perspective, no watermark, no real company logos, no lorem ipsum, only short correctly spelled English labels.`

const SETS = {
  wall: {
    aspect: '9:16',
    frame: `Tall 9:16 capture of a mobile website screen (top of the page at the top: small nav, hero, then one or two sections). ${STYLE}`,
    items: {
      ev: `An electric scooter brand "Volt". Hero: a sleek matte-black scooter with amber underglow on a dark studio floor, headline "Silent. Electric. Yours.", a "Book a test ride" pill button, a spec row "120 km range · 0-40 in 3.2 s".`,
      fintech: `A fintech app site "Paisa". Hero: a floating glass card showing a balance "₹2,48,900" with a rising gold sparkline, headline "Money that moves at your speed", two feature chips "Instant UPI" and "Zero-fee FD".`,
      villa: `A luxury real-estate site "Meridian". Hero: night render of a glass villa with warm interior light on a hillside, headline "Homes with room to breathe", a "View residences" button, a row of three small project thumbnails with prices.`,
      skincare: `A skincare brand "Aura" with a light cream theme instead of dark: a serum bottle in amber glass on a pale stone plinth, soft daylight, headline "Glow, backed by science", an "Add to bag ₹1,499" button, three ingredient icons.`,
      saas: `A SaaS analytics product "Signal": a dark dashboard preview in the hero with a glowing amber area chart and KPI tiles "Revenue ₹48.2L", "Churn 1.8%", headline "See what your customers do next", a "Start free" button.`,
      restaurant: `A fine-dining restaurant "Ember & Oak": moody close-up of a plated dish with fire-charred edges and a gold rim plate, headline "Fire, smoke and season", a "Reserve a table" button, tonight's menu list with prices.`,
      fashion: `A streetwear drop site "Roadhouse": an Indian model in an oversized black hoodie under amber studio light, oversized condensed headline "DROP 07 IS LIVE", a countdown "02:14:09", product grid of two hoodies with prices.`,
      travel: `A travel company "Northbound": aerial photo of a Himalayan valley at golden hour, headline "Go where the map goes quiet", a search bar "Where to?", three trip cards with prices.`,
      clinic: `A clinic site "Bright Dental" with a light theme: a smiling dentist in a modern clinic, headline "Gentle dentistry, same-day slots", a "Book now" button and a small date-picker widget, star rating "4.9 · 1,200 reviews".`,
      coaching: `A coaching institute "Ascend": a confident young Indian woman with a laptop in a glass-walled classroom, headline "Crack it this year", a "Join the batch" button, a stats row "12,000 students · 94% pass".`,
      jewellery: `A jewellery brand "Aarna": macro shot of a gold and emerald necklace on black velvet with warm light, serif headline "Heirlooms, reimagined", a "Explore the collection" button, a grid of four rings.`,
      architecture: `An architecture studio "Studio Bhoomi": a concrete-and-timber house at dusk with warm windows, thin uppercase headline "SPACES THAT BREATHE", a "See the work" link, a two-column project list.`,
    },
  },
  card: {
    aspect: '1:1',
    frame: `Square 3D-render illustration, single hero object centred on a plain near-black background with a soft amber floor glow, studio light,
polished glass and brushed gold materials, subtle depth of field. ${STYLE} No text at all.`,
    items: {
      window: `A floating glassy browser window with rounded corners, a tiny amber traffic-light dots row, a glowing wireframe layout inside it, and small floating gold cubes around it.`,
      speed: `A glowing amber speedometer dial pegged to the maximum, motion streaks of light trailing off it, a small gold lightning bolt.`,
      bag: `A translucent glass shopping bag with a glowing gold price tag and floating rupee coins around it.`,
      orb: `A softly glowing amber AI orb with a chat bubble made of glass beside it, tiny light particles.`,
      crown: `A polished gold crown with a thin halo of light behind it, resting on a black glass plinth.`,
    },
  },
  detail: {
    aspect: '3:4',
    frame: `Photorealistic editorial photograph, tall 3:4 crop, shallow depth of field, cinematic amber and ember rim light, dark studio.`,
    items: {
      hand: `Extreme close-up of a designer's hand holding a slim stylus, drawing on a glowing holographic interface that floats above a dark glass desk; thin gold UI lines and a wireframe website layout hover in the air; warm amber light on the skin, deep black background, no face, no text.`,
    },
  },
}

const [setArg, keyArg] = process.argv.slice(2)
const force = !!process.env.FORCE
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const [set, def] of Object.entries(SETS)) {
  if (setArg && set !== setArg) continue
  for (const [key, subject] of Object.entries(def.items)) {
    if (keyArg && key !== keyArg) continue
    const out = join(OUT, `${set}-${key}.png`)
    if (existsSync(out) && !force) {
      console.log('skip', `${set}-${key}`)
      continue
    }
    const prompt = `${def.frame}\n\nSubject: ${subject}`
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const t0 = Date.now()
        const { saved, finishReason } = await generate({ prompt, out, aspect: def.aspect, size: '1K' })
        if (saved) {
          console.log('ok  ', `${set}-${key}`, `${((Date.now() - t0) / 1000).toFixed(1)}s`)
          break
        }
        console.log('none', `${set}-${key}`, finishReason)
      } catch (e) {
        console.log('err ', `${set}-${key}`, attempt, e.message.slice(0, 160))
        if (/429/.test(e.message)) await sleep(15000)
      }
    }
  }
}
