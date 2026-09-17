// Final mark refinement: flat vector mascot head (P2), mark only, no text.
import { generate } from './nanobanana.mjs'
const REFS = ['assets-src/logo/concept-p2.png', 'assets-src/heads/head-pixar.png']
const P = `The first reference image is the approved logo direction, the second is the original character. Produce an IMPROVED, final version of the first image's mascot head as a professional flat-vector logo mark, MARK ONLY with absolutely no text or wordmark anywhere. Improvements: cleaner and more balanced proportions (slightly narrower horns that curve up elegantly and do not spread wider than 1.6x the face width, crown a little shorter, face slightly rounder and friendlier but still confident), perfectly bilaterally symmetrical, consistent thick dark outline weight everywhere, crisp geometric shapes, no gradients, no shading except one flat highlight tone. Keep the identity exactly: ornate gold mukut crown with a ruby, the gold halo disc behind the head, curved black horns, glossy black pompadour with ember-orange streaks, heavy brows, confident narrowed eyes, red tilak with two cream lines, thick curled handlebar moustache, gold hoop earrings, bronze-tan skin, a short neck ending in a clean rounded collar stub. Palette only: gold #F0A32F, ember #E2571E, maroon #8E1F1F, cream #F4EADB, black #1A1210 outlines, bronze skin #C98B5A and a lighter skin highlight. Centered with generous empty margin on a solid flat background of exactly #0D0907, nothing else in the image.`
const jobs = [1, 2].map(async (n) => {
  const out = `assets-src/logo/mark-v${n}.png`
  for (let i = 1; i <= 3; i++) {
    try { const r = await generate({ prompt: P, out, ref: REFS, aspect: '1:1', size: '2K' }); if (r.saved) { console.log('ok', out); return } console.log('no image', n, r.finishReason) }
    catch (e) { console.log('err', n, i, e.message.slice(0, 200)) }
  }
})
await Promise.all(jobs)
