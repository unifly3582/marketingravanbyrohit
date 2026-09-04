import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import Contact from '../../components/Contact.jsx'
import { HeadIcon, Arrow } from '../../components/icons.jsx'
import { HEADS } from '../../data/heads.js'

/*
 * Shared skeleton for the ten head pages. Every head keeps the same rhythm
 * (hero → live demo → job cards → trust → stack + numbers → process →
 * prev/next → contact) so the site reads as one system; the copy and the
 * demo component are what make each head its own.
 */

const pad = (n) => String(n).padStart(2, '0')

function NeighbourCard({ h, dir }) {
  return (
    <Link
      to={h.href ?? '/#heads'}
      className={`group flex items-center gap-5 rounded-3xl border border-line bg-card p-6 transition-colors hover:border-gold/40 ${
        dir === 'next' ? 'md:flex-row-reverse md:text-right' : ''
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/35 bg-ground text-gold">
        <HeadIcon name={h.icon} className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
          {dir === 'prev' && <Arrow className="h-3 w-3 rotate-180" />}
          {dir === 'prev' ? 'Previous head' : 'Next head'} · {pad(h.n)}
          {dir === 'next' && <Arrow className="h-3 w-3" />}
        </span>
        <span className="mt-1 block truncate font-display text-base font-bold transition-colors group-hover:text-gold">
          {h.title}
        </span>
      </span>
    </Link>
  )
}

export function HeadNext({ n }) {
  const prev = HEADS[(n - 2 + HEADS.length) % HEADS.length]
  const next = HEADS[n % HEADS.length]
  return (
    <section className="container-x pb-24">
      <div className="grid gap-4 md:grid-cols-2">
        <NeighbourCard h={prev} dir="prev" />
        <NeighbourCard h={next} dir="next" />
      </div>
      <div className="mt-6 text-center">
        <Link to="/#heads" className="text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-gold">
          All ten heads
        </Link>
      </div>
    </section>
  )
}

export default function HeadLayout({ n, hero, demo, jobs, trust, stack, numbers, process, cta }) {
  const head = HEADS[n - 1]

  useEffect(() => {
    document.title = `${head.title} — Marketing Ravan`
    return () => {
      document.title = 'Marketing Ravan'
    }
  }, [head.title])

  const ctaLabel = cta?.label ?? 'Book a call'
  const ctaHref = cta?.href ?? '/contact'

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden pt-36 pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[60vh] w-[120vw] -translate-x-1/2"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(226,87,30,0.14), transparent 60%)' }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-2 select-none font-display text-[11rem] font-extrabold leading-none text-cream/[0.035] md:-top-16 md:right-10 md:text-[20rem]"
        >
          {pad(n)}
        </span>
        <div className="container-x relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/35 bg-surface text-gold">
              <HeadIcon name={head.icon} className="h-6 w-6" />
            </span>
            <span className="font-display text-sm font-extrabold tracking-[0.2em] text-gold">
              HEAD {pad(n)} / 10 — {head.short}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-8 max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl"
          >
            {hero.line1}
            <br />
            <span className="text-muted">{hero.line2}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mt-6 max-w-xl text-[1rem] leading-relaxed text-muted"
          >
            {hero.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link to={ctaHref} className="btn-primary">
              {ctaLabel} <Arrow className="h-4 w-4" />
            </Link>
            <a href="#demo" className="btn-ghost">{hero.secondary ?? 'Watch it work'}</a>
            <span className="chip border-gold/40 text-gold">{head.metric}</span>
          </motion.div>
        </div>
      </section>

      {/* live demo */}
      <section id="demo" className="border-y border-line bg-surface">
        <div className="container-x py-24">
          <p className="eyebrow">{demo.eyebrow ?? 'Live walkthrough'}</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">{demo.title}</h2>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">{demo.body}</p>
          <div className="mt-12">{demo.node}</div>
        </div>
      </section>

      {/* jobs this head can own */}
      <section className="container-x py-24">
        <p className="eyebrow">{jobs.eyebrow ?? 'The job description'}</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
          {jobs.title} <span className="text-muted">{jobs.titleMuted}</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.items.map((j, i) => (
            <motion.article
              key={j.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="flex flex-col rounded-3xl border border-line bg-card p-7"
            >
              <span className="font-display text-sm font-extrabold text-gold">{pad(i + 1)}</span>
              <h3 className="mt-3 text-lg font-bold">{j.title}</h3>
              <dl className="mt-4 space-y-3 text-[0.83rem] leading-relaxed">
                <div>
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
                    {jobs.labels?.[0] ?? 'Trigger'}
                  </dt>
                  <dd className="mt-0.5 text-cream/85">{j.trigger}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
                    {jobs.labels?.[1] ?? 'The head'}
                  </dt>
                  <dd className="mt-0.5 text-cream/85">{j.steps}</dd>
                </div>
              </dl>
              <p className="mt-auto pt-5 text-[0.83rem] font-bold text-gold">{j.outcome}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* trust */}
      <section className="border-y border-line bg-surface">
        <div className="container-x grid gap-12 py-24 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">{trust.eyebrow}</p>
            <h2 className="mt-4 text-3xl font-bold md:text-5xl">
              {trust.title} <span className="text-muted">{trust.titleMuted}</span>
            </h2>
            <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted">{trust.body}</p>
          </div>
          <div className="space-y-4">
            {trust.items.map(([title, body], i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-center gap-5 rounded-2xl border border-line bg-card p-6"
              >
                <span className="font-display text-sm font-extrabold text-gold">{pad(i + 1)}</span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* stack + numbers */}
      <section className="container-x py-24">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">{stack.eyebrow ?? 'Plays well with'}</p>
            <h2 className="mt-4 text-2xl font-bold md:text-4xl">{stack.title}</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{stack.body}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {stack.tools.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">{numbers.eyebrow ?? 'What we build for'}</p>
            <div className="mt-6 space-y-5">
              {numbers.items.map(([v, label]) => (
                <div key={label} className="flex items-baseline gap-4 border-b border-line pb-5">
                  <span className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-4xl font-extrabold text-transparent md:text-5xl">
                    {v}
                  </span>
                  <span className="text-sm text-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              {numbers.note ?? 'Typical targets we design each engagement around — set and measured per client.'}
            </p>
          </div>
        </div>
      </section>

      {/* process */}
      <section className="border-y border-line bg-surface">
        <div className="container-x py-24">
          <p className="eyebrow">How an engagement runs</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">{process.title}</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {process.steps.map(([title, body], i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl border border-line bg-card p-7"
              >
                <span className="font-display text-sm font-extrabold text-gold">{pad(i + 1)}</span>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link to={ctaHref} className="btn-primary">
              {ctaLabel} <Arrow className="h-4 w-4" />
            </Link>
            <Link to="/#heads" className="btn-ghost">
              <Arrow className="h-4 w-4 rotate-180" /> All ten heads
            </Link>
          </div>
        </div>
      </section>

      <div className="pt-16">
        <HeadNext n={n} />
      </div>

      <Contact />
    </>
  )
}
