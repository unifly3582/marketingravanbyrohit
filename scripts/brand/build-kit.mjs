#!/usr/bin/env node
/*
 * build-kit.mjs — renders the Marketing Ravan brand kit from HTML artboards
 * with headless Chrome. Needs assets-src/logo/mark.png (transparent mark).
 *
 *   node scripts/brand/build-kit.mjs            # everything
 *   node scripts/brand/build-kit.mjs og card    # only boards whose id matches
 *
 * Output goes to brand-kit/<group>/...
 */
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = resolve(ROOT, 'brand-kit')
const TMP = resolve(OUT, '_html')
mkdirSync(TMP, { recursive: true })

const B = {
  name: 'Marketing Ravan',
  tagline: 'The Ten-Headed Growth Engine',
  domain: 'marketingravan.com',
  url: 'https://marketingravan.com',
  email: 'info@marketingravan.com',
  phone: '+91 00000 00000',          // TODO real number
  address: 'Registered office address, City, State 000000', // TODO
  gst: 'GSTIN 00AAAAA0000A1Z0',      // TODO
  person: 'Your Name',
  role: 'Founder & CEO',
}
const C = { ground: '#0D0907', surface: '#16100C', card: '#1D1510', cream: '#F4EADB', muted: '#A3937F', gold: '#F0A32F', ember: '#E2571E', maroon: '#8E1F1F', paper: '#F5F0E6', ink: '#201812', inkMuted: '#6F6354' }

