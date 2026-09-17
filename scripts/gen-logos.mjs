// Three logo directions for Marketing Ravan, rendered as brand presentation
// sheets (mark + wordmark on the site's dark ground) with nano banana.
//   node scripts/gen-logos.mjs [a b c]     (default: all)
import { generate } from './nanobanana.mjs'

const STYLE = ` Professional brand identity design, flat vector logo, clean sharp edges, perfectly symmetrical, centered on a solid very dark warm-black background (#0D0907). Colour palette strictly: gold #F0A32F, ember orange #E2571E, deep maroon #8E1F1F, cream #F4EADB. Below the mark, the wordmark "MARKETING RAVAN" set in a bold modern geometric grotesque typeface, wide letter-spacing, cream colour with the word RAVAN in gold. Present it like a logo reveal on a brand guidelines page: lots of empty space around the mark, no mockups, no extra text, no taglines, no watermark, spelled exactly MARKETING RAVAN.`

const CONCEPTS = {
  a: { name: 'ten-flame crown', prompt: `Logo mark: a minimalist crown made of ten stylised flame-heads fanned in a symmetrical arc, the centre flame tallest, each flame a simple pointed teardrop with one inner cut so it reads as both a flame and a crowned head in silhouette. Under the arc a single small curved base like a mukut band. Gold gradient from gold at the tips to ember at the base. Geometric, iconic, works at favicon size.` },
  b: { name: 'R monogram with ten strokes', prompt: `Logo mark: a bold monogram letter R built from ten radiating strokes, like ten heads or ten rays fanning out from the bowl of the R, forming a crown silhouette on top of the letter. Solid gold on the dark background, a subtle ember glow at the base of the R only. Strong negative space, sharp geometric construction, one-colour reproducible, extremely simple and memorable, no face details.` },
  c: { name: 'Ravan face emblem', prompt: `Logo mark: a circular emblem badge. Inside, a bold stylised flat-vector illustration of the face of Ravan: heavy dark eyebrows, confident narrowed eyes, thick curled handlebar moustache, red tilak on the forehead, a gold mukut crown with a single ruby and a halo disc behind, two small curved black horns, gold hoop earrings. Rendered in only four flat colours: gold, ember, maroon and cream, with cream as the face highlights. Ring of the badge is thin gold with ten tiny flame ticks evenly spaced around it. Confident, premium, mascot-emblem style like a sports team crest, not cartoonish.` },
}

const want = process.argv.slice(2)
const jobs = Object.entries(CONCEPTS).filter(([k]) => !want.length || want.includes(k))
await Promise.all(jobs.map(async ([k, c]) => {
  const out = `assets-src/logo/concept-${k}.png`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await generate({ prompt: c.prompt + STYLE, out, aspect: '1:1', size: '2K' })
      if (r.saved) { console.log('ok', k, c.name, '->', out); return }
      console.log('no image', k, r.finishReason, r.texts.join(' ').slice(0, 200))
    } catch (e) { console.log('err', k, attempt, e.message.slice(0, 200)) }
  }
}))
