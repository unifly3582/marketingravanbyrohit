// Re-render the approved mark on pure white so it can be keyed cleanly.
import { generate } from './nanobanana.mjs'
const P = `Reproduce the logo mark in the reference image EXACTLY: same drawing, same proportions, same colours, same details, nothing added or removed, no text. Only two changes: (1) the background is solid pure white #FFFFFF everywhere, with no shadow, glow, vignette or texture; (2) all the outlines and the black hair and horns are drawn in true near-black #141010 so they are clearly visible against white. Flat vector style, crisp edges, the mark centred with generous white margin.`
for (const n of [1, 2]) {
  const out = `assets-src/logo/mark-white-v${n}.png`
  for (let i = 1; i <= 3; i++) {
    try { const r = await generate({ prompt: P, out, ref: ['assets-src/logo/mark-v1-clean.png'], aspect: '1:1', size: '2K' }); if (r.saved) { console.log('ok', out); break } console.log('no image', r.finishReason) }
    catch (e) { console.log('err', i, e.message.slice(0, 200)) }
  }
}
