#!/usr/bin/env node
/*
 * gen-employees.mjs — the AI-agent frames for the WhatsApp page's flip stage,
 * in the layout of Google's "personal Chrome" persona ad: a flat rounded
 * card on a pale page, the person in a darker circle at its centre, the
 * agent's assets floating out past the card's edges, the name on one side
 * and the role on the other. Two frames per agent: a landscape one for
 * desktop (`-wide`) and a portrait one for phones (`-tall`). Through Meshy's text-to-image (nano banana pro).
 *
 *   node scripts/gen-employees.mjs             # every missing frame
 *   node scripts/gen-employees.mjs sales chief # just these
 *   FORCE=1 node scripts/gen-employees.mjs     # regenerate
 *
 * Output: assets-src/employees/<key>-wide.png (4:3), <key>-tall.png (3:4)
 */
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'assets-src', 'employees')
mkdirSync(OUT, { recursive: true })

/* the six agents (four small-business jobs, two for bigger companies): card
   colours, the person, their assets. Wide frames put the name left and the
   role right of the circle; tall frames the name above and the role below. */
export const AGENTS = [
  {
    key: 'sales', name: "Priya's", role: 'Sales AI Agent',
    page: '#FBE9E1', card: '#E2571E', circle: '#B8431A',
    person: 'a strikingly beautiful ultra-modern Indian woman in her late twenties, sleek dark hair in a low bun, glowing skin, small gold hoops, chic rust silk blouse',
    assets: "a product photo card of a green kundan choker necklace captioned 'Kundan choker · ₹2,499' with a small orange 'Send' button, a WhatsApp chat card with a green bubble 'Green mein available hai, hold kar doon?', a payment-success card with a green tick 'Paid ₹2,499', a small calendar card, a folded orange silk saree photo card, a shopping bag icon badge, a WhatsApp logo badge",
  },
  {
    key: 'leads', name: "Arjun's", role: 'Leads AI Agent',
    page: '#E6ECF3', card: '#1F3A5F', circle: '#15283F',
    person: 'a handsome ultra-modern Indian man in his early thirties, sharp jawline, neat short hair and a trimmed beard, navy blazer over a white tee',
    assets: "an Instagram ad card showing a modern apartment tower captioned '3BHK from ₹1.2 Cr · Send message', a WhatsApp chat card with a green bubble 'Move in or invest? Budget range?', a lead-score card reading 'Lead score 82 · Hot' with a small gauge, a site-visit card 'Site visit · Sat 11 am', a map-pin badge, a Meta logo badge, a photo card of a sunlit living room",
  },
  {
    key: 'reception', name: "Meera's", role: 'Bookings AI Agent',
    page: '#FCF1DC', card: '#F0A32F', circle: '#D98A1B',
    person: 'a graceful ultra-modern Indian woman in her thirties, hair tied back, a slim light headset, crisp white shirt, warm confident smile',
    assets: "an appointment card 'Dr Mehta · Sat 4:00 pm · Booked' with a green tick, a WhatsApp chat card with a green bubble '11 am or 4 pm free on Saturday?', a reminder card with a bell icon '24 h before', a waitlist card 'Slot freed → Rahul notified', a photo card of a bright dental clinic reception with flowers, a calendar icon badge, a WhatsApp logo badge",
  },
  {
    key: 'collections', name: "Sunita's", role: 'Collections AI Agent',
    page: '#F5E4E4', card: '#8E1F1F', circle: '#6E1616',
    person: 'an elegant ultra-modern Indian woman in her late thirties, shoulder-length hair, thin-rimmed glasses, formal maroon blouse, poised expression',
    assets: "a reminder card 'April fee ₹6,000 · due Friday', a WhatsApp chat card with a green bubble 'Namaste Sunita ji, pay here 👇', a UPI payment-success card with a green tick 'Paid ₹6,000', a receipt card 'Receipt sent', a ledger card with a small bar chart 'Overdue ₹42k → ₹0', a rupee coin badge, a WhatsApp logo badge",
  },
  {
    key: 'dealer', name: "Rajat's", role: 'Dealer Network AI Agent',
    page: '#E7ECEF', card: '#2B3A42', circle: '#1C2830',
    person: 'a sharp ultra-modern Indian man in his late thirties, well-groomed short hair, light stubble, crisp light-blue shirt with sleeves rolled, arms crossed',
    assets: "a WhatsApp chat card with a green bubble '120 units Model X, Diwali scheme lagega?', an order card 'Dealer D-214 · 120 units · ₹9.6 L · Confirmed' with a green tick, a scheme card 'Diwali scheme 5% · till 31 Oct', a stock card 'Available 340 · Bhiwandi depot', a claim card 'Claim #1182 · Approved', a SAP logo badge, a WhatsApp logo badge, a photo card of a factory floor with stacked white goods, a small map card with three depot pins",
  },
  {
    key: 'hr', name: "Nisha's", role: 'HR Helpdesk AI Agent',
    page: '#F0E5EE', card: '#6B2D5C', circle: '#4E2043',
    person: 'a warm ultra-modern Indian woman in her mid thirties, shoulder-length wavy hair, smart plum blazer over a cream top, minimal jewellery, kind confident smile',
    assets: "a WhatsApp chat card with a green bubble 'Payslip for August bhej do', a payslip card 'August payslip · PDF' with a document icon, a leave card 'Leave 12–14 Oct · Approved' with a green tick, a policy card 'Maternity policy · 26 weeks', an onboarding card 'Day 1 checklist · 6 of 8 done', an attendance card 'Shift 9–6 · Checked in 8:52', a people icon badge, a WhatsApp logo badge, a photo card of a bright modern office with a team at desks",
  },
]

