#!/usr/bin/env node
/*
 * build-posts.mjs — Instagram profile photos and a first batch of feed posts
 * (1080x1350, 4:5) for the ten heads, rendered with headless Chrome from HTML.
 *
 *   node scripts/brand/build-posts.mjs        # everything -> brand-kit/instagram/
 *   node scripts/brand/build-posts.mjs 03     # only boards whose id contains "03"
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = resolve(ROOT, 'brand-kit/instagram')
const TMP = resolve(OUT, '_html')
mkdirSync(resolve(OUT, 'posts'), { recursive: true })
mkdirSync(resolve(OUT, 'profile'), { recursive: true })
mkdirSync(TMP, { recursive: true })

const C = { ground: '#0D0907', cream: '#F4EADB', muted: '#A3937F', gold: '#F0A32F', ember: '#E2571E', maroon: '#8E1F1F', paper: '#F5F0E6', ink: '#201812', mint: '#5FD3A3', green: '#2E9E6E' }
const DOMAIN = 'marketingravan.com'
const data = (p, mime) => `data:${mime};base64,` + readFileSync(resolve(ROOT, p)).toString('base64')
const mark = data('assets-src/logo/mark.png', 'image/png')
const portrait = (icon) => data(`assets-src/agents-cut/${icon}-3.png`, 'image/png')

/* the ten heads, copied from site/src/data/heads.js so this script runs standalone */
const HEADS = [
  { n: 1, short: 'Website Design', title: 'Premium websites. Trusted brands.', metric: 'Make an impression. Earn their confidence.', icon: 'uiux', group: 'grow', persona: 'The Artisan', desc: 'Fast, interactive websites in the Linear, Apple and Stripe school. Designed to convert, built to load instantly, kept fresh every month.' },
  { n: 2, short: 'Meta Ads', title: 'Ads that turn attention into enquiries.', metric: 'Attention. Interest. Enquiries.', icon: 'ads', group: 'grow', persona: 'The Showman', desc: 'Meta campaigns run end to end: AI-generated creatives, audience testing, retargeting and landing pages tuned for every segment.' },
  { n: 3, short: 'WhatsApp AI', title: 'A sales agent on your WhatsApp number.', metric: 'Replies in under 5 seconds, 24/7', icon: 'sdr', group: 'automate', persona: 'The Closer', desc: 'Answers enquiries, qualifies leads, books appointments and follows up. Hands over to a human when it should.' },
  { n: 4, short: 'AI Calling', title: 'Voice agents that never miss a lead.', metric: 'Picks up in under 1 second', icon: 'voice', group: 'automate', persona: 'The Orator', desc: 'Natural-sounding voice agents that pick up every call, qualify leads and run follow-ups in Hindi and regional languages.' },
  { n: 5, short: 'Social Media', title: 'Your social media, managed every day.', metric: '30 posts a month, zero effort', icon: 'social', group: 'grow', persona: 'The Storyteller', desc: 'Reels, posts, stories and captions planned, designed, scheduled and replied to. Instagram, Facebook, LinkedIn and YouTube, on brand.' },
  { n: 6, short: 'Digital Campaigns', title: 'Google, YouTube and email, full funnel.', metric: '3x pipeline', icon: 'campaign', group: 'grow', persona: 'The Strategist', desc: 'One offer taken all the way: Search, YouTube, LinkedIn and email working together with retargeting and a landing page built to close.' },
  { n: 7, short: 'Ecommerce AI', title: 'Agents that run and grow your store.', metric: '+40% repeat orders', icon: 'ecom', group: 'automate', persona: 'The Merchant', desc: 'Abandoned-cart recovery, order updates, product questions and marketplace sync for Shopify, WooCommerce, Amazon and Flipkart.' },
  { n: 8, short: 'ERP AI', title: 'Invoices, stock and accounts, handled.', metric: '99.9% data accuracy', icon: 'erp', group: 'automate', persona: 'The Quartermaster', desc: 'Receipts, PDFs and invoices read by AI straight into your books and inventory. Tally, Zoho, Odoo or a modern ERP we set up.' },
  { n: 9, short: 'AI Automation', title: 'AI agents for everyday business tasks.', metric: '10x faster execution', icon: 'agent', group: 'automate', persona: 'The Operator', desc: 'Agents that do the repetitive work across your apps: CRM updates, emails, reports and meeting bookings without anyone lifting a finger.' },
  { n: 10, short: 'SEO & AI Search', title: 'Rank on Google, ChatGPT and Perplexity.', metric: '#1 AI search visibility', icon: 'geo', group: 'grow', persona: 'The Sage', desc: 'Search is moving to AI engines. We get you ranked on Google and cited by ChatGPT, Perplexity and Gemini.' },
]
const GROUP = { grow: { label: 'Grow', a: C.gold, b: C.ember }, automate: { label: 'Automate', a: C.mint, b: C.green } }

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">`
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1080px;height:1350px;background:${C.ground};color:${C.cream};font-family:'Instrument Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}
  .display{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.03em;line-height:.94}
  .word{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.025em;white-space:nowrap}
  .word b{color:${C.gold}}
  .tag{font-weight:600;letter-spacing:.22em;text-transform:uppercase}
  .bar{position:absolute;left:0;right:0;bottom:0;height:12px}
  .brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px}
  .brand .m{height:60px}.brand img{height:100%;width:auto;display:block}
  .foot{position:absolute;left:72px;right:72px;bottom:56px;display:flex;justify-content:space-between;align-items:flex-end;font-size:24px}
  .num{position:absolute;right:48px;top:24px;font-family:'Bricolage Grotesque';font-weight:800;font-size:520px;line-height:1;letter-spacing:-.06em;opacity:.07;pointer-events:none}
  .pill{display:inline-block;padding:10px 22px;border-radius:999px;font-size:20px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${C.ground}}
  .portrait{position:absolute;right:-30px;bottom:0;height:640px;width:auto;display:block;filter:drop-shadow(0 30px 60px rgba(0,0,0,.55))}
  .glow{position:absolute;inset:0;pointer-events:none}
