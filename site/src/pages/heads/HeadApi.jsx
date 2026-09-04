import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'

/*
 * Head 09 — Universal API & Legacy System Integration.
 * Demo: an integration map with the legacy ERP at the centre and the modern
 * tools in orbit. Data packets travel the edges in both directions; the
 * webhook log on the right shows each event landing.
 */

const W = 520
const H = 360
const CX = W / 2
const CY = H / 2
const R = 132

const NODES = [
  { id: 'shopify', label: 'Shopify' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'razorpay', label: 'Razorpay' },
  { id: 'hubspot', label: 'HubSpot' },
  { id: 'sheets', label: 'Sheets' },
  { id: 'courier', label: 'Delhivery' },
].map((n, i, arr) => {
  const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2
  return { ...n, x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R }
})

const EVENTS = [
  { from: 'shopify', to: 'erp', label: 'order.created', detail: '#S-88213 · ₹4,320 · 3 items', ms: 212 },
  { from: 'erp', to: 'sheets', label: 'stock.updated', detail: 'SKU PB-12 · 340 → 337', ms: 96 },
  { from: 'erp', to: 'whatsapp', label: 'order.confirmed', detail: 'sent to +91 98xxx · template approved', ms: 340 },
  { from: 'razorpay', to: 'erp', label: 'payment.captured', detail: '₹4,320 · UPI · reconciled to #S-88213', ms: 188 },
  { from: 'erp', to: 'hubspot', label: 'contact.upsert', detail: 'lifetime value ₹19,840 · segment: loyal', ms: 254 },
  { from: 'erp', to: 'courier', label: 'shipment.create', detail: 'AWB 1493 8821 · pickup 4 PM', ms: 410 },
  { from: 'courier', to: 'whatsapp', label: 'shipment.out_for_delivery', detail: 'live tracking link sent', ms: 128 },
]

const pos = (id) => (id === 'erp' ? { x: CX, y: CY } : NODES.find((n) => n.id === id))

