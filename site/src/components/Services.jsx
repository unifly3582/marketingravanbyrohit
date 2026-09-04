import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'

/*
 * "What we do": the ten heads as a compact grid, grouped by the outcome a
 * buyer is shopping for. One line per head; the full story lives on each
 * head's own page. Replaces the ten viewport-sized stacked cards on Home.
 */

const GROUPS = [
  {
    title: 'Sell more',
    blurb: 'Fill the funnel and convert it, around the clock.',
    icons: ['sdr', 'voice', 'ads', 'geo', 'uiux'],
  },
  {
    title: 'Run leaner',
    blurb: 'Take the repetitive work off your team.',
    icons: ['agent', 'erp', 'api'],
  },
  {
    title: 'Know and protect',
    blurb: 'See what is coming and guard the brand.',
    icons: ['bi', 'shield'],
  },
]

/* one plain-language line per head, keyed by heads.js icon */
const LINE = {
  agent: 'AI agents that process invoices, update your CRM and book meetings on their own.',
  sdr: '24/7 bots on WhatsApp, email and LinkedIn that qualify leads and book calls.',
  voice: 'Natural-sounding voice agents for inbound support, telesales and follow-ups.',
  geo: 'Get your brand cited by ChatGPT, Perplexity and Gemini, plus programmatic pages.',
  erp: 'Receipts, PDFs and invoices read by AI straight into your books and stock.',
  ads: 'Ad copy, visuals and landing pages generated per customer segment, in real time.',
  bi: 'Forecast revenue, flag churn before it happens and price dynamically.',
  uiux: 'Fast, interactive websites in the Linear, Apple and Stripe school.',
  api: 'Connect legacy ERPs and modern SaaS with APIs, webhooks and low-code.',
  shield: 'Monitor reviews, social and forums, and respond to feedback automatically.',
}

const byIcon = Object.fromEntries(HEADS.map((h) => [h.icon, h]))
const pad = (n) => String(n).padStart(2, '0')

function HeadTile({ h, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: i * 0.05 }}
      className="h-full"
    >
      <Link
        to={h.href ?? '/contact'}
        className="group flex h-full flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-gold/40"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/35 bg-ground text-gold">
            <HeadIcon name={h.icon} className="h-5 w-5" />
          </span>
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
            Head {pad(h.n)}
          </span>
        </div>
        <h4 className="mt-4 font-display text-[1.05rem] font-bold leading-snug transition-colors group-hover:text-gold">
          {h.title}
        </h4>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{LINE[h.icon]}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="chip border-gold/40 text-gold">{h.metric}</span>
          <span className="flex items-center gap-1 text-xs font-bold text-cream/80">
            Explore <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

export default function Services() {
  return (
    <section id="heads" className="container-x py-28">
      <div id="services" className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">What we do</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            Ten heads. Ten services.
            <br />
            <span className="text-muted">Pick one, five, or all ten.</span>
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          Each head is one complete capability: strategy, setup, automation and
          reporting for a single discipline. Subscribe to the ones your growth
          needs most.
        </p>
      </div>

      <div className="flex flex-col gap-12">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="font-display text-xl font-bold md:text-2xl">{g.title}</h3>
              <p className="text-sm text-muted">{g.blurb}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.icons.map((icon, i) => (
                <HeadTile key={icon} h={byIcon[icon]} i={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
