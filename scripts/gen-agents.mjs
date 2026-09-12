// Generate personality portraits for the ten agents, referenced to the
// approved Pixar-style Ravan head so they all read as the same character.
//   node scripts/gen-agents.mjs [icon ...]     (default: all)
import { generate } from './nanobanana.mjs'
import { existsSync } from 'node:fs'

const REF = 'assets-src/heads/head-pixar.png'
// composition lock: an approved portrait whose crop/scale/shoulder line every
// take must copy exactly, so the ten cut out to the same silhouette.
const COMP = 'assets-src/agents/agent-1.png'
const BASE = `Same character as the first reference image: the stylized Pixar-style 3D adult Ravan, same face, same bronze-tan skin with freckles, thick curled handlebar moustache, heavy dark eyebrows, red tilak, gold kundal earrings, sculpted glossy black pompadour hair with ember-orange streaks, curved black horns, and the ornate antique-gold mukut crown with red ruby. Keep the identity exactly. `
const FRAME = ` FRAMING IS LOCKED: the second reference image is the composition template. Reproduce its exact crop, head size and head position, the same shoulder line at the same height, and the same shoulder width, so this portrait overlays it perfectly. Bust portrait, head and upper shoulders only, facing the camera with a slight three-quarter turn, centered. The bust ends in a clean straight horizontal cut across the chest at the very bottom of the frame. No hands, no arms, no held objects. Exactly one small accessory floats in the empty space beside the right shoulder, fully inside the frame, never touching any edge, never overlapping the face or crown, nothing above the crown. Pure matte black background. Cinematic soft warm key light from upper left, gold rim light from behind right, high-end 3D feature-film render, smooth clean shading, no text, no logos, no watermark.`

