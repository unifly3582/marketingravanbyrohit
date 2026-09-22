import { useLayoutEffect, useState } from 'react'
import { openRavan } from '../lib/ravan.js'
import { EMPLOYEES } from '../data/employees.js'
import EmployeeStage from './EmployeeStage.jsx'
import './whatsapp-api.css'

/*
 * /whatsapp-api — "Turn WhatsApp into multiple AI employees": Marketing Ravan
 * as a WhatsApp BSP whose product is AI agents that each hold one job
 * (salesperson, receptionist, collections...) on the client's number.
 *
 * A light, brand-palette SaaS page in the shape buyers know from the
 * strongest provider pages in India (AiSensy first, then Interakt,
 * DoubleTick and Wati): a centred hero over a product mockup, the "free to
 * start" strip, three feature stories, the rest of the platform as tiles,
 * why WhatsApp, the plan ladder with per-message rates beside it, a cost
 * calculator, a side-by-side compare table, three onboarding steps, the FAQ
 * and one closing call to action. The site's dark chrome flips light while
 * the page is mounted (.theme-wa on <html>).
 *
 * PRICING: the plans, the per-message rates and the add-ons are AiSensy's
 * published India prices as of 2026-09-22, used as a placeholder until we
 * set our own. They live in the PLANS / RATES / ADDONS tables below so the
 * swap is one edit.
 */

/* ---- pricing tables (AiSensy India, 2026-09-22) ---- */

