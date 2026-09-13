#!/usr/bin/env node
/*
 * gen-web-mockups.mjs — six website landing pages in six different styles,
 * for the Website Design card in the head stack. Each is a tall (4:5)
 * desktop-page screenshot so the card can pan down it before crossfading
 * to the next.
 *
 *   node scripts/gen-web-mockups.mjs            # all six
 *   node scripts/gen-web-mockups.mjs cafe saas  # just these
 *   FORCE=1 to regenerate ones that already exist
 *
 * Output: assets-src/web-mockups/<key>.png (raw), then run
 *   python scripts/web-mockups-to-webp.py
 * to produce site/src/assets/web-mockups/<key>.webp
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generate } from './nanobanana.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'assets-src', 'web-mockups')

const FRAME = `Screenshot of a real, finished website landing page, desktop layout, shown as a tall page capture
(top of the page at the top, hero first, then two or three sections below). No browser chrome, no device frame,
no hands, no mockup perspective: flat, front-on, pixel-crisp UI. Real product photography where photos appear.
Typography must be readable and correctly spelled; short headlines only; no lorem ipsum; no watermark, no logos of real companies.
Award-winning web design quality in the Linear / Apple / Stripe school: generous whitespace, strong grid, one accent colour, refined type.`

const MOCKUPS = {
  saas: `A dark-mode SaaS product site for an Indian HR payroll platform called "Payroll" ... headline "Payroll that runs itself". Near-black background, one electric-violet accent, glassy dashboard screenshot in the hero, logo strip, three feature cards, pricing table.`,
  jewellery: `A luxury jewellery brand site "Aarna" ... ivory background, serif display type, huge editorial photo of gold and emerald jewellery on a model, headline "Heirlooms, reimagined", product grid of four rings, a story section with a craftsman photo.`,
  cafe: `A specialty coffee cafe site "Kaapi House" in Bengaluru ... warm cream and deep brown, playful rounded sans-serif, big latte-art photo hero with headline "Slow coffee. Fast wifi.", menu section with prices in rupees, map and opening hours block.`,
  realestate: `A premium real-estate developer site "Meridian Homes" ... crisp white, light grey and charcoal, thin grotesque type, full-bleed architectural render of a modern villa, headline "Homes with room to breathe", three project cards with prices, an amenities icon row.`,
  clinic: `A dental clinic site "Bright Dental" ... soft mint and white, friendly rounded type, smiling dentist photo, headline "Gentle dentistry, same-day appointments", services grid with icons, a booking form with date picker, patient reviews with star ratings.`,
  fashion: `A streetwear ecommerce store "Roadhouse" ... bold black and acid yellow, oversized condensed uppercase headline "DROP 07 IS LIVE", product grid of hoodies and sneakers with prices, a marquee strip, lookbook photos of young Indian models.`,
}

const want = process.argv.slice(2).filter(Boolean)
const keys = want.length ? want : Object.keys(MOCKUPS)
mkdirSync(OUT_DIR, { recursive: true })

const jobs = keys.map(async (key) => {
  const brief = MOCKUPS[key]
  if (!brief) throw new Error(`unknown mockup: ${key}`)
  const out = join(OUT_DIR, `${key}.png`)
  if (existsSync(out) && !process.env.FORCE) {
    console.log(`skip ${key} (exists)`)
    return
  }
  const prompt = `${FRAME}\n\nThe site: ${brief}`
  console.log(`generating ${key}…`)
  await generate({ prompt, out, aspect: '4:5', size: '1K' })
  console.log(`saved ${out}`)
})

const results = await Promise.allSettled(jobs)
const failed = results.filter((r) => r.status === 'rejected')
for (const f of failed) console.error('FAILED:', f.reason?.message || f.reason)
process.exit(failed.length ? 1 : 0)