const frame = (a) => {
  const shape = a.wide
    ? `landscape. In the middle sits a large rounded-corner rectangle card in flat ${a.card} taking about 75% of the width. Big bold white sans-serif text on the card: '${a.name}' on the left of the circle and '${a.role}' on the right of the circle.`
    : `portrait. In the middle sits a tall rounded-corner rectangle card in flat ${a.card} taking about 70% of the width. Big bold white sans-serif text on the card: '${a.name}' above the circle and '${a.role}' below the circle.`
  return (
    `Modern tech advertisement graphic in the style of a Google Chrome persona ad, ${shape} ` +
    `The whole canvas is a flat pale background ${a.page}. At the centre of the card a darker circle in flat ${a.circle}, and inside it, overflowing the circle's top edge, ` +
    `a photorealistic cutout of ${a.person}, head and shoulders, glossy editorial fashion photography, confident direct gaze. ` +
    `Around the person, floating with soft shadows and deliberately breaking past the card's edges onto the pale background: ${a.assets}. ` +
    `Cards are white with rounded corners, crisp UI-like, a couple of them are photographs. Clean, flat, premium, high detail, sharp legible typography, no other text.`
  )
}

/* usage: gen-employees.mjs [key ...] [--wide|--tall]   (default: both shapes) */
const args = process.argv.slice(2)
const shapes = args.includes('--wide') ? ['wide'] : args.includes('--tall') ? ['tall'] : ['wide', 'tall']
const want = args.filter((x) => !x.startsWith('--'))
const force = !!process.env.FORCE
for (const a of AGENTS) {
  if (want.length && !want.includes(a.key)) continue
  for (const shape of shapes) {
    const out = resolve(OUT, `${a.key}-${shape}.png`)
    if (existsSync(out) && !force) { console.error(`skip ${a.key}-${shape} (exists)`); continue }
    console.error(`\n== ${a.key}-${shape}: ${a.name} ${a.role}`)
    const wide = shape === 'wide'
    const r = spawnSync(process.execPath, [resolve(HERE, 'meshy-image.mjs'), '--out', out, '--ar', wide ? '4:3' : '3:4', frame({ ...a, wide })], { stdio: 'inherit' })
    if (r.status) console.error(`!! ${a.key}-${shape} failed (${r.status})`)
  }
}
