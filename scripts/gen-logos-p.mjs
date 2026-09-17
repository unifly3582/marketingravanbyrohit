// Logo directions built on the hero's modern Pixar-style Ravan.
import { generate } from './nanobanana.mjs'
const REF = 'assets-src/heads/head-pixar.png'
const WORD = ` Below the mark the wordmark "MARKETING RAVAN" in a bold wide modern geometric grotesque, letter-spaced, cream #F4EADB with the word RAVAN in gold #F0A32F. Solid very dark warm-black background (#0D0907). Logo reveal on a brand guideline page, generous empty space, no mockup, no other text, no tagline, no watermark. Spelled exactly MARKETING RAVAN.`
const ID = `The reference image is the character: the modern stylised 3D Ravan with the ornate gold mukut crown with a ruby and a halo disc behind it, curved black horns, sculpted glossy black pompadour hair with ember streaks, heavy brows, confident narrowed eyes, red tilak, thick curled handlebar moustache, gold hoop earrings, bronze-tan skin. Keep this identity exactly.`

const V = {
  p1: `${ID} Turn him into a premium 3D mascot logo: the head only, front-facing, rendered as a glossy high-end 3D logo with clean studio lighting, soft warm key light and a gold rim light, slight glossy finish, floating centred on the dark background with a faint ember glow under the chin. No body, no neck below the jaw, no props. Exactly like a modern tech brand 3D mascot logo.${WORD}`,
  p2: `${ID} Redraw him as a clean modern flat-vector logo mark in the style of a premium esports or streetwear mascot logo: bold simplified shapes, thick dark outlines, limited palette of gold #F0A32F, ember #E2571E, maroon #8E1F1F, cream #F4EADB and bronze skin tone, front-facing head only with the crown, halo disc, horns, pompadour, moustache and earrings all kept but simplified into confident geometric shapes. Sharp vector edges, perfectly symmetrical, no gradients, no shading, works at small sizes.${WORD}`,
  p3: `${ID} Modern minimal logo mark: the character reduced to a bold flat two-tone icon. A solid gold silhouette of the head with the crown peak, halo disc, horns and pompadour as one iconic outline shape, and inside it only the essential features cut out in the dark background colour: two brows, two narrowed eyes, the tilak, and the big handlebar moustache. Nothing else. PURE flat vector, absolutely no photographic or 3D rendered elements, no hair texture, no earrings, no skin, the reference is only for the shape of the crown, horns and moustache. Front-facing, perfectly symmetrical, ultra clean, favicon-ready like an app icon.${WORD}`,
}
const want = process.argv.slice(2)
await Promise.all(Object.entries(V).filter(([k]) => !want.length || want.includes(k)).map(async ([k, p]) => {
  const out = `assets-src/logo/concept-${k}.png`
  for (let i = 1; i <= 3; i++) {
    try { const r = await generate({ prompt: p, out, ref: [REF], aspect: '1:1', size: '2K' }); if (r.saved) { console.log('ok', k); return } console.log('no image', k, r.finishReason) }
    catch (e) { console.log('err', k, i, e.message.slice(0, 200)) }
  }
}))