const markData = 'data:image/png;base64,' + readFileSync(resolve(ROOT, 'assets-src/logo/mark.png')).toString('base64')
const qrPath = resolve(OUT, '_qr.png')
const qrData = existsSync(qrPath) ? 'data:image/png;base64,' + readFileSync(qrPath).toString('base64') : ''

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">`

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%}
  body{font-family:'Instrument Sans',system-ui,sans-serif;color:${C.cream};-webkit-font-smoothing:antialiased;overflow:hidden}
  .display{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.03em;line-height:.92}
  .word{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.025em;line-height:1;white-space:nowrap}
  .word b{font-weight:800;color:${C.gold}}
  .tag{font-family:'Instrument Sans',sans-serif;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
  .dark{background:${C.ground};color:${C.cream}}
  .light{background:${C.paper};color:${C.ink}}
  .clear{background:transparent}
  .center{display:flex;align-items:center;justify-content:center}
  img.mark{display:block;height:100%;width:auto}
`

const page = (w, h, cls, css, body) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
  body{width:${w}px;height:${h}px}${css}</style></head><body class="${cls}">${body}</body></html>`

/* ---------- lockups ---------- */
const lockupH = ({ mark = 300, font = 210, gap = 54, tagline = false, ink = C.cream }) => `
  <div class="center" style="gap:${gap}px;height:100%">
    <div style="height:${mark}px"><img class="mark" src="${markData}"></div>
    <div>
      <div class="word" style="font-size:${font}px;color:${ink}">MARKETING <b>RAVAN</b></div>
      ${tagline ? `<div class="tag" style="font-size:${font * 0.17}px;margin-top:${font * 0.16}px;color:${ink};opacity:.62">${B.tagline}</div>` : ''}
    </div>
  </div>`
const lockupS = ({ mark = 520, font = 150, gap = 56, tagline = false, ink = C.cream }) => `
  <div class="center" style="flex-direction:column;gap:${gap}px;height:100%">
    <div style="height:${mark}px"><img class="mark" src="${markData}"></div>
    <div style="text-align:center">
      <div class="word" style="font-size:${font}px;color:${ink}">MARKETING <b>RAVAN</b></div>
      ${tagline ? `<div class="tag" style="font-size:${font * 0.17}px;margin-top:${font * 0.2}px;color:${ink};opacity:.62">${B.tagline}</div>` : ''}
    </div>
  </div>`
const wordmark = ({ font = 240, ink = C.cream }) => `<div class="center" style="height:100%"><div class="word" style="font-size:${font}px;color:${ink}">MARKETING <b>RAVAN</b></div></div>`

/* ---------- social / og composition ---------- */
const hero = ({ w, h, markH, font, pad, tagline = true, domain = true, safe = null }) => `
  <div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">
    <div style="position:absolute;inset:0;background:radial-gradient(60% 90% at 78% 50%, rgba(240,163,47,.16), transparent 70%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,${C.gold},${C.ember})"></div>
    ${safe ? `<div style="position:absolute;left:50%;top:50%;width:${safe[0]}px;height:${safe[1]}px;transform:translate(-50%,-50%)">` : ''}
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 ${pad}px">
      <div>
        <div class="word" style="font-size:${font}px">MARKETING<br><b>RAVAN</b></div>
        ${tagline ? `<div class="tag" style="font-size:${font * 0.16}px;margin-top:${font * 0.18}px;color:${C.muted}">${B.tagline}</div>` : ''}
        ${domain ? `<div style="font-size:${font * 0.15}px;margin-top:${font * 0.36}px;color:${C.gold};font-weight:600">${B.domain}</div>` : ''}
      </div>
      <div style="height:${markH}px"><img class="mark" src="${markData}"></div>
    </div>
    ${safe ? '</div>' : ''}
  </div>`

/* ---------- letterhead ---------- */
const letterhead = (preview) => `
  <div class="sheet">
    <header>
      <div style="display:flex;align-items:center;gap:5.5mm">
        <div style="height:17mm"><img class="mark" src="${markData}"></div>
        <div>
          <div class="word" style="font-size:8.6mm;color:${C.ink}">MARKETING <b>RAVAN</b></div>
          <div class="tag" style="font-size:2.2mm;margin-top:1.6mm;color:${C.inkMuted}">${B.tagline}</div>
        </div>
      </div>
      <div class="contact">
        <div>${B.url.replace('https://', '')}</div>
        <div>${B.email}</div>
        <div>${B.phone}</div>
      </div>
    </header>
    <div class="rule"></div>
    ${preview ? `<main>
      <p class="meta">17 September 2026</p>
      <p class="meta">To,<br>Client Name<br>Company Name<br>City</p>
      <p class="sub">Subject: Proposal for the ten-heads growth retainer</p>
      <p>Dear Client,</p>
      <p>Thank you for the conversation this week. As discussed, this letter outlines how Marketing Ravan would run your website, Meta ads, WhatsApp and voice agents, and social media under one retainer, with one point of contact and one monthly report.</p>
      <p>We look forward to working with you.</p>
      <p style="margin-top:14mm">Warm regards,</p>
      <p style="margin-top:12mm"><strong>${B.person}</strong><br>${B.role}, ${B.name}</p>
    </main>` : '<main></main>'}
    <img class="wm" src="${markData}">
    <footer>
      <div>${B.name} · ${B.address}</div>
      <div>${B.gst}</div>
    </footer>
  </div>`
const LETTER_CSS = `
  @page{size:A4;margin:0}
  body{background:${C.paper};color:${C.ink};width:210mm;height:297mm}
  .sheet{position:relative;width:210mm;height:297mm;padding:16mm 18mm 14mm;overflow:hidden}
  header{display:flex;justify-content:space-between;align-items:center}
  .contact{text-align:right;font-size:3.1mm;line-height:1.7;color:${C.inkMuted};font-weight:500}
  .rule{height:.7mm;margin:9mm 0 12mm;background:linear-gradient(90deg,${C.gold},${C.ember} 60%,transparent)}
  main{font-size:3.6mm;line-height:1.65;color:${C.ink};min-height:150mm}
  main p{margin-bottom:4.5mm;max-width:150mm}
  .meta{color:${C.inkMuted}} .sub{font-weight:700}
  .wm{position:absolute;right:-18mm;bottom:10mm;height:95mm;opacity:.045;pointer-events:none}
  footer{position:absolute;left:18mm;right:18mm;bottom:12mm;display:flex;justify-content:space-between;font-size:2.7mm;color:${C.inkMuted};border-top:.3mm solid rgba(32,24,18,.14);padding-top:3.5mm}
`

/* ---------- visiting card 90x55mm + 3mm bleed ---------- */
const CARD_CSS = `
  @page{size:96mm 61mm;margin:0}
  body{width:96mm;height:61mm}
  .card{position:relative;width:96mm;height:61mm;overflow:hidden;page-break-after:always}
  .safe{position:absolute;inset:8mm}
  .front{background:${C.ground};color:${C.cream}}
  .back{background:${C.paper};color:${C.ink}}
  .front .glow{position:absolute;inset:0;background:radial-gradient(50% 80% at 82% 55%, rgba(240,163,47,.18), transparent 70%)}
  .bar{position:absolute;left:0;right:0;bottom:0;height:1.6mm;background:linear-gradient(90deg,${C.gold},${C.ember})}
`
const card = () => `
  <div class="card front"><div class="glow"></div>
    <div class="safe" style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="word" style="font-size:8.2mm">MARKETING<br><b>RAVAN</b></div>
        <div class="tag" style="font-size:1.75mm;margin-top:2.4mm;color:${C.muted}">${B.tagline}</div>
      </div>
      <div style="height:34mm"><img class="mark" src="${markData}"></div>
    </div>
    <div class="bar"></div>
  </div>
  <div class="card back">
    <div class="safe" style="display:flex;justify-content:space-between">
      <div style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div class="display" style="font-size:6.2mm;letter-spacing:-.02em">${B.person}</div>
          <div class="tag" style="font-size:1.8mm;margin-top:1.6mm;color:${C.gold}">${B.role}</div>
        </div>
        <div style="font-size:2.7mm;line-height:1.75;color:${C.inkMuted};font-weight:500">
          <div>${B.phone}</div><div>${B.email}</div><div style="color:${C.ink};font-weight:600">${B.domain}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between">
        <div style="height:9mm"><img class="mark" src="${markData}"></div>
        ${qrData ? `<img src="${qrData}" style="width:16mm;height:16mm;image-rendering:pixelated">` : ''}
      </div>
    </div>
    <div class="bar"></div>
  </div>`

/* ---------- brand sheet ---------- */
const swatch = (name, hex, rgb, cmyk, dark = true) => `
  <div style="flex:1;min-width:0"><div style="height:26mm;background:${hex};border-radius:2mm;border:.3mm solid rgba(32,24,18,.1)"></div>
  <div style="font-weight:700;font-size:3.2mm;margin-top:2mm">${name}</div>
  <div style="font-size:2.5mm;color:${C.inkMuted};line-height:1.6">${hex}<br>RGB ${rgb}<br>CMYK ${cmyk}</div></div>`
const SHEET_CSS = `
  @page{size:A4 landscape;margin:0}
  body{width:297mm;height:210mm;background:${C.paper};color:${C.ink}}
  .sheet{position:relative;width:297mm;height:210mm;padding:12mm 14mm}
  h1{font-family:'Bricolage Grotesque';font-weight:800;font-size:9mm;letter-spacing:-.03em}
  h2{font-family:'Instrument Sans';font-weight:700;font-size:2.6mm;letter-spacing:.2em;text-transform:uppercase;color:${C.inkMuted};margin-bottom:3.5mm}
  .grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10mm;margin-top:7mm}
  .grid>div{min-width:0}
  .box{border-radius:3mm;padding:6mm;display:flex;align-items:center;justify-content:center}
  .tile{display:flex;gap:4mm}
  .small{font-size:2.8mm;line-height:1.6;color:${C.inkMuted}}
  ul{padding-left:4mm;font-size:2.8mm;line-height:1.7}
`
const sheet = () => `
  <div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div><h1>Marketing Ravan brand sheet</h1><div class="small">Logo, colour, type and usage rules · v1 · September 2026</div></div>
      <div style="height:16mm"><img class="mark" src="${markData}"></div>
    </div>
    <div class="grid">
      <div>
        <h2>Primary lockups</h2>
        <div class="box dark" style="height:38mm;overflow:hidden">${lockupH({ mark: 78, font: 50, gap: 14 })}</div>
        <div class="box light" style="height:38mm;overflow:hidden;border:.3mm solid rgba(32,24,18,.12);margin-top:4mm">${lockupH({ mark: 78, font: 50, gap: 14, ink: C.ink })}</div>
        <h2 style="margin-top:6mm">Colour</h2>
        <div class="tile">
          ${swatch('Ground', C.ground, '13 9 7', '75 75 75 90')}
          ${swatch('Cream', C.cream, '244 234 219', '3 6 13 0')}
          ${swatch('Gold', C.gold, '240 163 47', '0 36 88 0')}
          ${swatch('Ember', C.ember, '226 87 30', '0 70 95 0')}
          ${swatch('Maroon', C.maroon, '142 31 31', '25 95 90 20')}
        </div>
      </div>
      <div>
        <h2>Mark, clear space and minimum size</h2>
        <div style="display:flex;gap:5mm">
          <div class="box dark" style="width:38mm;height:38mm;flex:none"><div style="height:24mm;outline:.3mm dashed rgba(244,234,219,.35);outline-offset:5mm"><img class="mark" src="${markData}"></div></div>
          <div class="box light" style="width:38mm;height:38mm;flex:none;border:.3mm solid rgba(32,24,18,.12)"><div style="height:24mm"><img class="mark" src="${markData}"></div></div>
          <div class="small" style="flex:1">Clear space around the mark and lockup equals the height of the crown ruby on all sides. Minimum mark height: 24 px on screen, 8 mm in print. Below that use the wordmark alone.</div>
        </div>
        <h2 style="margin-top:6mm">Typography</h2>
        <div class="display" style="font-size:7.4mm">Bricolage Grotesque 800</div>
        <div class="small">Headlines and the wordmark. Tight tracking, sentence case in copy, all caps only for the wordmark.</div>
        <div style="font-family:'Instrument Sans';font-size:5mm;font-weight:500;margin-top:3mm">Instrument Sans 400 / 500 / 600</div>
        <div class="small">Body, UI, letters and cards. Both fonts are Google Fonts, free for print and web.</div>
        <h2 style="margin-top:6mm">Rules</h2>
        <ul>
          <li>Use the cream wordmark on dark, the ink wordmark on light. RAVAN is always gold.</li>
          <li>Never stretch, rotate, recolour, add shadows or place the mark on busy photos.</li>
          <li>One-colour uses: the gold mark on ground, or ink on paper.</li>
          <li>Spell the brand RAVAN, never Raavan.</li>
        </ul>
      </div>
    </div>
  </div>`

/* ---------- boards ---------- */
const boards = [
  // logo lockups (transparent, trimmed later)
  { id: 'logo/logo-horizontal-for-dark', w: 2600, h: 700, cls: 'clear', body: lockupH({}) , trim: true },
  { id: 'logo/logo-horizontal-for-light', w: 2600, h: 700, cls: 'clear', body: lockupH({ ink: C.ink }), trim: true },
  { id: 'logo/logo-horizontal-tagline-for-dark', w: 2600, h: 700, cls: 'clear', body: lockupH({ tagline: true }), trim: true },
  { id: 'logo/logo-horizontal-tagline-for-light', w: 2600, h: 700, cls: 'clear', body: lockupH({ tagline: true, ink: C.ink }), trim: true },
  { id: 'logo/logo-stacked-for-dark', w: 1600, h: 1300, cls: 'clear', body: lockupS({}), trim: true },
  { id: 'logo/logo-stacked-for-light', w: 1600, h: 1300, cls: 'clear', body: lockupS({ ink: C.ink }), trim: true },
  { id: 'logo/wordmark-for-dark', w: 2200, h: 400, cls: 'clear', body: wordmark({}), trim: true },
  { id: 'logo/wordmark-for-light', w: 2200, h: 400, cls: 'clear', body: wordmark({ ink: C.ink }), trim: true },
  { id: 'logo/logo-horizontal-on-dark', w: 2600, h: 900, cls: 'dark', body: lockupH({}) },
  { id: 'logo/logo-horizontal-on-light', w: 2600, h: 900, cls: 'light', body: lockupH({ ink: C.ink }) },
  { id: 'logo/logo-stacked-on-dark', w: 1600, h: 1600, cls: 'dark', body: lockupS({}) },
  { id: 'logo/logo-stacked-on-light', w: 1600, h: 1600, cls: 'light', body: lockupS({ ink: C.ink }) },
  // web + social
  { id: 'web/og-image-1200x630', w: 1200, h: 630, cls: 'dark', body: hero({ w: 1200, h: 630, markH: 440, font: 108, pad: 84 }) },
  { id: 'social/avatar-1024', w: 1024, h: 1024, cls: 'dark', body: `<div class="center" style="height:100%"><div style="height:700px"><img class="mark" src="${markData}"></div></div>` },
  { id: 'social/avatar-gold-1024', w: 1024, h: 1024, cls: '', css: `body{background:linear-gradient(160deg,${C.gold},${C.ember})}`, body: `<div class="center" style="height:100%"><div style="height:700px"><img class="mark" src="${markData}"></div></div>` },
  { id: 'social/linkedin-cover-1584x396', w: 1584, h: 396, cls: 'dark', body: hero({ w: 1584, h: 396, markH: 300, font: 76, pad: 420, domain: false }) },
  { id: 'social/x-header-1500x500', w: 1500, h: 500, cls: 'dark', body: hero({ w: 1500, h: 500, markH: 380, font: 92, pad: 120 }) },
  { id: 'social/facebook-cover-1640x624', w: 1640, h: 624, cls: 'dark', body: hero({ w: 1640, h: 624, markH: 460, font: 110, pad: 150 }) },
  { id: 'social/youtube-banner-2560x1440', w: 2560, h: 1440, cls: 'dark', body: hero({ w: 2560, h: 1440, markH: 400, font: 118, pad: 150, safe: [1546, 423] }) },
  { id: 'social/instagram-post-1080', w: 1080, h: 1080, cls: 'dark', body: `
      <div style="position:relative;height:100%;padding:72px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:18px"><div style="height:64px"><img class="mark" src="${markData}"></div><div class="word" style="font-size:30px">MARKETING <b>RAVAN</b></div></div>
        <div class="display" style="font-size:118px">Ten heads.<br>Ten jobs.<br><span style="color:${C.gold}">One Ravan.</span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end"><div class="tag" style="font-size:20px;color:${C.muted}">${B.tagline}</div><div style="font-weight:600;color:${C.gold};font-size:26px">${B.domain}</div></div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,${C.gold},${C.ember})"></div>
      </div>` },
  { id: 'social/instagram-story-1080x1920', w: 1080, h: 1920, cls: 'dark', body: `
      <div style="position:relative;height:100%;padding:220px 90px 200px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center">
        <div style="height:520px"><img class="mark" src="${markData}"></div>
        <div class="display" style="font-size:132px">Ten heads.<br>Ten jobs.<br><span style="color:${C.gold}">One Ravan.</span></div>
        <div><div class="word" style="font-size:44px">MARKETING <b>RAVAN</b></div><div style="font-weight:600;color:${C.gold};font-size:30px;margin-top:22px">${B.domain}</div></div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,${C.gold},${C.ember})"></div>
      </div>` },
  // print
  { id: 'stationery/letterhead-A4', w: 1240, h: 1754, cls: 'light', css: LETTER_CSS, body: letterhead(true), pdf: true, scale: 1240 / 793.7 },
  { id: 'stationery/letterhead-A4-blank', w: 1240, h: 1754, cls: 'light', css: LETTER_CSS, body: letterhead(false), pdf: true, scale: 1240 / 793.7, pdfOnly: true },
  { id: 'stationery/visiting-card', w: 1134, h: 720, cls: 'dark', css: CARD_CSS, body: card(), pdf: true, scale: 1134 / 362.8, split: ['front', 'back'] },
  { id: 'brand-sheet/brand-sheet-A4', w: 1754, h: 1240, cls: 'light', css: SHEET_CSS, body: sheet(), pdf: true, scale: 1754 / 1122.5 },
]

const want = process.argv.slice(2)
const run = (args) => {
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-pdf-header-footer', '--virtual-time-budget=12000', ...args], { encoding: 'utf8' })
  if (r.status !== 0) console.error(r.stderr.slice(-400))
}
for (const b of boards) {
  if (want.length && !want.some((w) => b.id.includes(w))) continue
  const html = resolve(TMP, b.id.replace('/', '__') + '.html')
  const outPng = resolve(OUT, b.id + '.png')
  mkdirSync(dirname(outPng), { recursive: true })
  writeFileSync(html, page(b.w, b.h, b.cls, b.css || '', b.body))
  const url = 'file:///' + html.replace(/\\/g, '/')
  if (b.pdf) run([`--print-to-pdf=${resolve(OUT, b.id + '.pdf')}`, url])
  if (b.pdfOnly) { console.log('pdf ', b.id); continue }
  if (b.split) {
    // print each page as its own PNG by hiding the other
    b.split.forEach((name, i) => {
      const h2 = html.replace('.html', `-${name}.html`)
      writeFileSync(h2, page(b.w, b.h, b.cls, (b.css || '') + `.card:nth-of-type(${i === 0 ? 2 : 1}){display:none}` + `html{zoom:${b.scale}}`, b.body))
      run([`--screenshot=${resolve(OUT, `${b.id}-${name}.png`)}`, `--window-size=${b.w},${b.h}`, 'file:///' + h2.replace(/\\/g, '/')])
    })
    console.log('png+pdf', b.id); continue
  }
  if (b.scale) writeFileSync(html, page(b.w, b.h, b.cls, (b.css || '') + `html{zoom:${b.scale}}`, b.body))
  run([`--screenshot=${outPng}`, `--window-size=${b.w},${b.h}`, ...(b.cls === 'clear' ? ['--default-background-color=00000000'] : []), url])
  console.log(b.pdf ? 'png+pdf' : 'png ', b.id)
}

/* email signature (hosted image) */
const sig = `<!-- Marketing Ravan email signature. Paste into Gmail: Settings > See all settings > Signature (use a browser, insert as HTML via a signature tool, or copy the rendered block). -->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#201812">
  <tr>
    <td style="padding-right:16px;vertical-align:top"><img src="${B.url}/brand/mark-160.png" width="72" height="81" alt="${B.name}" style="display:block;border:0"></td>
    <td style="border-left:2px solid #F0A32F;padding-left:16px;vertical-align:top">
      <div style="font-size:15px;font-weight:bold;color:#201812">${B.person}</div>
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#E2571E;font-weight:bold">${B.role} · ${B.name}</div>
      <div style="margin-top:8px"><a href="tel:${B.phone.replace(/\s/g, '')}" style="color:#201812;text-decoration:none">${B.phone}</a> &nbsp;·&nbsp; <a href="mailto:${B.email}" style="color:#201812;text-decoration:none">${B.email}</a></div>
      <div><a href="${B.url}" style="color:#F0A32F;font-weight:bold;text-decoration:none">${B.domain}</a></div>
      <div style="margin-top:6px;font-size:11px;color:#6F6354">${B.tagline}</div>
    </td>
  </tr>
</table>`
mkdirSync(resolve(OUT, 'email'), { recursive: true })
writeFileSync(resolve(OUT, 'email/email-signature.html'), sig)
console.log('html email/email-signature.html')
