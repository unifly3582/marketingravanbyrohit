#!/usr/bin/env node
/*
 * build-viral.mjs — hook-first Instagram / Meta feed posts (1080x1350) aimed at
 * business owners who want AI agents. Nano-banana scenes from out/viral/ plus
 * the hero portrait cutouts, composited with headless Chrome.
 *
 *   node scripts/brand/build-viral.mjs          # all -> brand-kit/instagram/viral/
 *   node scripts/brand/build-viral.mjs v3       # only ids containing "v3"
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = resolve(ROOT, 'brand-kit/instagram/viral')
const TMP = resolve(OUT, '_html')
mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

const C = { ground: '#0D0907', cream: '#F4EADB', muted: '#A3937F', gold: '#F0A32F', ember: '#E2571E', maroon: '#8E1F1F', mint: '#5FD3A3', green: '#2E9E6E' }
const DOMAIN = 'marketingravan.com'
const data = (p, mime = 'image/png') => `data:${mime};base64,` + readFileSync(resolve(ROOT, p)).toString('base64')
const mark = data('assets-src/logo/mark.png')
const portrait = (icon) => data(`assets-src/agents-cut/${icon}-3.png`)
const scene = (name) => data(`out/viral/${name}.png`)

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">`
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1080px;height:1350px;background:${C.ground};color:${C.cream};font-family:'Instrument Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}
  .display{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.035em;line-height:.96}
  .word{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.025em;white-space:nowrap}
  .word b{color:${C.gold}}
  .tag{font-weight:600;letter-spacing:.22em;text-transform:uppercase}
  .bar{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,${C.gold},${C.ember})}
  .brand{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:14px;z-index:5}
  .brand .m{height:54px}.brand img{height:100%;width:auto;display:block}
  .scene{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 100%}
  .fade{position:absolute;inset:0;background:linear-gradient(180deg,${C.ground} 0%,${C.ground} 26%,rgba(13,9,7,.55) 40%,rgba(13,9,7,0) 52%,rgba(13,9,7,0) 78%,rgba(13,9,7,.85) 100%)}
  .hook{position:absolute;left:64px;right:64px;top:150px;z-index:4}
  .sub{font-size:31px;line-height:1.38;margin-top:26px;color:${C.cream};opacity:.9;max-width:820px}
  .foot{position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;align-items:flex-end;font-size:23px;z-index:5}
  .chip{display:inline-flex;align-items:center;gap:12px;padding:12px 22px;border-radius:999px;background:rgba(13,9,7,.72);border:1px solid rgba(244,234,219,.18);font-size:22px;font-weight:600;backdrop-filter:blur(6px)}
  .chip i{width:12px;height:12px;border-radius:50%;background:${C.mint};display:inline-block;box-shadow:0 0 12px ${C.mint}}
  .pill{display:inline-block;padding:10px 20px;border-radius:999px;font-size:19px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${C.ground};background:linear-gradient(90deg,${C.gold},${C.ember})}
`
const page = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}${extra}</style></head><body>${body}</body></html>`
const brand = `<div class="brand"><div class="m"><img src="${mark}"></div><div class="word" style="font-size:28px">MARKETING <b>RAVAN</b></div></div>`
const foot = (left, right = DOMAIN) => `<div class="foot"><div>${left}</div><div style="font-weight:700;color:${C.gold}">${right}</div></div>`
const bar = `<div class="bar"></div>`

/* a scene post: full-bleed nano-banana image, hook on the dark upper third */
const scenePost = ({ id, img, hook, sub, chip, hookSize = 92 }) => ({ id, body: `
  <img class="scene" src="${scene(img)}">
  <div class="fade"></div>
  ${brand}
  <div class="hook">
    <div class="display" style="font-size:${hookSize}px">${hook}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </div>
  ${foot(chip ? `<span class="chip"><i></i>${chip}</span>` : '')}${bar}` })

const boards = []

