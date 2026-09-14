import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './poster.css'

/*
 * Small animated illustrations for the cards that have no story of their
 * own (social, campaigns, ecommerce, ERP, automation, search), plus the
 * Lighthouse score ring on the website card. Each is drawn on a 320 x 242
 * stage and scaled to the card with `--s`, so it is crisp at any width.
 * Every animation is CSS or SMIL; the card only plays while it is at the
 * front of the pile (`active`), other cards hold their first frame.
 */
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function useStageScale(ref) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => el.style.setProperty('--s', (el.clientWidth / 320).toFixed(4))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

/* ---- social: a grid of posts, each taking its turn to go live ---- */
const POSTS = ['a', 'b', 'c', 'd', 'e', 'f']
function Social() {
  return (
    <>
      <div className="hs-soc-grid">
        {POSTS.map((k, i) => (
          <div key={k} className={`hs-soc-tile is-${k}`} style={{ '--i': i }}>
            <i />
          </div>
        ))}
      </div>
      <div className="hs-soc-chip is-heart">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.5-9.3C1 7.7 3.6 4 7.3 4c2 0 3.5 1.1 4.7 2.7C13.2 5.1 14.7 4 16.7 4 20.4 4 23 7.7 21.5 11.7 19.5 16.4 12 21 12 21z" />
        </svg>
        <b>1.2k</b>
      </div>
      <div className="hs-soc-chip is-sched">
        <i />
        <span>Reel · scheduled 9:00</span>
      </div>
    </>
  )
}

/* ---- campaigns: channels light up, the pipeline line draws itself ---- */
const CHANNELS = ['Google', 'YouTube', 'LinkedIn', 'Email']
function Campaign() {
  return (
    <>
      <ul className="hs-cmp-channels">
        {CHANNELS.map((c, i) => (
          <li key={c} style={{ '--i': i }}>
            <i />
            {c}
          </li>
        ))}
      </ul>
      <svg className="hs-cmp-chart" viewBox="0 0 320 242" aria-hidden="true">
        <defs>
          <linearGradient id="hs-cmp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--hs-accent)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--hs-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="hs-cmp-grid">
          <line x1="128" y1="60" x2="304" y2="60" />
          <line x1="128" y1="90" x2="304" y2="90" />
          <line x1="128" y1="120" x2="304" y2="120" />
        </g>
        <path className="hs-cmp-area" d="M130 134 C160 132 176 118 200 108 S246 72 300 48 L300 140 L130 140 Z" fill="url(#hs-cmp-fill)" />
        <path className="hs-cmp-line" d="M130 134 C160 132 176 118 200 108 S246 72 300 48" />
        <g className="hs-cmp-dots">
          <circle cx="130" cy="134" r="3.5" style={{ '--i': 0 }} />
          <circle cx="200" cy="108" r="3.5" style={{ '--i': 1 }} />
          <circle cx="250" cy="82" r="3.5" style={{ '--i': 2 }} />
          <circle cx="300" cy="48" r="4.5" style={{ '--i': 3 }} />
        </g>
        <g className="hs-cmp-tag">
          <rect x="192" y="44" width="52" height="18" rx="9" />
          <text x="218" y="56.5" textAnchor="middle">3x pipeline</text>
        </g>
      </svg>
    </>
  )
}

