import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, Arrow } from './icons.jsx'

/*
 * PLACEHOLDER PRICING — tier names and structure are final; the amounts are
 * sample numbers for layout. Set real prices before launch.
 */
const BILLING = [
  { key: 'm', label: 'Monthly', mult: 1, note: null },
  { key: 'q', label: 'Quarterly', mult: 0.9, note: '-10%' },
  { key: 'y', label: 'Yearly', mult: 10 / 12, note: '2 months free' },
]

export const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US')

export const TIERS = [
  {
    name: 'Single Head',
    base: 1900,
    unit: '/month',
    desc: 'One capability, fully run — pick the head your growth needs most.',
    features: [
      'One head of your choice',
      'Weekly sprint delivery',
      'Private WhatsApp + Slack channel',
      'Live metrics dashboard',
      'Pause or cancel anytime',
    ],
    cta: 'Start with One',
    featured: false,
  },
  {
    name: 'Half Ravan',
    base: 4500,
    unit: '/month',
    desc: 'Five heads working in concert — the full growth stack for one funnel.',
    features: [
      'Any five heads, orchestrated',
      'Everything in Single Head +',
      'Dedicated strategist',
      'Weekly war-room call',
      'Priority build queue',
    ],
    cta: 'Deploy Five Heads',
    featured: true,
  },
  {
    name: 'Full Ravan',
    base: null,
    unit: '',
    desc: 'All ten heads. Your entire marketing, AI and ERP operation — outsourced.',
    features: [
      'All ten heads, full stack',
      'Everything in Half Ravan +',
      'Custom integrations & SLAs',
      'Quarterly strategy offsites',
      'First priority on new capabilities',
    ],
    cta: 'Talk to Us',
    featured: false,
  },
]

export default function Pricing() {
  const [billing, setBilling] = useState(BILLING[0])
  return (
    <section id="pricing" className="border-y border-line bg-surface/60 py-28">
      <div className="container-x">
        <div className="mb-14 text-center">
          <p className="eyebrow justify-center">Pricing</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            Pay per head. Not per headache.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Subscriptions for ongoing firepower, or scope a custom campaign with us.
          </p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-line bg-card p-1.5">
            {BILLING.map((b) => (
              <button
                key={b.key}
                onClick={() => setBilling(b)}
                aria-pressed={billing.key === b.key}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  billing.key === b.key
                    ? 'bg-gradient-to-r from-gold to-ember text-[#1a0d05]'
                    : 'text-cream/70 hover:text-cream'
                }`}
              >
                {b.label}
                {b.note && (
                  <span className={billing.key === b.key ? 'opacity-70' : 'text-gold'}>
                    {b.note}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                t.featured
                  ? 'border-gold/50 bg-gradient-to-b from-[#2A1609] to-card shadow-[0_20px_60px_rgba(226,87,30,0.15)]'
                  : 'border-line bg-card'
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-8 rounded-full bg-gradient-to-r from-gold to-ember px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-[#1a0d05]">
                  Most summoned
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold">
                  {t.base ? fmt(t.base * billing.mult) : 'Custom'}
                </span>
                <span className="text-sm text-muted">{t.unit}</span>
              </div>
              {t.base && billing.key !== 'm' && (
                <p className="mt-1 text-xs text-muted">
                  <s>{fmt(t.base)}</s> billed {billing.label.toLowerCase()}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-muted">{t.desc}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-cream/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/contact"
                className={`${t.featured ? 'btn-primary' : 'btn-ghost'} mt-8 w-full justify-center`}
              >
                {t.cta} <Arrow className="h-4 w-4" />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
