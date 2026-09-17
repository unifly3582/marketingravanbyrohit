// Refinements of concept A (ten-flame crown). Ref = concept-a.png for direction.
import { generate } from './nanobanana.mjs'
const REF = 'assets-src/logo/concept-a.png'
const STYLE = ` Professional brand identity, flat vector logo, razor-sharp clean edges, perfectly bilaterally symmetrical, centered on a solid very dark warm-black background (#0D0907). Palette strictly gold #F0A32F, ember #E2571E, deep maroon #8E1F1F, cream #F4EADB. Below the mark the wordmark "MARKETING RAVAN" in a bold wide modern geometric grotesque, letter-spaced, cream with the word RAVAN in gold. Logo reveal on a brand guideline page, generous empty space, no mockup, no other text, no tagline, no watermark. Spelled exactly MARKETING RAVAN.`
const COUNT = ` EXACTLY TEN flame-heads, five on the left and five mirrored on the right, no centre flame: count them, 10 total. The two innermost flames are tallest and each pair steps down evenly toward the outer edge.`

const V = {
  a1: `Use the reference image as the direction but redesign it to be far more refined and iconic. Logo mark: a crown of ten flame-heads. Each flame is a single sleek teardrop tongue with a small inward hook at the tip and one inner negative-space cut shaped like a subtle face profile (brow, nose) so every flame is also a head. The flames rise from a wide low mukut band with a single ruby-shaped ember gem at its centre. Smooth gold-to-ember vertical gradient, no outlines.${COUNT}`,
  a2: `Use the reference image as the direction but redesign it as a premium minimal monoline emblem. Logo mark: ten flame-heads drawn as clean elegant single-weight gold strokes, rising from a thin crown band; behind the crown a thin circular halo ring in gold, the flame tips just crossing the ring. Alternate flames gold and ember. Lots of negative space, luxury minimal, works as a favicon.${COUNT}`,
  a3: `Use the reference image as the direction but make it bolder and more modern. Logo mark: a solid geometric crown built from ten sharp faceted flame-heads, each flame a crisp angular blade with a straight-edged inner cut, arranged in a perfect fan on a semicircle so the outer flames lean outward. Filled gold with ember at the base; a thin cream highlight edge on the left side of each flame gives a faceted gem look. Under the fan a compact hexagonal crown base. Strong, symmetrical, sports-crest confidence.${COUNT}`,
}
const want = process.argv.slice(2)
await Promise.all(Object.entries(V).filter(([k]) => !want.length || want.includes(k)).map(async ([k, p]) => {
  const out = `assets-src/logo/concept-${k}.png`
  for (let i = 1; i <= 3; i++) {
    try { const r = await generate({ prompt: p + STYLE, out, ref: [REF], aspect: '1:1', size: '2K' }); if (r.saved) { console.log('ok', k); return } console.log('no image', k, r.finishReason) }
    catch (e) { console.log('err', k, i, e.message.slice(0, 200)) }
  }
}))
