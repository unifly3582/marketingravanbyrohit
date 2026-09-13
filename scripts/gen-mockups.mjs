#!/usr/bin/env node
/*
 * gen-mockups.mjs — tall (4:5) UI mockups for the head-stack cards, one set
 * per head, generated with nano banana (Gemini image).
 *
 *   node scripts/gen-mockups.mjs web             # every image in the "web" set
 *   node scripts/gen-mockups.mjs ads manager     # just one image of a set
 *   FORCE=1 node scripts/gen-mockups.mjs ads     # regenerate existing ones
 *
 * Output: assets-src/<set>-mockups/<key>.png, then
 *   python scripts/mockups-to-webp.py <set>
 * writes site/src/assets/<set>-mockups/<key>.webp for the card to pick up.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generate } from './nanobanana.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const UI = `Flat, front-on, pixel-crisp screenshot of a real software screen, shown as a tall capture (top of the screen at the top).
No browser chrome, no device frame, no hands, no perspective, no watermark, no real company logos.
Typography readable and correctly spelled; short labels; realistic numbers in Indian rupees (₹) where money appears.
Design quality of the best modern product UIs: clear hierarchy, generous spacing, one accent colour, refined type.`

const SETS = {
  web: {
    frame: `Screenshot of a real, finished website landing page, desktop layout, shown as a tall page capture
(top of the page at the top, hero first, then two or three sections below). No browser chrome, no device frame,
no hands, no mockup perspective: flat, front-on, pixel-crisp UI. Real product photography where photos appear.
Typography must be readable and correctly spelled; short headlines only; no lorem ipsum; no watermark, no logos of real companies.
Award-winning web design quality in the Linear / Apple / Stripe school: generous whitespace, strong grid, one accent colour, refined type.`,
    items: {
      saas: `A dark-mode SaaS product site for an Indian HR payroll platform called "Payroll" ... headline "Payroll that runs itself". Near-black background, one electric-violet accent, glassy dashboard screenshot in the hero, logo strip, three feature cards, pricing table.`,
      jewellery: `A luxury jewellery brand site "Aarna" ... ivory background, serif display type, huge editorial photo of gold and emerald jewellery on a model, headline "Heirlooms, reimagined", product grid of four rings, a story section with a craftsman photo.`,
      cafe: `A specialty coffee cafe site "Kaapi House" in Bengaluru ... warm cream and deep brown, playful rounded sans-serif, big latte-art photo hero with headline "Slow coffee. Fast wifi.", menu section with prices in rupees, map and opening hours block.`,
      realestate: `A premium real-estate developer site "Meridian Homes" ... crisp white, light grey and charcoal, thin grotesque type, full-bleed architectural render of a modern villa, headline "Homes with room to breathe", three project cards with prices, an amenities icon row.`,
      clinic: `A dental clinic site "Bright Dental" ... soft mint and white, friendly rounded type, smiling dentist photo, headline "Gentle dentistry, same-day appointments", services grid with icons, a booking form with date picker, patient reviews with star ratings.`,
      fashion: `A streetwear ecommerce store "Roadhouse" ... bold black and acid yellow, oversized condensed uppercase headline "DROP 07 IS LIVE", product grid of hoodies and sneakers with prices, a marquee strip, lookbook photos of young Indian models.`,
    },
  },
  ads: {
    frame: UI,
    items: {
      manager: `An ads manager campaign dashboard for Facebook and Instagram campaigns, dark theme with a blue accent: top row of KPI tiles "Amount spent ₹4,82,000", "Purchases 1,240", "Cost per purchase ₹389", "ROAS 3.6x" with green up-arrows; a 30-day line chart of purchases climbing; below it a campaign table with columns Campaign, Results, Cost per result, ROAS, and rows like "Festive Sale – Retargeting", "Lookalike 1% – Purchasers", "Reels – New Drop", the best row highlighted.`,
      instagram: `An Instagram feed sponsored post preview for a jewellery brand "Aarna", centred on a dark grey background: the post card with the brand avatar, "Sponsored" label, a beautiful product photo of gold and emerald earrings on a model, a blue "Shop now" button bar, like/comment/share icons, "2,318 likes", caption "Festive collection. 20% off this week." with a few hashtags.`,
      creatives: `An ad creative testing board for a cafe brand: a grid of six square ad images (latte art, croissants, people working on laptops, a cold brew bottle, an outdoor table, a barista) each with a bold overlaid headline like "Slow coffee. Fast wifi." and, under each, a small results strip "CTR 2.4% · CPA ₹180"; the winning creative outlined in gold with a "Winner – scaling" badge; light UI with a top bar "Creative test · Round 3".`,
      audience: `An audience targeting panel, light UI with a blue accent: a stylised map of India with Bengaluru, Mumbai, Delhi, Hyderabad, Pune highlighted with radius circles; a card "Lookalike 1% – past purchasers" toggled on; age slider 25 to 44; interest chips "Home decor", "Fitness", "Organic food", "Weddings"; an "Estimated daily reach 1.2L – 3.4L" gauge; a "Retargeting: website visitors 30 days" card.`,
      report: `A weekly ad results report, clean light UI with a gold accent: a hero number "ROAS 3.6x" with "+157% vs last month", a before/after pair of bars labelled "Before" and "With AI", stats "Purchases 1,240", "CPA ₹389 ↓ 38%", "Add to cart 6,810"; a rising area chart over eight weeks; a short note "AI paused 3 ad sets, scaled the winner +40%".`,
      reels: `An Instagram Reels vertical video ad preview for a streetwear brand "Roadhouse", centred on a dark background: a tall 9:16 frame with a young Indian model in a black hoodie, bold acid-yellow text "DROP 07", a "Shop now" pill button, the Reels side icons, a small "Sponsored" label and progress bar at the top.`,
    },
  },
}

const [setName, ...want] = process.argv.slice(2)
const set = SETS[setName]
if (!set) {
  console.error(`usage: node scripts/gen-mockups.mjs <${Object.keys(SETS).join('|')}> [key ...]`)
  process.exit(2)
}
const OUT_DIR = join(__dirname, '..', 'assets-src', `${setName}-mockups`)
mkdirSync(OUT_DIR, { recursive: true })
const keys = want.length ? want : Object.keys(set.items)

const jobs = keys.map(async (key) => {
  const brief = set.items[key]
  if (!brief) throw new Error(`unknown ${setName} mockup: ${key}`)
  const out = join(OUT_DIR, `${key}.png`)
  if (existsSync(out) && !process.env.FORCE) {
    console.log(`skip ${key} (exists)`)
    return
  }
  console.log(`generating ${setName}/${key}…`)
  await generate({ prompt: `${set.frame}\n\nThe screen: ${brief}`, out, aspect: '4:5', size: '1K' })
  console.log(`saved ${out}`)
})

const results = await Promise.allSettled(jobs)
const failed = results.filter((r) => r.status === 'rejected')
for (const f of failed) console.error('FAILED:', f.reason?.message || f.reason)
process.exit(failed.length ? 1 : 0)