boards.push(scenePost({
  id: 'v1-2am', img: 's1-2am',
  hook: `Your competitor replied<br>at <span style="color:${C.gold}">2:14 AM.</span>`,
  sub: `You replied at 10:30. By then the customer had paid someone else.`,
  chip: 'WhatsApp AI agent · replies in seconds, 24×7',
}))

boards.push(scenePost({
  id: 'v2-asleep', img: 's2-asleep',
  hook: `POV: you're asleep.<br>Your business just <span style="color:${C.gold}">booked 3 appointments.</span>`,
  sub: `An AI agent on your WhatsApp number. It doesn't sleep. You finally can.`,
  chip: 'Answers · qualifies · books · follows up',
  hookSize: 80,
}))

boards.push(scenePost({
  id: 'v3-missed-calls', img: 's3-missed',
  hook: `27 missed calls<br>is not a <span style="color:${C.gold}">phone problem.</span>`,
  sub: `It's 27 customers who called the next shop. An AI calling agent picks up every call, in Hindi too.`,
  chip: 'AI calling agent · picks up in under a second',
}))

boards.push(scenePost({
  id: 'v5-ten-jobs', img: 's5-interview',
  hook: `The only candidate<br>who can do <span style="color:${C.gold}">ten jobs.</span>`,
  sub: `Website, ads, social, WhatsApp, calls, store, books, search. Never late, never on leave, never quits.`,
  chip: 'Ten heads. Ten jobs. One Ravan.',
}))

/* v4 scoreboard: human vs AI agent, qualitative claims only */
const rows = [
  ['Replies to a lead', 'in hours', 'in seconds'],
  ['Working hours', '9 to 6', '24 × 7'],
  ['Sick · late · quits', 'every month', 'never'],
  ['Training', 'months', 'minutes'],
  ['Mood on Monday', 'depends', 'always polite'],
  ['Monthly cost', 'full salary', 'a fraction'],
]
boards.push({ id: 'v4-stop-hiring', body: `
  <div style="position:absolute;inset:0;background:radial-gradient(60% 40% at 78% 30%, rgba(240,163,47,.16), transparent 70%)"></div>
  ${brand}
  <div class="hook" style="top:150px">
    <div class="display" style="font-size:82px">I'm not saying fire anyone.<br><span style="color:${C.gold}">Stop hiring for this.</span></div>
  </div>
  <div style="position:absolute;left:64px;right:64px;top:380px">
    <div style="display:flex;align-items:flex-end;gap:0;padding:0 0 18px;border-bottom:2px solid rgba(244,234,219,.14)">
      <div style="flex:1"></div>
      <div class="tag" style="width:260px;font-size:20px;color:${C.muted}">Human</div>
      <div style="width:290px;display:flex;align-items:center;gap:14px"><div style="height:64px;width:64px;border-radius:50%;overflow:hidden;background:#1a1412;flex:none"><img src="${portrait('agent')}" style="width:100%;height:auto;transform:scale(1.9) translateY(18%)"></div><div class="tag" style="font-size:20px;color:${C.gold}">AI agent</div></div>
    </div>
    ${rows.map(([k, h, a], i) => `<div style="display:flex;align-items:center;height:96px;border-bottom:1px solid rgba(244,234,219,.1)">
      <div style="flex:1;font-size:27px;font-weight:600;color:${C.cream};opacity:.85">${k}</div>
      <div style="width:260px;font-family:'Bricolage Grotesque';font-weight:700;font-size:32px;color:rgba(244,234,219,.45);${i === 5 ? 'text-decoration:line-through' : ''}">${h}</div>
      <div style="width:290px;font-family:'Bricolage Grotesque';font-weight:800;font-size:34px;color:${C.gold}">${a}</div>
    </div>`).join('')}
  </div>
  <div style="position:absolute;left:64px;right:64px;bottom:120px;font-size:30px;line-height:1.4;color:${C.muted};max-width:820px">Same work. Done tonight. Which job would you hand over first? 👇</div>
  ${foot('', DOMAIN)}${bar}` })

