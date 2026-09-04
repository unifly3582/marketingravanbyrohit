import { Link } from 'react-router-dom'
import { TIERS, fmt } from './Pricing.jsx'
import { Arrow } from './icons.jsx'

/* Three tiers, one line each. The full table with billing toggle and the
 * comparison grid lives on /pricing. */
export default function PricingTeaser() {
  return (
    <section id="pricing-teaser" className="container-x py-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            Pay per head. Pause anytime.
          </h2>
        </div>
        <Link to="/pricing" className="btn-ghost">
          Full pricing <Arrow className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <Link
            key={t.name}
            to="/pricing"
            className={`group flex flex-col rounded-2xl border p-6 transition-colors hover:border-gold/40 ${
              t.featured ? 'border-gold/50 bg-gradient-to-b from-[#2A1609] to-card' : 'border-line bg-card'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg font-bold">{t.name}</h3>
              <span className="font-display text-xl font-extrabold">
                {t.base ? fmt(t.base) : 'Custom'}
                {t.base && <span className="ml-1 text-xs font-semibold text-muted">/month</span>}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