function ApiDemo() {
  const { ref, step, done } = usePlayer(EVENTS.length, { stepMs: 1500, pauseMs: 4000 })
  const logs = EVENTS.slice(0, step)
  const cur = step > 0 && !done ? EVENTS[step - 1] : null
  const activeIds = new Set(logs.flatMap((e) => [e.from, e.to]))

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* integration map */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line bg-card2 px-5 py-3.5">
          <p className="text-sm font-bold">Integration map</p>
          <span className="text-[0.65rem] text-muted">legacy ERP ↔ modern stack</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Legacy ERP connected to modern SaaS tools">
          <defs>
            <radialGradient id="erpGlow">
              <stop offset="0" stopColor="#F0A32F" stopOpacity="0.35" />
              <stop offset="1" stopColor="#F0A32F" stopOpacity="0" />
            </radialGradient>
          </defs>
          {NODES.map((n) => (
            <line
              key={n.id}
              x1={CX}
              y1={CY}
              x2={n.x}
              y2={n.y}
              stroke={activeIds.has(n.id) ? 'rgba(240,163,47,0.45)' : 'rgba(244,234,219,0.12)'}
              strokeWidth="1.5"
              strokeDasharray={activeIds.has(n.id) ? '0' : '3 5'}
            />
          ))}
          {/* travelling packet */}
          {cur && (
            <motion.circle
              key={step}
              r="5"
              fill="#F0A32F"
              initial={{ cx: pos(cur.from).x, cy: pos(cur.from).y, opacity: 0 }}
              animate={{ cx: pos(cur.to).x, cy: pos(cur.to).y, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
              style={{ filter: 'drop-shadow(0 0 6px #F0A32F)' }}
            />
          )}
          {/* centre: legacy ERP */}
          <circle cx={CX} cy={CY} r="60" fill="url(#erpGlow)" />
          <rect x={CX - 46} y={CY - 26} width="92" height="52" rx="14" fill="#16100C" stroke="#F0A32F" strokeOpacity="0.6" strokeWidth="1.5" />
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#F4EADB" fontFamily="Bricolage Grotesque, system-ui">LEGACY ERP</text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize="8" fill="#A3937F" letterSpacing="1.2">SQL · 2014 · ON-PREM</text>
          {/* orbit nodes */}
          {NODES.map((n) => {
            const on = activeIds.has(n.id)
            const hot = cur && (cur.from === n.id || cur.to === n.id)
            return (
              <g key={n.id}>
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r="26"
                  fill="#1D1510"
                  stroke={on ? '#F0A32F' : 'rgba(244,234,219,0.18)'}
                  strokeWidth="1.5"
                  animate={{ scale: hot ? 1.12 : 1 }}
                  style={{ originX: `${n.x}px`, originY: `${n.y}px` }}
                />
                <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={on ? '#F4EADB' : '#A3937F'} fontFamily="Instrument Sans, system-ui">
                  {n.label}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="flex items-center justify-between border-t border-line px-5 py-3.5 text-[0.72rem] text-muted">
          <span>{done ? <span className="text-gold">7 events · 0 failures · every system in sync</span> : cur ? `${cur.from} → ${cur.to}` : 'Listening for events…'}</span>
          <span>retries + dead-letter queue on</span>
        </div>
      </div>

      {/* webhook log */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">EVENT LOG</p>
          <p className="text-[0.65rem] text-muted">one order, end to end</p>
        </div>
        <div className="flex-1 space-y-2 p-4 font-mono text-[0.7rem]">
          {logs.map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-line bg-card px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                <span className="font-bold text-cream">{e.label}</span>
                <span className="ml-auto text-muted">{e.ms}ms</span>
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[0.55rem] font-bold text-gold">200</span>
              </div>
              <p className="mt-1 pl-3.5 text-muted">{e.from} → {e.to} · {e.detail}</p>
            </motion.div>
          ))}
          {logs.length === 0 && <p className="p-1 text-muted">—</p>}
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 9,
  hero: {
    line1: 'Your legacy ERP and your new SaaS,',
    line2: 'finally on speaking terms.',
    body:
      'Custom webhooks, APIs and low-code integrations that connect the software you have run for ten years to the tools you signed up for last month — no rip-and-replace, no retyping, no code friction.',
    secondary: 'Watch one order flow',
  },
  cta: { label: 'Map my systems' },
  demo: {
    title: 'One order. Seven systems. Zero humans.',
    body:
      'A Shopify order lands in a 2014 on-prem ERP, updates stock, confirms on WhatsApp, reconciles the payment, enriches the CRM and books the courier — in under two seconds, with a log for every hop.',
    node: <ApiDemo />,
  },
  jobs: {
    title: 'Integrations the API head',
    titleMuted: 'builds and owns.',
    labels: ['The gap', 'The bridge'],
    items: [
      {
        title: 'Orders → ERP',
        trigger: 'Website, marketplace and WhatsApp orders typed into the ERP by hand',
        steps: 'Webhooks from every channel → validated → posted to the ERP with stock and invoice',
        outcome: 'No order ever retyped',
      },
      {
        title: 'Payment reconciliation',
        trigger: 'Razorpay, bank and marketplace settlements matched in Excel',
        steps: 'Pull settlements → match to invoices → post to books → flag the leftovers',
        outcome: 'Reconciled daily, not monthly',
      },
      {
        title: 'CRM ↔ ERP sync',
        trigger: 'Sales sees one customer, finance sees another',
        steps: 'Two-way sync of contacts, orders and dues → conflict rules you set',
        outcome: 'One customer record, everywhere',
      },
      {
        title: 'Legacy API layer',
        trigger: 'Old software with no API, only a database',
        steps: 'A secure REST or GraphQL layer on top of the database → documented → rate-limited',
        outcome: 'Modern tools can finally talk to it',
      },
      {
        title: 'Marketplace connectors',
        trigger: 'Amazon, Flipkart, Zomato, IndiaMART — each its own login',
        steps: 'Orders, inventory and returns synced to one system → price and stock pushed back',
        outcome: 'Run every channel from one screen',
      },
      {
        title: 'Notification hub',
        trigger: 'Events nobody hears about until it\'s late',
        steps: 'Route every important event to WhatsApp, Slack or email with the right context',
        outcome: 'The right person knows, instantly',
      },
    ],
  },
  trust: {
    eyebrow: 'Built to not break at 2 AM',
    title: 'Plumbing,',
    titleMuted: 'engineered.',
    body:
      'An integration is only as good as its worst night. Ours retry, queue, alert and document themselves — and you own every line of it.',
    items: [
      ['Retries + dead-letter queues', 'When a system is down, events wait and retry with backoff. Nothing is lost, nothing is duplicated.'],
      ['Monitoring + alerts', 'Every hop is logged with latency and status. Failures page us — and you — before anyone notices a missing order.'],
      ['Documented + owned by you', 'OpenAPI specs, runbooks and a repo in your name. No vendor lock-in, no mystery middleware.'],
    ],
  },
  stack: {
    title: 'Speaks every dialect.',
    body: 'REST, SOAP, flat files over FTP, direct database access — whatever your old system offers, we can bridge it.',
    tools: ['REST', 'GraphQL', 'Webhooks', 'SOAP', 'n8n', 'Make', 'Zapier', 'Node.js', 'Python', 'PostgreSQL', 'SAP', 'Tally', 'Salesforce', 'Custom ERPs'],
  },
  numbers: {
    items: [
      ['0', 'manual re-entry between systems'],
      ['99.9%', 'delivery with retries and queues'],
      ['<300 ms', 'typical hop between systems'],
    ],
  },
  process: {
    title: 'From spaghetti to a spine.',
    steps: [
      ['Systems map', 'Every tool, every manual handoff, every spreadsheet bridge — drawn on one page. This alone changes how you see your ops.'],
      ['Integration design', 'Which events flow where, who wins conflicts, what happens on failure. Agreed before code.'],
      ['Build + test', 'Built with replayable test events and a staging run against real data before anything goes live.'],
      ['Monitor + maintain', 'Dashboards, alerts and a monthly review. APIs change; we keep the bridges standing.'],
    ],
  },
}

export default function HeadApi() {
  return <HeadLayout {...CONTENT} />
}
