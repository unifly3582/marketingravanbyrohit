import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'motion/react'
import { HEADS, GROUPS } from '../data/heads.js'
import { HeadIcon, Arrow, Check } from './icons.jsx'
import { PERSONA, portraitFor } from '../lib/portraits.js'
import ShaderGrain from './ShaderGrain.jsx'

/*
 * "What we do": the same Ravan who fronts the hero steps onto a second
 * stage, one head at a time. Left, the cut-out portrait stands on the foot
 * of the panel over a pool of the group's colour with the head's number
 * watermarked behind him; right, the service in the client's words — the
 * name, the promise, what you get and the number it is built to hit. A
 * ten-button picker runs along the foot; below, all ten at a glance in the
 * two outcome groups (Grow / Automate).
 */

const STAGE = HEADS
const groupOf = (key) => GROUPS.find((g) => g.key === key)

const CYCLE_MS = 5200 // how long each head holds the stage
const pad = (n) => String(n).padStart(2, '0')
const grad = (g, dir = '135deg') => `linear-gradient(${dir}, ${g.from}, ${g.to})`

/* the swap, same feel as the hero deck: out sinks into the panel foot, in
 * rises through it */
const ENTER = { y: 80, opacity: 0, scale: 0.95 }
const STAND = { y: 0, opacity: 1, scale: 1 }
const EXIT = { y: 60, opacity: 0, scale: 0.97 }
const SPRING = { type: 'spring', stiffness: 150, damping: 20, mass: 0.9 }

/* dark ember grain behind the stage: the hero's silver canvas, in the
 * site's night palette */
const STAGE_GRAIN = ['#0D0907', '#1A120C', '#2A1A0F', '#3A1F10']