`
const page = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}${extra}</style></head><body>${body}</body></html>`
const brand = `<div class="brand"><div class="m"><img src="${mark}"></div><div class="word" style="font-size:30px">MARKETING <b>RAVAN</b></div></div>`
const foot = (right = DOMAIN) => `<div class="foot"><div class="tag" style="font-size:18px;color:${C.muted}">The Ten-Headed Growth Engine</div><div style="font-weight:700;color:${C.gold}">${right}</div></div>`
const footLeft = (txt = DOMAIN) => `<div class="foot" style="justify-content:flex-start"><div style="font-weight:700;color:${C.gold}">${txt}</div></div>`
const bar = (a = C.gold, b = C.ember) => `<div class="bar" style="background:linear-gradient(90deg,${a},${b})"></div>`

/* ---------- boards ---------- */
const boards = []

// 00 intro
boards.push({ id: '00-intro', body: `
  <div class="glow" style="background:radial-gradient(55% 45% at 50% 42%, rgba(240,163,47,.22), transparent 70%)"></div>
  ${brand}
  <div style="position:absolute;left:50%;top:180px;transform:translateX(-50%);height:560px"><img src="${mark}" style="height:100%;width:auto;display:block;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))"></div>
  <div class="display" style="position:absolute;left:72px;right:72px;top:790px;font-size:112px">Ten heads.<br>Ten jobs.<br><span style="color:${C.gold}">One Ravan.</span></div>
  <div style="position:absolute;left:72px;right:72px;top:1150px;font-size:30px;line-height:1.4;color:${C.muted};max-width:760px">Website, ads, social, WhatsApp, calls, store, books and search. One team, one retainer.</div>
  ${foot()}${bar()}` })

// 01..10 one per head
for (const h of HEADS) {
  const g = GROUP[h.group]
  const nn = String(h.n).padStart(2, '0')
  boards.push({ id: `${nn}-${h.icon}`, body: `
    <div class="glow" style="background:radial-gradient(60% 50% at 72% 78%, ${g.a}33, transparent 70%)"></div>
    <div class="num" style="color:${g.a}">${nn}</div>
    ${brand}
    <img class="portrait" src="${portrait(h.icon)}">
    <div style="position:absolute;left:72px;top:176px;width:600px">
      <span class="pill" style="background:linear-gradient(90deg,${g.a},${g.b})">Head ${nn} · ${g.label}</span>
      <div class="display" style="font-size:84px;margin-top:30px">${h.short}</div>
      <div class="display" style="font-size:40px;margin-top:22px;color:${g.a};font-weight:700;letter-spacing:-.02em;max-width:520px">${h.title}</div>
      <div style="font-size:26px;line-height:1.42;margin-top:22px;color:${C.cream};opacity:.85;max-width:470px">${h.desc}</div>
      <div class="tag" style="font-size:17px;margin-top:26px;color:${C.muted}">${h.persona}</div>
      <div style="font-family:'Bricolage Grotesque';font-weight:700;font-size:26px;margin-top:8px;color:${g.a};letter-spacing:-.01em">${h.metric}</div>
    </div>
    ${footLeft()}${bar(g.a, g.b)}` })
}

