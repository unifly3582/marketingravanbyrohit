import { useEffect, useRef, useState } from 'react'
import { useInView } from 'motion/react'

/*
 * Count-up scoreboard. These are the target metrics of the ten heads
 * (from the capability list), not client-history claims.
 */
const STATS = [
  { to: 10, prefix: '', suffix: 'x', label: 'Faster execution', sub: 'Agentic workflows' },
  { to: 3, prefix: '', suffix: 'x', label: 'Conversion rate', sub: 'Autonomous SDRs' },
  { to: 250, prefix: '+', suffix: '%', label: 'Ad ROAS', sub: 'Hyper-personalized DCO' },
  { to: 99.9, prefix: '', suffix: '%', label: 'Data accuracy', sub: 'AI-driven ERP', decimals: 1 },
]

function Counter({ to, prefix, suffix, decimals = 0, started }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!started) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return }
    const t0 = performance.now()
    const dur = 1400
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(to * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, to])
  return (
    <span className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-4xl font-extrabold text-transparent md:text-5xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{v.toFixed(decimals)}{suffix}
    </span>
  )
}

/* `note` labels the numbers honestly (they are per-head targets). */
export default function StatsStrip({ note }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="border-y border-line bg-surface/60">
      {note && (
        <p className="container-x pt-10 text-xs font-bold uppercase tracking-[0.2em] text-muted">{note}</p>
      )}
      <div ref={ref} className="container-x grid grid-cols-2 gap-8 py-16 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label}>
            <Counter {...s} started={inView} />
            <p className="mt-2 text-sm font-semibold">{s.label}</p>
            <p className="text-xs uppercase tracking-widest text-muted">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