export default function Services() {
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [idx, setIdx] = useState(0)
  const [hover, setHover] = useState(false)
  const [hidden, setHidden] = useState(false)
  const stageRef = useRef(null)
  const inView = useInView(stageRef, { margin: '-10% 0px -10% 0px' })

  const head = STAGE[idx]
  const group = groupOf(head.group)
  const paused = hover || hidden || !inView || reduced

  /* auto-advance; a manual pick restarts the clock so the chosen head gets
     its full hold */
  useEffect(() => {
    if (paused) return
    const id = setTimeout(() => setIdx((i) => (i + 1) % STAGE.length), CYCLE_MS)
    return () => clearTimeout(id)
  }, [idx, paused])

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const advance = () => setIdx((i) => (i + 1) % STAGE.length)
  const swap = reduced ? { duration: 0.2 } : SPRING

  return (
    <section id="heads" className="relative overflow-hidden pt-6 pb-24 md:pt-10">
      {/* ambient pool in the current group's colours */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-40 h-[70vh] w-[120vw] -translate-x-1/2 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${group.from}1f, ${group.to}0a 40%, transparent 70%)` }}
      />

      <div className="container-x relative">
        {/* headline */}
        <div id="services" className="text-center">
          <p className="eyebrow justify-center">What we do</p>
          <h2 className="mt-5 text-4xl font-bold leading-[1.05] md:text-6xl">
            Ten heads.{' '}
            <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">One growth team.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Website, ads and social to be seen. WhatsApp, calls, store and books run by AI agents.
            Each head is one service, done completely. Take one, five, or all ten.
          </p>
        </div>

        {/* the stage */}
        <div
          ref={stageRef}
          className="relative mt-10 overflow-hidden rounded-3xl border border-line bg-card max-md:-mx-4 max-md:rounded-2xl md:mt-14"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <ShaderGrain colors={STAGE_GRAIN} className="absolute inset-0 z-0 h-full w-full opacity-90" />

          <div className="relative z-10 grid lg:grid-cols-[0.9fr_1.1fr]">
            {/* the head on stage */}
            <div
              className="relative min-h-[300px] cursor-pointer select-none overflow-hidden sm:min-h-[360px] lg:min-h-[500px]"
              onClick={advance}
              role="button"
              tabIndex={0}
              aria-label={`Head ${head.n}: ${head.title}. Show the next head`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  advance()
                }
              }}
            >
              {/* watermark numeral */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={head.n}
                  aria-hidden="true"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 select-none font-display text-[13rem] font-extrabold leading-none tracking-[-0.06em] text-cream/[0.05] sm:text-[17rem] lg:top-6 lg:text-[21rem]"
                >
                  {pad(head.n)}
                </motion.span>
              </AnimatePresence>

              {/* pool of light at his feet */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[38%] h-[95%] w-[95%] -translate-x-1/2 rounded-full blur-2xl transition-[background] duration-700"
                style={{ background: `radial-gradient(circle at 50% 55%, ${group.from}59 0%, ${group.to}26 40%, transparent 68%)` }}
              />

              <div className="lineup-float absolute inset-x-0 bottom-0 top-4">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={head.n}
                    className="lineup-head"
                    initial={reduced ? { opacity: 0 } : ENTER}
                    animate={STAND}
                    exit={reduced ? { opacity: 0 } : EXIT}
                    transition={swap}
                  >
                    <img src={portraitFor(head.icon)} alt={`${PERSONA[head.icon]} — ${head.title}`} draggable="false" />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* persona tag at his shoulder */}
              <div className="absolute left-4 top-4 z-10 md:left-6 md:top-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={head.n}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-ground/60 py-1.5 pl-1.5 pr-3 backdrop-blur-md"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#14100c]"
                      style={{ background: grad(group) }}
                    >
                      <HeadIcon name={head.icon} className="h-3 w-3" />
                    </span>
                    <span className="font-display text-[0.58rem] font-extrabold uppercase tracking-[0.16em] text-cream/85">
                      Head {pad(head.n)} · {PERSONA[head.icon]}
                    </span>
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* what this head does */}
            <div className="relative flex flex-col justify-center border-t border-line p-6 md:p-10 lg:border-l lg:border-t-0 lg:pl-12">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={head.n}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
                  transition={reduced ? { duration: 0.2 } : { duration: 0.45, ease: 'easeOut' }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#14100c]"
                      style={{ background: grad(group, '90deg') }}
                    >
                      {group.title}
                    </span>
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
                      Head {pad(head.n)} of 10
                    </span>
                  </div>

                  <p
                    className="mt-5 bg-clip-text font-display text-[2.1rem] font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-transparent sm:text-5xl lg:text-[3.6rem]"
                    style={{ backgroundImage: grad(group, '90deg') }}
                  >
                    {head.short}
                  </p>
                  <h3 className="mt-3 text-xl font-bold leading-snug md:text-2xl">{head.title}</h3>
                  <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-muted">{head.desc}</p>

                  <p className="mt-6 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">What you get</p>
                  <ul className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {head.tags.map((t) => (
                      <li key={t} className="flex items-center gap-2.5 text-[0.88rem] font-semibold text-cream/90">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#14100c]"
                          style={{ background: grad(group) }}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <span className="min-w-0">
                      <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-muted">Built to hit</span>
                      <span
                        className="block bg-clip-text font-display text-xl font-extrabold text-transparent md:text-2xl"
                        style={{ backgroundImage: grad(group, '90deg') }}
                      >
                        {head.metric}
                      </span>
                    </span>
                    <Link
                      to={head.href ?? '/contact'}
                      className="btn-ghost !py-2.5 !text-[0.8rem]"
                    >
                      See how it works <Arrow className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* the picker along the foot, progress under the active head */}
          <div className="relative z-10 border-t border-line bg-ground/50 px-3 py-2.5 backdrop-blur-sm md:px-5">
            <div className="flex gap-1 overflow-x-auto md:grid md:grid-cols-10 md:gap-1.5">
              {STAGE.map((h, i) => {
                const g = groupOf(h.group)
                const active = i === idx
                return (
                  <button
                    key={h.n}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-pressed={active}
                    title={h.title}
                    className={`group relative flex min-w-[76px] flex-col items-center gap-1.5 rounded-xl px-1.5 pb-2.5 pt-2 text-center text-[0.52rem] font-bold uppercase leading-tight tracking-[0.1em] transition-colors ${
                      active ? 'text-cream' : 'text-muted hover:text-cream'
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
                      style={
                        active
                          ? { background: grad(g), borderColor: 'transparent', color: '#14100c' }
                          : { borderColor: `${g.from}44`, color: g.from }
                      }
                    >
                      <HeadIcon name={h.icon} className="h-4 w-4" />
                    </span>
                    <span className="line-clamp-2">{h.short}</span>
                    <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-cream/10">
                      {active && (
                        <span
                          key={idx}
                          className="block h-full rounded-full"
                          style={{
                            background: grad(g, '90deg'),
                            animation: reduced ? 'none' : `grow-x ${CYCLE_MS}ms linear forwards`,
                            animationPlayState: paused ? 'paused' : 'running',
                          }}
                        />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* all ten at a glance, in the two outcome groups */}
        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-10">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3
                    className="bg-clip-text font-display text-2xl font-extrabold uppercase tracking-tight text-transparent"
                    style={{ backgroundImage: grad(g, '90deg') }}
                  >
                    {g.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">{g.blurb}</p>
                </div>
                <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
                  {HEADS.filter((h) => h.group === g.key).length} heads
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {HEADS.filter((h) => h.group === g.key).map((h) => (
                  <Link
                    key={h.n}
                    to={h.href ?? '/contact'}
                    onMouseEnter={() => setIdx(h.n - 1)}
                    className="group flex items-center gap-4 rounded-2xl border border-line bg-card/70 px-4 py-3 transition-colors hover:border-cream/25"
                  >
                    <span className="w-6 shrink-0 font-display text-sm font-extrabold" style={{ color: g.from }}>
                      {pad(h.n)}
                    </span>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: g.from, background: `${g.from}1a` }}
                    >
                      <HeadIcon name={h.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[0.8rem] font-extrabold uppercase tracking-[0.08em] transition-colors group-hover:text-gold">
                        {h.short}
                      </span>
                      <span className="block truncate text-[0.8rem] text-muted">{h.title}</span>
                    </span>
                    <span className="hidden shrink-0 text-right text-[0.62rem] font-bold uppercase tracking-wider text-muted sm:block">
                      {h.metric}
                    </span>
                    <Arrow className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
