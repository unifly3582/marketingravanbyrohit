// Ravan-head logo directions: ten literal crowned heads, flat vector.
import { generate } from './nanobanana.mjs'
const REFS = ['site/src/assets/logo-mark.png', 'assets-src/logo/concept-c.png']
const STYLE = ` Professional brand identity, flat vector logo, razor-sharp clean edges, perfectly bilaterally symmetrical, centered on a solid very dark warm-black background (#0D0907). Palette strictly gold #F0A32F, ember #E2571E, deep maroon #8E1F1F, cream #F4EADB, plus the dark background used as line colour. Below the mark the wordmark "MARKETING RAVAN" in a bold wide modern geometric grotesque, letter-spaced, cream with the word RAVAN in gold. Logo reveal on a brand guideline page, generous empty space, no mockup, no other text, no tagline, no watermark. Spelled exactly MARKETING RAVAN.`
const FACE = ` Every head is the same Ravan: gold mukut crown with a pointed peak, heavy dark brows, narrowed confident eyes, thick curled handlebar moustache, red tilak, gold hoop earrings, the same face as the second reference image but simplified.`

const V = {
  h1: `The first reference image is the old logo: ten crowned Ravan heads fanned in an arc. Redesign it as a clean premium flat-vector emblem. Logo mark: EXACTLY TEN crowned Ravan heads in one fanned arc, the centre head largest and facing forward, the other nine stepping smaller and turning outward toward the sides in profile, 1 centre head facing forward flanked by 4 heads on the left and 4 heads on the right, with the tenth head placed directly above the centre head as a small crest, 10 total. Crowns touch so the row reads as one continuous golden crown. Below the row of heads, broad shoulders and a jewelled necklace close the emblem. Flat colours only, no gradients.${FACE}`,
  h2: `Logo mark: a minimal geometric monogram of ten Ravan heads. Ten identical simplified head silhouettes in profile, each just a crown peak, brow, nose, moustache curl and chin, arranged as five facing left and five facing right in a mirrored fan, stacked so they overlap like a hand of cards. Solid gold silhouettes with the dark background as the separating outline, the innermost pair slightly larger. Extremely simplified, works as a favicon, no eyes, no detail.${FACE}`,
  h3: `Logo mark: one large bold flat-vector Ravan face in the centre, front-facing, drawn in gold, ember, maroon and cream, with nine smaller identical crowned head profiles fanning out behind it like a crown of heads, four on the left facing left and four on the right facing right and one small one above the centre crown peak, 10 heads total. The nine background heads are flat solid gold silhouettes with minimal detail so the centre face stays the hero. No circle ring, no badge, just the head cluster on the dark background.${FACE}`,
}
const want = process.argv.slice(2)
await Promise.all(Object.entries(V).filter(([k]) => !want.length || want.includes(k)).map(async ([k, p]) => {
  const out = `assets-src/logo/concept-${k}.png`
  for (let i = 1; i <= 3; i++) {
    try { const r = await generate({ prompt: p + STYLE, out, ref: REFS, aspect: '1:1', size: '2K' }); if (r.saved) { console.log('ok', k); return } console.log('no image', k, r.finishReason) }
    catch (e) { console.log('err', k, i, e.message.slice(0, 200)) }
  }
}))