/* v6 list: five jobs to hand over this week */
const jobs = [
  ['sdr', 'Reply to every WhatsApp enquiry', 'in under 5 seconds, day or night'],
  ['voice', 'Call back every missed call', 'qualify the lead, book the slot'],
  ['erp', 'Enter invoices into Tally / Zoho', 'photos and PDFs straight into the books'],
  ['ecom', 'Recover abandoned carts', 'nudge, answer, close the order'],
  ['social', 'Post and reply on social every day', '30 posts a month, comments answered'],
]
boards.push({ id: 'v6-five-jobs', body: `
  <div style="position:absolute;inset:0;background:radial-gradient(50% 35% at 20% 15%, rgba(226,87,30,.18), transparent 70%)"></div>
  ${brand}
  <div class="hook" style="top:150px">
    <div class="display" style="font-size:84px">5 jobs an AI agent<br>can take off your plate<br><span style="color:${C.gold}">by Friday.</span></div>
  </div>
  <div style="position:absolute;left:64px;right:64px;top:450px">
    ${jobs.map(([icon, t, s], i) => `<div style="display:flex;align-items:center;gap:24px;padding:14px 0;border-bottom:1px solid rgba(244,234,219,.1)">
      <div style="font-family:'Bricolage Grotesque';font-weight:800;font-size:30px;color:${C.gold};width:44px">0${i + 1}</div>
      <div style="height:92px;width:92px;border-radius:22px;overflow:hidden;background:linear-gradient(160deg,#241a12,#12100d);flex:none;border:1px solid rgba(244,234,219,.12)"><img src="${portrait(icon)}" style="width:100%;height:auto;transform:scale(1.7) translateY(20%)"></div>
      <div><div style="font-family:'Bricolage Grotesque';font-weight:700;font-size:36px;letter-spacing:-.02em">${t}</div><div style="font-size:25px;color:${C.muted};margin-top:6px">${s}</div></div>
    </div>`).join('')}
  </div>
  <div style="position:absolute;left:64px;right:64px;bottom:124px;font-size:30px;line-height:1.4;color:${C.cream};opacity:.9">Comment the number you'd hand over first. 👇</div>
  ${foot('', DOMAIN)}${bar}` })

/* v7 CTA */
boards.push({ id: 'v7-first-agent', body: `
  <div style="position:absolute;inset:0;background:radial-gradient(60% 50% at 75% 80%, rgba(240,163,47,.22), transparent 70%)"></div>
  ${brand}
  <img src="${portrait('sdr')}" style="position:absolute;right:-90px;bottom:0;height:720px;width:auto;filter:drop-shadow(0 30px 60px rgba(0,0,0,.55))">
  <div style="position:absolute;left:64px;top:180px;width:560px;z-index:3">
    <span class="pill">Free to start</span>
    <div class="display" style="font-size:104px;margin-top:30px">Your first<br>AI agent.<br><span style="color:${C.gold}">On us.</span></div>
    <div style="font-size:29px;line-height:1.45;margin-top:32px;opacity:.9;max-width:520px">Tell us what you sell. We'll put one agent on your WhatsApp or phone line and show you what it closes. One call, no decks.</div>
    <div style="margin-top:40px;display:inline-block;padding:20px 36px;border-radius:999px;background:${C.gold};color:${C.ground};font-weight:700;font-size:26px">Comment "AGENT" or DM us</div>
  </div>
  <div class="foot" style="justify-content:flex-start"><div style="font-weight:700;color:${C.gold}">${DOMAIN}</div></div>${bar}` })

/* ---------- render ---------- */
const want = process.argv.slice(2)
for (const b of boards) {
  if (want.length && !want.some((w) => b.id.includes(w))) continue
  const html = resolve(TMP, b.id + '.html')
  writeFileSync(html, page(b.body, b.extra || ''))
  const out = resolve(OUT, b.id + '.png')
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=12000', '--window-size=1080,1350', `--screenshot=${out}`, 'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8' })
  console.log(r.status === 0 ? 'ok  ' : 'FAIL', b.id)
}