// 11 the two groups at a glance
const col = (key) => {
  const g = GROUP[key]
  return `<div style="flex:1">
    <span class="pill" style="background:linear-gradient(90deg,${g.a},${g.b})">${g.label}</span>
    <ul style="list-style:none;margin-top:30px">${HEADS.filter((h) => h.group === key).map((h) => `<li style="display:flex;gap:18px;align-items:baseline;padding:16px 0;border-bottom:1px solid rgba(244,234,219,.1)"><span style="font-family:'Bricolage Grotesque';font-weight:800;color:${g.a};font-size:26px;width:44px">${String(h.n).padStart(2, '0')}</span><span class="display" style="font-size:36px;font-weight:700;letter-spacing:-.02em">${h.short}</span></li>`).join('')}</ul>
  </div>`
}
boards.push({ id: '11-grow-automate', body: `
  ${brand}
  <div class="display" style="position:absolute;left:72px;right:72px;top:190px;font-size:80px">Five heads <span style="color:${C.gold}">grow</span> you.<br>Five heads <span style="color:${C.mint}">automate</span> you.</div>
  <div style="position:absolute;left:72px;right:72px;top:470px;display:flex;gap:56px">${col('grow')}${col('automate')}</div>
  ${foot()}${bar(C.gold, C.mint)}` })

// 12 call to action
boards.push({ id: '12-talk-to-ravan', body: `
  <div class="glow" style="background:radial-gradient(60% 50% at 75% 80%, rgba(240,163,47,.22), transparent 70%)"></div>
  ${brand}
  <img class="portrait" src="${portrait('sdr')}" style="height:760px;right:-60px">
  <div style="position:absolute;left:72px;top:220px;width:600px">
    <div class="display" style="font-size:104px">Talk to<br><span style="color:${C.gold}">Ravan.</span></div>
    <div style="font-size:30px;line-height:1.45;margin-top:40px;opacity:.85;max-width:520px">Tell us what you sell. We'll show you which heads you need and what it costs. One call, no decks.</div>
    <div style="margin-top:48px;display:inline-block;padding:22px 40px;border-radius:999px;background:${C.gold};color:${C.ground};font-weight:700;font-size:28px">${DOMAIN}</div>
  </div>
  ${footLeft('info@' + DOMAIN)}${bar()}` })

/* ---------- profile photos (1024 square) ---------- */
const pfp = (bg, id) => ({ id, w: 1024, h: 1024, dir: 'profile', body: `<div style="position:absolute;inset:0;background:${bg};display:flex;align-items:center;justify-content:center"><div style="height:690px"><img src="${mark}" style="height:100%;width:auto;display:block"></div></div>`, extra: 'body{width:1024px;height:1024px}' })
boards.push(pfp(C.ground, 'avatar-dark'))
boards.push(pfp(`linear-gradient(160deg,${C.gold},${C.ember})`, 'avatar-gold'))
boards.push(pfp(C.paper, 'avatar-cream'))
boards.push(pfp(`radial-gradient(70% 70% at 50% 40%, #2a1a10, ${C.ground})`, 'avatar-glow'))

/* ---------- render ---------- */
const want = process.argv.slice(2)
for (const b of boards) {
  if (want.length && !want.some((w) => b.id.includes(w))) continue
  const html = resolve(TMP, b.id + '.html')
  writeFileSync(html, page(b.body, b.extra || ''))
  const out = resolve(OUT, b.dir || 'posts', b.id + '.png')
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=12000', `--window-size=${b.w || 1080},${b.h || 1350}`, `--screenshot=${out}`, 'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8' })
  console.log(r.status === 0 ? 'ok  ' : 'FAIL', b.id)
}

/* ---------- captions ---------- */
const HASH = '#MarketingRavan #AIAgents #DigitalMarketingIndia #GrowthMarketing #SmallBusinessIndia #MarketingAgency'
const cap = []
cap.push(`## 00-intro\nTen heads. Ten jobs. One Ravan. 🔥\n\nWebsite, ads, social, WhatsApp, calls, store, books and search. One team, one retainer, one monthly report.\n\nMeet the ten heads over the next ten posts.\n\n${HASH}`)
for (const h of HEADS) cap.push(`## ${String(h.n).padStart(2, '0')}-${h.icon}\nHead ${String(h.n).padStart(2, '0')}: ${h.short}. ${h.persona}.\n\n${h.title}\n\n${h.desc}\n\n${h.metric}\n\nWant this head on your team? Link in bio.\n\n${HASH} #${h.short.replace(/[^A-Za-z]/g, '')}`)
cap.push(`## 11-grow-automate\nFive heads grow you. Five heads automate you.\n\nGrow: website, Meta ads, social media, digital campaigns, SEO and AI search.\nAutomate: WhatsApp AI, AI calling, ecommerce AI, ERP AI, AI automation.\n\nPick the heads you need. Pay one retainer.\n\n${HASH}`)
cap.push(`## 12-talk-to-ravan\nTalk to Ravan.\n\nTell us what you sell. We'll show you which heads you need and what it costs. One call, no decks.\n\n${DOMAIN} · info@${DOMAIN}\n\n${HASH}`)
writeFileSync(resolve(OUT, 'captions.md'), `# Instagram captions\n\nOne section per post image in posts/. Hashtags are a starting set; swap in city or niche tags per post.\n\n` + cap.join('\n\n'))
console.log('captions.md written')
