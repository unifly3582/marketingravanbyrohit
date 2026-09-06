// Generate personality portraits for the ten agents, referenced to the
// approved Pixar-style Ravan head so they all read as the same character.
//   node scripts/gen-agents.mjs [icon ...]     (default: all)
import { generate } from './nanobanana.mjs'
import { existsSync } from 'node:fs'

const REF = 'assets-src/heads/head-pixar.png'
const BASE = `Same character as the reference image: the stylized Pixar-style 3D adult Ravan, same face, same bronze-tan skin with freckles, thick curled handlebar moustache, heavy dark eyebrows, red tilak, gold kundal earrings, sculpted glossy black pompadour hair with ember-orange streaks, curved black horns, and the ornate antique-gold mukut crown with red ruby. Keep the identity exactly. `
const FRAME = ` Bust portrait: head and upper shoulders, slight three-quarter turn, centered, tight crop with margin, character fully inside the frame. Pure matte black background. Cinematic soft warm key light from upper left, gold rim light from behind right, high-end 3D feature-film render, smooth clean shading, no text, no logos, no watermark.`

const AGENTS = {
  agent: ['The Operator — agentic AI and workflow automation.',
    'Calm, focused, in control. Wears a slim translucent AR visor over the eyes showing tiny glowing task glyphs; sleek dark tech jacket with a mandarin collar; three small holographic app-icon tiles orbit near his shoulder like a conductor commanding them.',
    'Cool commanding stare, one eyebrow raised. Dark hoodie under a fitted vest, a subtle glowing circuit-line pattern on the collar, and a single glowing orb of orchestrated task icons hovering by his temple.'],
  sdr: ['The Closer — 24/7 AI sales engine.',
    'Confident salesman charisma: sly winning smirk, one eyebrow raised, sharp navy blazer over an open-collar shirt, gold tie pin, discreet bluetooth earpiece, a stylized chat-bubble with a checkmark glowing beside him.',
    'Big warm deal-closing grin, finger-gun gesture entering frame, crisp white shirt with rolled sleeves and a loosened gold tie, smartphone in hand with glowing notification bubbles.'],
  voice: ['The Orator — human-like voice AI and call automation.',
    'Mid-sentence, mouth open speaking with expressive energy, wearing a large professional broadcast headset with a boom mic, stylized glowing sound-wave ribbons flowing from the mic.',
    'Charming radio-host smile, eyes half closed listening, vintage-style studio microphone on a stand in the foreground, sleek dark shirt, subtle equalizer bars glowing in the background.'],
  geo: ['The Sage — GEO and AI search optimization.',
    'Wise and thoughtful, round scholarly spectacles, chin slightly raised, holding an antique brass compass that glows with an AI sparkle, a maroon scholar shawl over one shoulder.',
    'Knowing half-smile, slim gold-rimmed glasses, an ancient scroll unrolling beside him that turns into floating glowing search-result cards, dark academic robe.'],
  erp: ['The Quartermaster — AI-driven ERP and supply chain.',
    'Meticulous and precise, pencil tucked behind his ear, thin steel-rim glasses, holding a clipboard ledger; neat khaki work shirt with a pocket; small stacked crates and a glowing barcode float beside him.',
    'Satisfied nod of a man whose books balance, sleeve garters, a scanner-style monocle over one eye, a stack of receipts turning into neat glowing data blocks.'],
  ads: ['The Showman — hyper-personalized ad campaigns.',
    'Flashy showman energy: big theatrical grin, round pink-to-orange gradient sunglasses, a bold patterned jacket with a popped collar, gold chain, bursts of confetti sparks around him.',
    'Cheeky wink, retro aviator sunglasses reflecting neon, a small megaphone raised, loud fuchsia-and-gold varsity jacket, tiny floating play-button and heart icons.'],
  bi: ['The Oracle — predictive BI and forecasting.',
    'Mysterious and all-seeing, one eye covered by a glowing data-lens monocle, faint holographic line-charts and bars rising beside him, dark charcoal turtleneck, subtle blue-white glow on the face.',
    'Calm knowing smirk, both eyes reflecting tiny glowing graphs, a crystal-ball-like glass sphere with a glowing forecast curve inside held near the shoulder, sleek dark coat.'],
  uiux: ['The Artisan — interactive web and UI/UX design.',
    'Creative and playful, chunky designer round glasses, a stylus behind his ear, paint smudges on the cheek, a glowing bezier curve with control handles floating beside him, casual cream turtleneck.',
    'Delighted craftsman smile, clear-frame glasses, a glass-morphism style translucent UI card floating near his hand, sleeves pushed up, splashes of gold and ember color.'],
  api: ['The Engineer — universal API and legacy integration.',
    'Determined builder, tech goggles pushed up onto the crown, a coil of glowing cable looped over the shoulder, holding a large plug connector that snaps into a glowing socket, rugged work jacket.',
    'Focused grin with a wrench over the shoulder, a smart headband with a small LED, two mismatched vintage and modern connectors joining with a spark, dark utility vest.'],
  shield: ['The Guardian — AI reputation and sentiment monitoring.',
    'Stern, watchful, protective: sharp eyes scanning, a sleek tactical visor half raised, arms crossed, a small glowing gold shield emblem on the chest of a dark armored jacket, radar rings faintly behind.',
    'Calm sentinel stare, a subtle glowing radar sweep in one eye, high armored collar, a tiny hovering drone-eye beside him, a shield outline glowing at the shoulder.'],
}

const want = process.argv.slice(2)
const jobs = []
for (const [icon, [role, a, b]] of Object.entries(AGENTS)) {
  if (want.length && !want.includes(icon)) continue
  ;[a, b].forEach((look, i) => {
    const out = `assets-src/agents/${icon}-${i + 1}.png`
    if (existsSync(out) && !process.env.FORCE) return
    jobs.push({ out, prompt: `${BASE}Now this is ${role} ${look}${FRAME}` })
  })
}
const CONC = 4
let next = 0
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++]
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await generate({ prompt: j.prompt, out: j.out, ref: [REF], aspect: '1:1', size: '1K' })
        console.log(r.saved ? `ok   ${j.out}` : `none ${j.out} (${r.finishReason})`)
        if (r.saved) break
      } catch (e) { console.log(`fail ${j.out}: ${e.message.slice(0, 120)}`) }
      await new Promise((r) => setTimeout(r, 4000 * attempt))
    }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
console.log('done', jobs.length)