const AGENTS = {
  agent: ['The Operator — agentic AI and workflow automation.',
    'Calm, focused, in control. Wears a slim translucent AR visor over the eyes showing tiny glowing task glyphs; sleek dark tech jacket with a mandarin collar; three small holographic app-icon tiles orbit near his shoulder like a conductor commanding them.',
    'Cool commanding stare, one eyebrow raised. Dark hoodie under a fitted vest, a subtle glowing circuit-line pattern on the collar, and a single glowing orb of orchestrated task icons hovering by his temple.',
    'Calm, focused, in control. Slim translucent AR visor over the eyes showing tiny glowing task glyphs, sleek dark tech jacket with a mandarin collar. Accessory: a small cluster of three glowing holographic app-icon tiles.'],
  sdr: ['The Closer — 24/7 AI sales engine.',
    'Confident salesman charisma: sly winning smirk, one eyebrow raised, sharp navy blazer over an open-collar shirt, gold tie pin, discreet bluetooth earpiece, a stylized chat-bubble with a checkmark glowing beside him.',
    'Big warm deal-closing grin, finger-gun gesture entering frame, crisp white shirt with rolled sleeves and a loosened gold tie, smartphone in hand with glowing notification bubbles.',
    'Confident salesman charisma: sly winning smirk, one eyebrow raised, sharp navy blazer over an open-collar white shirt, gold tie pin, discreet bluetooth earpiece. Accessory: a glowing chat bubble with a gold checkmark.'],
  voice: ['The Orator — human-like voice AI and call automation.',
    'Mid-sentence, mouth open speaking with expressive energy, wearing a large professional broadcast headset with a boom mic, stylized glowing sound-wave ribbons flowing from the mic.',
    'Charming radio-host smile, eyes half closed listening, vintage-style studio microphone on a stand in the foreground, sleek dark shirt, subtle equalizer bars glowing in the background.',
    'Charming radio-host energy, mouth open mid-sentence, wearing a large professional broadcast headset with a boom mic, sleek dark shirt. Accessory: a short ribbon of glowing sound-wave bars.'],
  geo: ['The Sage — GEO and AI search optimization.',
    'Wise and thoughtful, round scholarly spectacles, chin slightly raised, holding an antique brass compass that glows with an AI sparkle, a maroon scholar shawl over one shoulder.',
    'Knowing half-smile, slim gold-rimmed glasses, an ancient scroll unrolling beside him that turns into floating glowing search-result cards, dark academic robe.',
    'Wise and thoughtful, round scholarly spectacles, chin slightly raised, a maroon scholar shawl over one shoulder. Accessory: a small antique brass compass glowing with an AI sparkle.'],
  erp: ['The Quartermaster — AI-driven ERP and supply chain.',
    'Meticulous and precise, pencil tucked behind his ear, thin steel-rim glasses, holding a clipboard ledger; neat khaki work shirt with a pocket; small stacked crates and a glowing barcode float beside him.',
    'Satisfied nod of a man whose books balance, sleeve garters, a scanner-style monocle over one eye, a stack of receipts turning into neat glowing data blocks.',
    'Meticulous and precise, pencil tucked behind his ear, thin steel-rim glasses, neat khaki work shirt with a pocket. Accessory: a tiny stack of crates with a glowing barcode.'],
  ads: ['The Showman — hyper-personalized ad campaigns.',
    'Flashy showman energy: big theatrical grin, round pink-to-orange gradient sunglasses, a bold patterned jacket with a popped collar, gold chain, bursts of confetti sparks around him.',
    'Cheeky wink, retro aviator sunglasses reflecting neon, a small megaphone raised, loud fuchsia-and-gold varsity jacket, tiny floating play-button and heart icons.',
    'Flashy showman energy: big theatrical grin, round pink-to-orange gradient sunglasses, bold patterned jacket with a popped collar, gold chain. Accessory: a small burst of confetti sparks.'],
  uiux: ['The Artisan — interactive web and UI/UX design.',
    'Creative and playful, chunky designer round glasses, a stylus behind his ear, paint smudges on the cheek, a glowing bezier curve with control handles floating beside him, casual cream turtleneck.',
    'Delighted craftsman smile, clear-frame glasses, a glass-morphism style translucent UI card floating near his hand, sleeves pushed up, splashes of gold and ember color.',
    'Creative and playful, chunky designer round glasses, a stylus behind his ear, paint smudge on the cheek, casual cream turtleneck. Accessory: a small glowing bezier curve with control handles.'],
  social: ['The Storyteller — social media managed every day.',
    null,
    null,
    'Charismatic content-creator energy: bright engaging smile looking straight into the lens, a ring-light glint in the eyes, a stylish cream bomber jacket over a black tee, a small clip-on lavalier mic on the collar. Accessory: a small floating glowing heart-and-comment reaction bubble with a tiny gold play triangle.'],
  campaign: ['The Strategist — full-funnel digital campaigns across Google, YouTube and email.',
    null,
    null,
    'Sharp, decisive campaign-general energy: composed confident half-smile, slim dark charcoal turtleneck under a tailored blazer with a small gold lapel pin. Accessory: a small glowing three-tier funnel diagram with a tiny gold arrow rising beside it.'],
  ecom: ['The Merchant — e-commerce growth agents that run and grow an online store.',
    null,
    null,
    'Warm, welcoming shopkeeper charm: broad friendly grin, a smart dark apron over a rolled-sleeve shirt, a small gold pen behind the ear. Accessory: a small glowing shopping-bag icon with a gold notification badge and a tiny upward sales arrow.'],
}

const want = process.argv.slice(2)
const jobs = []
for (const [icon, [role, a, b, c]] of Object.entries(AGENTS)) {
  if (want.length && !want.includes(icon)) continue
  ;[a, b, c].forEach((look, i) => {
    if (!look) return
    // takes 1 and 2 are the original free-framed looks; take 3 is the
    // locked-frame, hands-free look (COMP as the second reference). Only
    // take 3 is generated by default now (TAKES=1,2,3 to override).
    const takes = (process.env.TAKES || '3').split(',').map(Number)
    if (!takes.includes(i + 1)) return
    const out = `assets-src/agents/${icon}-${i + 1}.png`
    if (existsSync(out) && !process.env.FORCE) return
    jobs.push({ out, prompt: `${BASE}Now this is ${role} ${look}${FRAME}`, ref: i === 2 ? [REF, COMP] : [REF] })
  })
}
const CONC = 4
let next = 0
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++]
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await generate({ prompt: j.prompt, out: j.out, ref: j.ref, aspect: '1:1', size: '1K' })
        console.log(r.saved ? `ok   ${j.out}` : `none ${j.out} (${r.finishReason})`)
        if (r.saved) break
      } catch (e) { console.log(`fail ${j.out}: ${e.message.slice(0, 120)}`) }
      await new Promise((r) => setTimeout(r, 4000 * attempt))
    }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
console.log('done', jobs.length)