const PLANS = [
  {
    key: 'free',
    name: 'Free Forever',
    tag: 'Try it before you scale',
    monthly: 0,
    yearly: 0,
    cta: 'Start for free',
    features: [
      'Official WhatsApp Business API on your number',
      'Green tick application, free',
      'Click-to-WhatsApp ads manager',
      'Unlimited contacts, unlimited free service replies',
      'Live chat dashboard, 1 user',
      '10 tags, 5 custom attributes',
      { muted: true, text: 'No broadcasting' },
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    tag: 'Launch WhatsApp marketing',
    monthly: 1500,
    yearly: 1350,
    cta: 'Start with Basic',
    features: [
      { head: true, text: 'Everything in Free, plus' },
      'Broadcasts & retargeting, 40 msgs/sec',
      '1 owner + 5 agents in a shared inbox',
      'Smart audience segments (2)',
      'Template message APIs',
      'Shopify & WooCommerce integrations',
      '1 GB media storage',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tag: 'For serious retargeting',
    monthly: 3200,
    yearly: 2880,
    hot: true,
    cta: 'Start with Pro',
    features: [
      { head: true, text: 'Everything in Basic, plus' },
      'Campaign scheduler & click tracking',
      'Smart agent routing & custom rules',
      '100 tags, 20 attributes, 10 segments',
      'Campaign budget & analytics',
      'Project APIs & role-based access',
      'Automatic retry of failed messages',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    tag: 'Automation, reports, privacy',
    monthly: 9100,
    yearly: 8190,
    cta: 'Start with Premium',
    features: [
      { head: true, text: 'Everything in Pro, plus' },
      '250 msgs/sec sending speed',
      '1 owner + 9 agents included',
      'Number masking for agents',
      'Downloadable reports & template TTL',
      '250 tags, 50 attributes, 50 segments',
      'Webhook + priority support',
    ],
  },
]

const BIG_PLANS = [
  {
    name: 'Unlimited',
    price: '₹45,000',
    per: '/ month',
    note: 'Everything in Premium at full scale: up to 200 agents, 1,000 msgs/sec, 500 tags, 3 webhooks and a dedicated account manager.',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    per: 'tailored to your scale',
    note: 'For 5 lakh+ messages a month. Everything in Unlimited plus a dedicated success team, enterprise security and contracts.',
  },
]

/* per template message, India destination numbers, before GST */
const RATES = [
  { kind: 'Marketing', price: 1.09 },
  { kind: 'Utility', price: 0.145 },
  { kind: 'Authentication', price: 0.145 },
  { kind: 'Service', price: 0, label: 'Free' },
]

const ADDONS = [
  { name: 'AI employee', price: '₹1,350 / mo', note: 'One AI agent with one job and 1,000 AI replies a month. Trained on your business, remembers the customer, works your calendar, catalog, payments and CRM.' },
  { name: 'Chatbot flows', price: '₹2,500 / mo', note: 'Keyword and rule-based flows in a drag-and-drop builder, with cart and catalog sharing.' },
  { name: 'Extra agent seat', price: '₹750 / seat / mo', note: 'One more team login for the shared inbox, beyond the seats your plan includes.' },
]

const FREE = [
  'Free green tick application',
  'Free WhatsApp Business API',
  'Zero setup fee',
  'Free onboarding',
  'Free website chat widget',
  'Free QR code & wa.me link',
  'Unlimited free service replies',
]

const TILES = [
  { icon: 'inbox', title: 'Shared team inbox', text: 'Your whole team on one WhatsApp number. Chats routed to the right agent, transfers, manager view.' },
  { icon: 'flow', title: 'No-code chatbot flows', text: 'Drag-and-drop journeys for FAQs, lead capture, catalog browsing and cart. No developer needed.' },
  { icon: 'pay', title: 'Forms & payments in chat', text: 'Collect details with WhatsApp Forms and take payments with WhatsApp Pay, Razorpay or PayU without leaving the chat.' },
  { icon: 'cart', title: 'Catalog & commerce', text: 'Sync Shopify or WooCommerce. Order confirmations, shipping updates and abandoned-cart nudges go out on their own.' },
  { icon: 'api', title: 'APIs & webhooks', text: 'Template send API, contacts and campaign APIs, and real-time webhooks into your CRM, ERP or app.' },
  { icon: 'chart', title: 'Real-time analytics', text: 'Delivered, read, replied and clicked for every campaign, per button. Retarget straight from the report.' },
]

const INTEGRATIONS = ['Shopify', 'WooCommerce', 'Razorpay', 'PayU', 'Google Sheets', 'Zoho CRM', 'HubSpot', 'Zapier', 'IndiaMART', 'Tally', 'LeadSquared', 'WebEngage']

const STEPS = [
  { title: 'Share your number', text: 'A phone number for WhatsApp (new, or your existing one), your business name and a website or GST certificate. No Meta Business Manager yet? We create it.' },
  { title: 'We set up the number in 24 hours', text: 'API connected, display name approved, first templates written and submitted, team inbox and widget live. Green tick applied on your behalf.' },
  { title: 'Pick the jobs, they start', text: 'Tell us which jobs to fill. We train each employee on your catalog, prices, calendar and policies, set the handover rules, and stay on for the tuning.' },
]

const FAQ = [
  ['Is this the official WhatsApp Business API?', 'Yes. Marketing Ravan is an official Meta Business Partner and WhatsApp Business Solution Provider (BSP), so your number runs on the official WhatsApp Business Platform with a verified business account. No unofficial apps or number farms, so nothing gets banned for the wrong reasons.'],
  ['Can I use my existing WhatsApp number?', 'Yes. The number has to leave the WhatsApp or WhatsApp Business app first (Settings → Account → Delete my account), then it is registered on the API. Old chat backups cannot be imported. Many businesses simply take a new number for the API and keep the old one on the phone.'],
  ['Is there a setup or procurement fee?', 'No. The API, onboarding, the green tick application, the website widget and the QR/link are free on every plan, including Free Forever. You pay the plan subscription and the per-message rates.'],
  ['What do messages cost?', 'Replies to a customer within 24 hours of their message are free, unlimited, on every plan. Messages you start with a template are charged per message by category: marketing ₹1.09, utility ₹0.145, authentication ₹0.145 for Indian numbers (other countries have their own rates). GST at 18% applies.'],
  ['How many people can I broadcast to in a day?', 'Meta starts a new number at 1,000 business-initiated conversations per rolling 24 hours and raises it to 10,000, 100,000 and then unlimited as your number keeps a good quality rating. Most accounts reach 10,000 within the first weeks.'],
  ['Will you get my green tick?', 'We apply for the verified badge on your behalf, free. Meta approves it, and they look at business verification, a live website and some press or public presence, so we tell you honestly beforehand how likely an approval is.'],
  ['How many AI employees can work on one number?', 'As many jobs as you have. They share the number and the inbox; the customer sees one business. Each employee has its own instructions, tools and handover rules, and a router sends each chat to the right one (a fee question to collections, a booking to the receptionist).'],
  ['What happens when the AI does not know the answer?', 'It says so and hands the chat to a named person on your team, with a summary of the conversation so far, instead of guessing. You set the rules for when that happens: certain topics, a frustrated customer, an order above a value, or simply on request.'],
  ['I am already on Wati, Interakt or AiSensy. Can I move?', 'Yes, and the migration is free. We move the number, re-create your templates and import your contacts. Your number keeps its quality rating and messaging limit.'],
]

/* the AiSensy tiers, side by side (— means not on the plan) */
const COMPARE = [
  ['group', 'Messaging'],
  ['Broadcasting & retargeting', '—', '✓', '✓', '✓'],
  ['Sending speed', '—', '40 / sec', '40 / sec', '250 / sec'],
  ['Campaign scheduler', '—', '—', '✓', '✓'],
  ['Click tracking', '—', '—', '✓', '✓'],
  ['Automatic retry of failed messages', '—', '—', '✓', '✓'],
  ['Template TTL', '—', '—', '—', '✓'],
  ['group', 'Team inbox'],
  ['Users included', '1', '1 owner + 5', '1 owner + 5', '1 owner + 9'],
  ['Live chat dashboard', '✓', '✓', '✓', '✓'],
  ['Agent transfer & manager view', '—', '✓', '✓', '✓'],
  ['Smart agent routing', '—', '—', '✓', '✓'],
  ['Role-based access', '—', '—', '✓', '✓'],
  ['Number masking', '—', '—', '—', '✓'],
  ['group', 'Audience'],
  ['Tags / custom attributes', '10 / 5', '10 / 5', '100 / 20', '250 / 50'],
  ['Audience segments', '—', '2', '10', '50'],
  ['Unlimited contacts', '✓', '✓', '✓', '✓'],
  ['group', 'Growth & integrations'],
  ['Click-to-WhatsApp ads manager', '✓', '✓', '✓', '✓'],
  ['Shopify & WooCommerce', '—', '✓', '✓', '✓'],
  ['Template message APIs', '—', '✓', '✓', '✓'],
  ['Project APIs', '—', '—', '✓', '✓'],
  ['Webhooks', '—', '—', '—', '1'],
  ['Downloadable reports', '—', '—', '—', '✓'],
  ['group', 'Support'],
  ['Green tick application', '✓', '✓', '✓', '✓'],
  ['Priority support & turbo onboarding', '—', '—', '—', '✓'],
]

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

/* ---- small icons, drawn inline so the page ships no icon font ---- */
const Icon = ({ name, size = 20 }) => {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', width: size, height: size, 'aria-hidden': true }
  switch (name) {
    case 'inbox': return <svg {...p}><path d="M3 13l2.5-8h13L21 13v6H3v-6z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></svg>
    case 'flow': return <svg {...p}><rect x="3" y="3" width="6" height="5" rx="1.5" /><rect x="15" y="9.5" width="6" height="5" rx="1.5" /><rect x="3" y="16" width="6" height="5" rx="1.5" /><path d="M9 5.5h3v13H9M12 12h3" /></svg>
    case 'pay': return <svg {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14h3" /></svg>
    case 'cart': return <svg {...p}><path d="M3 4h2l2.4 11h11L21 7H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>
    case 'api': return <svg {...p}><path d="M8 7l-4 5 4 5M16 7l4 5-4 5M14 4l-4 16" /></svg>
    case 'chart': return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
    case 'wa': return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z" /></svg>
    default: return null
  }
}

const Check = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
)

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

const Cell = ({ v }) => (v === '✓' ? <span className="wa-yes">✓</span> : v === '—' ? <span className="wa-no">—</span> : <span>{v}</span>)

/* ---- the three feature stories' mockups ---- */
function ShotBroadcast() {
  return (
    <div className="wa-shot">
      <div className="wa-panel">
        <div className="wa-panel-title">New broadcast <em>Marketing template</em></div>
        <div className="wa-field">Audience · <b>Bought in the last 90 days</b> · 8,240 contacts</div>
        <div className="wa-field">Template · <b>diwali_offer_v2</b> · approved</div>
        <div className="wa-field">Schedule · <b>Sat 10:00 am</b> · retry failed twice</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[0.7rem] text-[#6F6354]">Est. cost ₹8,982 + GST</span>
          <span className="wa-btn is-sm">Schedule</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {['Read but no click → send reminder', 'Clicked → 10% coupon', 'Replied → assign to sales'].map((t) => (
          <span key={t} className="wa-chip">{t}</span>
        ))}
      </div>
    </div>
  )
}

function ShotAds() {
  return (
    <div className="wa-shot is-grey">
      <div className="mx-auto max-w-[320px]">
        <div className="wa-ad">
          <div className="px-3 py-2 font-semibold">Sona Jewels <span className="ml-1 text-[0.65rem] font-medium text-[#6F6354]">Sponsored</span></div>
          <div className="wa-ad-img">Diwali Collection</div>
          <div className="wa-ad-cta">Chat for today's price <span>Send message</span></div>
        </div>
        <div className="wa-arrow"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></div>
        <div className="wa-panel">
          <div className="wa-panel-title">New lead <em>from ad · Diwali Collection</em></div>
          <div className="wa-think"><b>Source</b> Instagram Reels · ad set “Jaipur 25–45”</div>
          <div className="wa-think mt-1"><b>Sent to Meta</b> Lead → Purchase ₹2,499 (Conversions API)</div>
        </div>
      </div>
    </div>
  )
}

function ShotAgent() {
  return (
    <div className="wa-shot">
      <div className="wa-panel">
        <div className="wa-panel-title">AI Salesperson · Sona Jewels <em>On shift</em></div>
        <div className="wa-agent-chat">
          <div className="wa-bubble is-out">Green wala kundan choker hai kya? Size bhi adjust hoga?</div>
          <div className="wa-think"><b>Intent</b> availability + custom size · Hinglish</div>
          <div className="wa-think"><b>Catalog</b> kundan choker · green · 4 in stock · ₹2,499</div>
          <div className="wa-think"><b>Rule</b> custom size asked → hand to Meera after reply</div>
          <div className="wa-bubble">Haan, green mein available hai, ₹2,499 after the offer. Size ke liye Meera aapse abhi baat karengi 😊 <span className="wa-bubble-meta">2.8 s · AI agent</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Bookings', 'Catalog', 'Payments', 'Orders', 'CRM', 'Handoff', '12 languages'].map((t) => <span key={t} className="wa-chip !py-1 !text-[0.66rem]">{t}</span>)}
        </div>
      </div>
    </div>
  )
}

/* a labelled range input, its filled part painted through --fill */
function Slider({ label, value, set, max, step }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <b className="text-base">{value.toLocaleString('en-IN')}</b>
      </span>
      <input
        type="range"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="wa-range mt-2"
        style={{ '--fill': `${(value / max) * 100}%` }}
      />
    </label>
  )
}

/* ---- the calculator: a plan plus this month's messages ---- */
function Calculator({ yearly }) {
  const [plan, setPlan] = useState('pro')
  const [marketing, setMarketing] = useState(5000)
  const [utility, setUtility] = useState(3000)
  const chosen = PLANS.find((p) => p.key === plan)
  const sub = yearly ? chosen.yearly : chosen.monthly
  const msgs = marketing * RATES[0].price + utility * RATES[1].price
  const total = sub + msgs
  const gst = total * 0.18
  const canBroadcast = plan !== 'free'

  return (
    <div className="wa-box grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
      <div className="grid gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#6F6354]">Plan</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLANS.map((p) => (
              <button key={p.key} type="button" className="wa-calc-plan" aria-pressed={plan === p.key} onClick={() => setPlan(p.key)}>
                {p.name} · {inr(yearly ? p.yearly : p.monthly)}
              </button>
            ))}
          </div>
        </div>
        <Slider label="Marketing messages this month" value={marketing} set={setMarketing} max={100000} step={500} />
        <Slider label="Utility & OTP messages this month" value={utility} set={setUtility} max={100000} step={500} />
        <p className="text-xs leading-relaxed text-[#6F6354]">
          Replies within the 24-hour service window are free and not counted. Rates are for Indian numbers; other countries have their own rates.
        </p>
      </div>
      <div className="flex flex-col justify-between rounded-2xl border border-[#E6DDCF] bg-white p-5">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between"><span className="text-[#6F6354]">{chosen.name} plan</span><span>{inr(sub)}</span></div>
          <div className="flex justify-between"><span className="text-[#6F6354]">{marketing.toLocaleString('en-IN')} marketing × ₹{RATES[0].price}</span><span>{inr(marketing * RATES[0].price)}</span></div>
          <div className="flex justify-between"><span className="text-[#6F6354]">{utility.toLocaleString('en-IN')} utility × ₹{RATES[1].price}</span><span>{inr(utility * RATES[1].price)}</span></div>
          <div className="flex justify-between border-t border-[#E6DDCF] pt-2"><span className="text-[#6F6354]">GST 18%</span><span>{inr(gst)}</span></div>
        </div>
        <div className="mt-5">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#6F6354]">Estimated per month</span>
          <div className="mt-1 text-4xl font-bold tracking-tight text-[#A63A10]">{inr(total + gst)}</div>
          {!canBroadcast && (marketing > 0 || utility > 0) ? (
            <p className="mt-2 text-xs text-[#8E1F1F]">Broadcasting needs Basic or above; the Free plan sends no template messages.</p>
          ) : (
            <p className="mt-2 text-xs text-[#6F6354]">≈ ₹{((total + gst) / Math.max(1, marketing + utility)).toFixed(2)} per message, all in.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const Heading = ({ kicker, title, lead, center }) => (
  <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
    {kicker && <span className="wa-kicker">{kicker}</span>}
    <h2 className="wa-h2 mt-3">{title}</h2>
    {lead && <p className="wa-lead mt-4">{lead}</p>}
  </div>
)

export default function WhatsAppApi() {
  const [yearly, setYearly] = useState(false)

  // the whole chrome goes light for this page: header, footer and body read
  // the same tokens .theme-wa re-points
  useLayoutEffect(() => {
    const prev = document.title
    document.title = 'AI employees on WhatsApp — Marketing Ravan'
    document.documentElement.classList.add('theme-wa')
    window.scrollTo(0, 0)
    return () => {
      document.title = prev
      document.documentElement.classList.remove('theme-wa')
    }
  }, [])

  const price = (p) => (yearly ? p.yearly : p.monthly)

  return (
    <div className="wa-page">
      {/* ---------- hero: the copy beside the flipping agents ---------- */}
      <EmployeeStage>
        <span className="wa-pill"><i><Icon name="wa" size={12} /></i>Official Meta BSP</span>
        <h1 className="wa-h1 mt-5">
          Turn WhatsApp into <span className="wa-hl">multiple AI employees</span>
        </h1>
        <div className="es-ctas mt-7 flex flex-wrap items-center gap-3 max-md:justify-center">
          <button type="button" className="wa-btn" onClick={openRavan}>Hire your first AI employee <Arrow /></button>
          <a href="#pricing" className="wa-btn-ghost">See pricing</a>
        </div>
      </EmployeeStage>

      <section className="container-x pt-8 md:pt-10">
        <div className="wa-free">
          {FREE.map((f) => (
            <span key={f}><Check size={13} />{f}</span>
          ))}
        </div>
      </section>

      {/* ---------- BSP badge ---------- */}
      <section className="container-x pb-4">
        <div className="wa-bsp">
          <span className="wa-bsp-mark"><Icon name="wa" size={22} /></span>
          <div>
            <b>Official Meta Business Partner &amp; WhatsApp Business Solution Provider</b>
            <p>Your AI employees work on the official WhatsApp Business Platform, provisioned through our own BSP account: no middleman, no reseller markup, Meta's own uptime, green tick applied for free.</p>
          </div>
        </div>
      </section>

      {/* ---------- the team ---------- */}
      <section id="team" className="container-x scroll-mt-24 py-16 md:py-24">
        <Heading
          center
          kicker="Meet your new team"
          title="One number. A whole staff that never clocks out."
          lead="Four jobs for a small business, two for a bigger one. Each agent is trained on your business and works your calendar, catalog, payments, ERP and CRM. Hire one, or the whole floor."
        />
        <div className="wa-team">
          {EMPLOYEES.map((e) => (
            <article key={e.role} className="wa-emp">
              <header className="wa-emp-head">
                <span className="wa-emp-avatar" style={{ background: e.color }}>{e.name[0]}</span>
                <div>
                  <h3 className="wa-h3">{e.name} · {e.role}</h3>
                  <span className="wa-emp-who">{e.who}</span>
                </div>
              </header>
              <p className="wa-emp-job">{e.job}</p>
              <div className="wa-shift">
                {e.shift.map(([dir, text], i) => (
                  <div key={i} className={`wa-bubble${dir === 'in' ? ' is-out' : ''}`}>{text}</div>
                ))}
                <div className="wa-done"><Check size={12} />{e.done}</div>
              </div>
              <div className="wa-emp-tools">
                {e.tools.map((t) => <span key={t} className="wa-chip">{t}</span>)}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-[#6F6354]">Don't see the job you need filled? Describe it, we build the employee.</p>
          <button type="button" className="wa-btn-ghost is-sm" onClick={openRavan}>Describe the job</button>
        </div>
      </section>

      {/* ---------- three feature stories ---------- */}
      <section className="container-x py-8 md:py-12">
        <Heading
          center
          kicker="A day on shift"
          title="They bring the customer in, close the sale and report back"
          lead="Every AI employee runs on official BSP-grade infrastructure, set up and looked after by the team that already runs your ads and your website."
        />

        <div className="wa-feature">
          <div>
            <span className="wa-kicker">Your marketer</span>
            <h3 className="wa-h2 mt-3 !text-[1.6rem] md:!text-[2rem]">Sends the offer to everyone. Chases the ones who read.</h3>
            <p className="wa-lead mt-4">Promotions, launches, reminders and carousels to unlimited contacts, scheduled ahead, with buttons that drive 3× the conversions of a plain link, and a follow-up for everyone who read but didn't click.</p>
            <ul>
              {['Marketing, utility and OTP templates, approved for you', 'Retarget by read / clicked / replied, automatically', 'Scheduled up to two months out, failed sends retried', 'Real-time delivered, read and click reports'].map((t) => <li key={t}><Check />{t}</li>)}
            </ul>
          </div>
          <ShotBroadcast />
        </div>

        <div className="wa-feature is-flip">
          <div>
            <span className="wa-kicker">Your lead catcher</span>
            <h3 className="wa-h2 mt-3 !text-[1.6rem] md:!text-[2rem]">Answers every ad click in seconds, not the next morning.</h3>
            <p className="wa-lead mt-4">Facebook and Instagram ads that land in WhatsApp get 5× the leads of a landing page. The lead catcher replies instantly, tags the lead with the ad it came from, qualifies it, and sends the sale back to Meta so the ads get smarter.</p>
            <ul>
              {['Launch ads from the same dashboard', 'Leads tagged by campaign, ad set and creative', 'Conversions API: purchases flow back to Meta', 'Qualified and scored before a salesperson sees it'].map((t) => <li key={t}><Check />{t}</li>)}
            </ul>
          </div>
          <ShotAds />
        </div>

        <div className="wa-feature">
          <div>
            <span className="wa-kicker">Your salesperson</span>
            <h3 className="wa-h2 mt-3 !text-[1.6rem] md:!text-[2rem]">Closes at 2 am, in Hinglish.</h3>
            <p className="wa-lead mt-4">Trained on your catalog, prices and policies. It answers questions, checks stock, holds the item, takes the payment and hands over to a person the moment it should.</p>
            <ul>
              {['Hindi, English, Hinglish and regional languages', 'Reads your catalog, calendar, orders and CRM', 'Hands over to a human on rules you set', 'Remembers the customer next time they write'].map((t) => <li key={t}><Check />{t}</li>)}
            </ul>
          </div>
          <ShotAgent />
        </div>
      </section>

      {/* ---------- the rest of the platform ---------- */}
      <section className="wa-band is-grey">
        <div className="container-x py-16 md:py-20">
          <Heading center kicker="Included with every hire" title="The tools your AI employees work with" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TILES.map((f) => (
              <div key={f.title} className="wa-tile">
                <span className="wa-tile-icon"><Icon name={f.icon} /></span>
                <h3 className="wa-h3">{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-2 text-xs font-bold uppercase tracking-[0.08em] text-[#6F6354]">Plugs into</span>
            {INTEGRATIONS.map((i) => <span key={i} className="wa-chip">{i}</span>)}
          </div>
        </div>
      </section>

      {/* ---------- why whatsapp ---------- */}
      <section className="container-x py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <Heading
            kicker="Why WhatsApp"
            title="Email gets opened by 2 in 10. WhatsApp, by 9 in 10."
            lead="It is where your customers already are, all day. A template message lands like a message from a friend: read within minutes, answered in the same thread, and the sale closes in the chat."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['98%', 'of WhatsApp messages are opened, most within 5 minutes.'],
              ['45–60%', 'click-through on a broadcast with a button. Email manages 2–3%.'],
              ['5×', 'more leads from click-to-WhatsApp ads than from a landing-page form.'],
              ['₹0', 'for every reply you send inside the 24-hour service window.'],
            ].map(([n, t]) => (
              <div key={n} className="wa-stat"><b>{n}</b><span>{t}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="wa-band scroll-mt-24">
        <div className="container-x py-16 md:py-24">
          <Heading
            center
            kicker="Pricing"
            title="Hire on a simple plan. Pay per message."
            lead="One subscription for the platform your employees work on, plus WhatsApp's per-message rate for the templates they send. Add AI employees as you need them."
          />
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="wa-toggle" role="group" aria-label="Billing period">
              <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
              <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
            </div>
            <span className="wa-save">Save 10% yearly</span>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.key} className={`wa-plan${p.hot ? ' is-hot' : ''}`}>
                {p.hot && <span className="wa-plan-badge">Most popular</span>}
                <h3 className="wa-h3">{p.name}</h3>
                <p className="wa-plan-tag">{p.tag}</p>
                <div className="wa-price">
                  <b>{inr(price(p))}</b>
                  <span>{p.monthly === 0 ? 'forever' : '/ month'}</span>
                </div>
                <p className="wa-price-note">
                  {p.monthly > 0 ? `${yearly ? `${inr(p.yearly * 12)} billed yearly` : 'billed monthly'} · + GST` : 'no card required'}
                </p>
                <button type="button" className={`mt-5 is-wide ${p.hot ? 'wa-btn' : 'wa-btn-ghost'}`} onClick={openRavan}>{p.cta}</button>
                <ul>
                  {p.features.map((f) => {
                    const obj = typeof f === 'object'
                    const text = obj ? f.text : f
                    const cls = obj && f.muted ? 'is-muted' : obj && f.head ? 'is-head' : ''
                    return <li key={text} className={cls}><Check size={14} />{text}</li>
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {BIG_PLANS.map((p) => (
              <div key={p.name} className="wa-plan wa-plan-wide">
                <div className="wa-plan-wide-head">
                  <h3 className="wa-h3">{p.name}</h3>
                  <div className="wa-price !mt-2"><b className="!text-[1.6rem]">{p.price}</b></div>
                  <span className="text-xs text-[#6F6354]">{p.per}</span>
                </div>
                <p className="wa-plan-wide-note">{p.note}</p>
                <button type="button" className="wa-btn-ghost is-sm" onClick={openRavan}>Talk to us</button>
              </div>
            ))}
          </div>

          {/* per-message rates and add-ons */}
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E6DDCF] bg-white p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="wa-h3">Per template message</h3>
                <span className="text-xs text-[#6F6354]">Indian numbers · + GST</span>
              </div>
              <div className="wa-rates mt-5">
                {RATES.map((r) => (
                  <div key={r.kind} className="wa-rate">
                    <b>{r.label ?? `₹${r.price}`}</b>
                    <span>{r.kind}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[#6F6354]">
                Meta sets these rates per country and per category; they are the same on every plan. Replies to a customer within 24 hours of their last message are free, without limit.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E6DDCF] bg-white p-6">
              <h3 className="wa-h3">Add AI employees on any plan</h3>
              <ul className="mt-4 grid gap-3">
                {ADDONS.map((a) => (
                  <li key={a.name} className="flex items-start justify-between gap-4 border-t border-[#E6DDCF] pt-3 first:border-0 first:pt-0">
                    <div>
                      <b className="text-sm">{a.name}</b>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6F6354]">{a.note}</p>
                    </div>
                    <span className="flex-none text-sm font-bold text-[#A63A10]">{a.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* calculator */}
          <div className="mt-12">
            <div className="mb-5 max-w-2xl">
              <h3 className="wa-h2 !text-[1.5rem]">What would it cost me?</h3>
              <p className="mt-2 text-sm text-[#6F6354]">Pick a plan, drag the sliders to this month's volume.</p>
            </div>
            <Calculator yearly={yearly} />
          </div>

          {/* compare */}
          <div className="mt-14">
            <h3 className="wa-h2 !text-[1.5rem]">Compare the plans</h3>
            <div className="wa-table-wrap mt-5">
              <table className="wa-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    {PLANS.map((p) => (
                      <th key={p.key} className={p.hot ? 'is-hot' : ''}>
                        {p.name}
                        <small>{inr(price(p))}{p.monthly ? ' / mo' : ''}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) =>
                    row[0] === 'group' ? (
                      <tr key={i} className="is-group"><td colSpan={5}>{row[1]}</td></tr>
                    ) : (
                      <tr key={i}>
                        <td>{row[0]}</td>
                        {row.slice(1).map((v, j) => (
                          <td key={j} className={PLANS[j].hot ? 'is-hot' : ''}><Cell v={v} /></td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="container-x py-16 md:py-24">
        <Heading center kicker="How hiring works" title="On shift in 24 hours. We do the Meta paperwork." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="wa-step">
              <span className="wa-step-n">{i + 1}</span>
              <h3 className="wa-h3 mt-4">{s.title}</h3>
              <p className="mt-2">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#F1DFC0] bg-[#FBF2E3] p-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">
            <b>Already on Wati, Interakt, AiSensy or Gallabox?</b>{' '}
            <span className="text-[#6F6354]">We move your number, templates and contacts across, free, with no downtime.</span>
          </p>
          <button type="button" className="wa-btn-ghost is-sm md:flex-none" onClick={openRavan}>Ask about migration</button>
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section className="wa-band is-grey">
        <div className="container-x py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Heading kicker="FAQ" title="The questions everyone asks first" />
              <p className="mt-4 text-sm leading-relaxed text-[#6F6354]">Something else? Ask Ravan in the corner, or write to info@marketingravan.com.</p>
            </div>
            <div className="grid gap-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="faq-item wa-faq">
                  <summary className="flex items-center justify-between gap-4">
                    {q}
                    <span className="faq-plus grid h-7 w-7 flex-none place-items-center rounded-full border text-lg leading-none">+</span>
                  </summary>
                  <p className="mt-3">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- final cta ---------- */}
      <section className="container-x py-16 md:py-24">
        <div className="wa-cta px-6 py-12 text-center md:px-12 md:py-16">
          <h2 className="wa-h2">Your first AI employee starts tomorrow.</h2>
          <p className="wa-lead mx-auto mt-4 max-w-xl">
            Free API, free green tick application, zero setup fee. Tell Ravan your business and the job you want filled, and we take it from there.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="wa-btn" onClick={openRavan}>Hire your first AI employee <Arrow /></button>
            <a href="/#heads" className="wa-btn-ghost">See all ten heads</a>
          </div>
        </div>
      </section>
    </div>
  )
}