/* ---- ecommerce: products roll past, carts come back, orders count up ---- */
const PRODUCTS = [
  { k: 'shoe', name: 'Runner', price: '₹2,499' },
  { k: 'bag', name: 'Tote', price: '₹1,899' },
  { k: 'watch', name: 'Chrono', price: '₹5,200' },
  { k: 'lamp', name: 'Lamp', price: '₹1,250' },
  { k: 'tee', name: 'Tee', price: '₹799' },
]
function Ecom({ live }) {
  const [orders, setOrders] = useState(1042)
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setOrders((n) => n + 1), 1400)
    return () => clearInterval(id)
  }, [live])
  return (
    <>
      <div className="hs-eco-belt">
        <div className="hs-eco-row">
          {[...PRODUCTS, ...PRODUCTS].map((p, i) => (
            <div key={i} className={`hs-eco-item is-${p.k}`}>
              <i />
              <b>{p.name}</b>
              <span>{p.price}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hs-eco-orders">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="20" r="1.6" />
          <circle cx="17" cy="20" r="1.6" />
        </svg>
        <span>orders</span>
        <b>#{orders}</b>
      </div>
      <div className="hs-eco-toast">
        <i />
        <span>Cart recovered · ₹2,499</span>
      </div>
    </>
  )
}

/* ---- ERP: an invoice is scanned and the fields land in the books ---- */
const FIELDS = [
  ['Vendor', 'Sharma Traders'],
  ['GST 18%', '₹7,352'],
  ['Total', '₹48,200'],
  ['Tally', 'posted ✓'],
]
function Erp() {
  return (
    <>
      <div className="hs-erp-sheet">
        <div className="hs-erp-head">
          <b>INVOICE</b>
          <span>#INV-2291</span>
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className="hs-erp-line" style={{ '--i': i }} />
        ))}
        <div className="hs-erp-total" />
        <div className="hs-erp-scan" />
      </div>
      <ul className="hs-erp-fields">
        {FIELDS.map(([k, v], i) => (
          <li key={k} style={{ '--i': i }}>
            <span>{k}</span>
            <b>{v}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---- automation: one agent wired to the business apps, work flowing out ---- */
const CX = 214
const CY = 92
const APPS = [
  { k: 'CRM', x: 150, y: 52 },
  { k: 'Email', x: 272, y: 46 },
  { k: 'Sheets', x: 296, y: 108 },
  { k: 'Calendar', x: 250, y: 146 },
  { k: 'Slack', x: 146, y: 122 },
]
function Agent({ live }) {
  return (
    <svg className="hs-agt" viewBox="0 0 320 242" aria-hidden="true">
      <g className="hs-agt-wires">
        {APPS.map((a) => (
          <line key={a.k} x1={CX} y1={CY} x2={a.x} y2={a.y} />
        ))}
      </g>
      {live &&
        !reduced &&
        APPS.map((a, i) => (
          <circle key={a.k} className="hs-agt-pulse" r="2.6">
            <animateMotion dur="1.9s" begin={`${i * 0.37}s`} repeatCount="indefinite" path={`M${CX} ${CY} L${a.x} ${a.y}`} />
          </circle>
        ))}
      <g className="hs-agt-core">
        <circle className="hs-agt-ring" cx={CX} cy={CY} r="22" />
        <circle cx={CX} cy={CY} r="16" />
        <text x={CX} y={CY + 4.5} textAnchor="middle">
          R
        </text>
      </g>
      {APPS.map((a, i) => (
        <g key={a.k} className="hs-agt-app" style={{ '--i': i }}>
          <rect x={a.x - 24} y={a.y - 10} width="48" height="20" rx="10" />
          <text x={a.x} y={a.y + 3.5} textAnchor="middle">
            {a.k}
          </text>
        </g>
      ))}
      <text className="hs-agt-label" x={CX} y={CY + 34} textAnchor="middle">
        Ravan agent
      </text>
    </svg>
  )
}

/* ---- search: the query is typed, one result wins, the AI engines cite it ---- */
const ENGINES = ['Google', 'ChatGPT', 'Perplexity', 'Gemini']
function Geo() {
  return (
    <>
      <div className="hs-geo-bar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span className="hs-geo-q">best dentist in pune</span>
      </div>
      <div className="hs-geo-results">
        <div className="hs-geo-hit">
          <em>#1</em>
          <div>
            <b>Smile Dental · Pune</b>
            <span>smiledental.in</span>
          </div>
        </div>
        <i className="hs-geo-row" />
        <i className="hs-geo-row is-short" />
      </div>
      <ul className="hs-geo-engines">
        {ENGINES.map((e, i) => (
          <li key={e} style={{ '--i': i }}>
            {e}
          </li>
        ))}
      </ul>
    </>
  )
}

const ART = { social: Social, campaign: Campaign, ecom: Ecom, erp: Erp, agent: Agent, geo: Geo }

export default function PosterArt({ kind, active }) {
  const ref = useRef(null)
  useStageScale(ref)
  const Art = ART[kind]
  const live = !!active && !reduced
  return (
    <div ref={ref} className={`hs-art is-${kind}${live ? ' is-live' : ''}`} aria-hidden="true">
      <div className="hs-art-stage">{Art ? <Art live={live} /> : null}</div>
    </div>
  )
}

/* ---- the website card's Lighthouse ring: fills and counts to 100 ---- */
const R = 21
const CIRC = 2 * Math.PI * R
export function ScoreRing({ active }) {
  const [n, setN] = useState(reduced ? 100 : 0)
  useEffect(() => {
    if (!active || reduced) return
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / 1500)
      setN(Math.round(100 * (1 - (1 - u) ** 3)))
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return (
    <div className={`hs-score${active ? ' is-live' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <circle className="hs-score-track" cx="26" cy="26" r={R} />
        <circle className="hs-score-arc" cx="26" cy="26" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - n / 100)} />
      </svg>
      <b>{n}</b>
      <span>Lighthouse</span>
    </div>
  )
}