/* ---------- captions ---------- */
const HASH = '#AIAgents #AIForBusiness #SmallBusinessIndia #BusinessAutomation #WhatsAppAutomation #MarketingRavan #DigitalMarketingIndia #Entrepreneur'
const caps = {
  'v1-2am': `Your competitor replied at 2:14 AM. 😴📱\n\nNot because they were awake. Because an AI agent was.\n\nMost businesses lose leads between 8 PM and 10 AM, when nobody is on WhatsApp. The customer doesn't wait for your morning. They message three shops and go with the one that answers.\n\nAn AI agent on your WhatsApp number answers in seconds, qualifies the lead, books the slot and hands over to you in the morning with everything ready.\n\nWant to see it on your number? Comment "AGENT" and we'll show you a live demo.\n\n${HASH}`,
  'v2-asleep': `POV: you're asleep. Your business just booked 3 appointments. 🛏️✅\n\nThis is what an AI agent actually does at night:\n• answers "price?" and "available?" instantly\n• asks the two questions you'd ask\n• books the slot on your calendar\n• follows up if they go quiet\n\nYou wake up to bookings, not a backlog.\n\nDM "SLEEP" and we'll show you what your night messages look like right now.\n\n${HASH}`,
  'v3-missed-calls': `27 missed calls is not a phone problem. ☎️\n\nIt's 27 customers who called the next shop.\n\nReceptionists take lunch, take leave, take the other line. An AI calling agent picks up every call in under a second, speaks Hindi and regional languages, answers the common questions and books the appointment. Real emergencies get transferred to a human.\n\nHow many calls did your business miss this week? Check your call log and tell us in the comments. 👇\n\n${HASH} #AICalling`,
  'v4-stop-hiring': `I'm not saying fire anyone. I'm saying stop hiring for THIS. 🧾\n\nReplying to leads. Confirming appointments. Entering invoices. Chasing abandoned carts. Answering the same 20 questions.\n\nAn AI agent does that work in seconds, 24×7, never calls in sick and costs a fraction of a salary. Your people get to do the work only people can do.\n\nWhich job would you hand over first? Comment below. 👇\n\n${HASH}`,
  'v5-ten-jobs': `The only candidate who can do ten jobs. 🔥\n\nWebsite. Meta ads. Social media. Digital campaigns. WhatsApp AI. AI calling. Ecommerce AI. ERP AI. AI automation. SEO and AI search.\n\nTen heads, one retainer, one monthly report. No notice period, no leave, no attitude.\n\nHire the heads you need. Link in bio.\n\n${HASH}`,
  'v6-five-jobs': `5 jobs an AI agent can take off your plate by Friday. ✅\n\n01 Reply to every WhatsApp enquiry in under 5 seconds\n02 Call back every missed call and book the slot\n03 Enter invoices into Tally or Zoho from photos and PDFs\n04 Recover abandoned carts\n05 Post and reply on social media every day\n\nAll five run on the same team, with a human in the loop.\n\nComment the number you'd hand over first. 👇\n\n${HASH}`,
  'v7-first-agent': `Your first AI agent. On us. 🎁\n\nTell us what you sell. We put one agent on your WhatsApp or your phone line, and you watch what it answers, qualifies and books in the first week.\n\nOne call. No decks. No lock-in.\n\nComment "AGENT" or DM us to claim your slot. ${DOMAIN}\n\n${HASH}`,
}
writeFileSync(resolve(OUT, 'captions.md'), `# Viral hook posts · captions\n\nOne section per image in this folder. Post order suggestion: v1, v3, v6, v2, v4, v5, v7 (hooks first, CTA last).\n\n` + Object.entries(caps).map(([k, v]) => `## ${k}\n${v}`).join('\n\n'))
