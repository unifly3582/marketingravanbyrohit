import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import RavanHead from './RavanHead.jsx'

import imgAgents from '../assets/work-agents.jpg'
import imgSdr from '../assets/work-sdr.jpg'
import imgVoice from '../assets/work-voice.jpg'
import imgGeo from '../assets/work-geo.jpg'
import imgErp from '../assets/work-erp.jpg'
import imgAds from '../assets/work-ads.jpg'
import imgBi from '../assets/work-bi.jpg'
import imgUiux from '../assets/work-uiux.jpg'
import imgApi from '../assets/work-api.jpg'
import imgShield from '../assets/work-shield.jpg'

/*
 * "What we do": one 3D Ravan head sits between "Ten heads." and "Ten
 * services." and cycles through the ten. Each time a head appears, the stage
 * beneath shows what that head does. Below, a colour-coded grid lists all
 * ten at a glance. Replaces the ten viewport-sized stacked cards.
 */

const VISUALS = {
  agent: imgAgents, sdr: imgSdr, voice: imgVoice, geo: imgGeo, erp: imgErp,
  ads: imgAds, bi: imgBi, uiux: imgUiux, api: imgApi, shield: imgShield,
}

/* which personality model plays each head (same casting as the hero) */
const MODEL_FOR_ICON = {
  agent: 'head-engineer', sdr: 'head-closer', voice: 'head-orator', geo: 'head-sage',
  erp: 'head-engineer', ads: 'head-showman', bi: 'head-sage', uiux: 'head-showman',
  api: 'head-engineer', shield: 'head-orator',
}
const modelFor = (icon) => `/models/${MODEL_FOR_ICON[icon] ?? 'ravan-head2'}-web.glb`

/* three outcome groups, each with its own gradient */
const GROUPS = [
  { key: 'sell', title: 'Sell more', blurb: 'Fill the funnel and convert it, around the clock.',
    icons: ['ads', 'geo', 'uiux', 'sdr', 'voice'], from: '#F0A32F', to: '#E2571E' },
  { key: 'run', title: 'Run leaner', blurb: 'Take the repetitive work off your team.',
    icons: ['agent', 'erp', 'api'], from: '#5FD3A3', to: '#2E9E6E' },
  { key: 'know', title: 'Know and protect', blurb: 'See what is coming and guard the brand.',
    icons: ['bi', 'shield'], from: '#8B7CFF', to: '#3E8BFF' },
]
const groupOf = (icon) => GROUPS.find((g) => g.icons.includes(icon))

/* stage order: marketing first, then web, sales, ops, intelligence */
const STAGE = GROUPS.flatMap((g) => g.icons).map((icon) => HEADS.find((h) => h.icon === icon))

/* one plain-language line per head */
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

const CYCLE_MS = 4800  // how long each head holds the stage
const SWAP_MS = 380    // fade-out / fade-in of the 3D head
const pad = (n) => String(n).padStart(2, '0')
const grad = (g, dir = '135deg') => `linear-gradient(${dir}, ${g.from}, ${g.to})`

export default function Services() {
  const [idx, setIdx] = useState(0)
  const [hidden, setHidden] = useState(false) // 3D head mid-swap
  const [paused, setPaused] = useState(false)
  const timer = useRef(null)
  const swapping = useRef(false)

  const head = STAGE[idx]
  const group = groupOf(head.icon)

  /* fade the head out, swap, fade back in */
  const goTo = useCallback((next) => {
    if (swapping.current) return
    swapping.current = true
    setHidden(true)
    setTimeout(() => {
      setIdx(next)
      setHidden(false)
      swapping.current = false
    }, SWAP_MS)
  }, [])

  /* auto-advance; restarts whenever the head changes or hover pause lifts */
  useEffect(() => {
    if (paused) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timer.current = setTimeout(() => goTo((idx + 1) % STAGE.length), CYCLE_MS)
    return () => clearTimeout(timer.current)
  }, [idx, paused, goTo])

  return (
    <section id="heads" className="relative overflow-hidden pt-4 pb-24 md:pt-6">
      {/* ambient glow in the current group's colours */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-[60vh] w-[110vw] -translate-x-1/2 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${group.from}22, ${group.to}0d 40%, transparent 70%)` }}
      />

      <div className="container-x relative">
        {/* headline with the 3D head between the two halves */}
        <div id="services" className="text-center">
          <p className="eyebrow justify-center">What we do</p>
          <h2 className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-4xl font-bold md:text-6xl">
            <span>Ten heads.</span>
            <span className="relative h-28 w-28 shrink-0 md:h-40 md:w-40">
              {/* ring + glow behind the head */}
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full opacity-80 blur-xl transition-[background] duration-700"
                style={{ background: `radial-gradient(circle, ${group.from}66, ${group.to}22 60%, transparent 72%)` }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-1 rounded-full border transition-colors duration-700"
                style={{ borderColor: `${group.from}66` }}
              />
              <span
                className={`absolute inset-0 transition-all ease-out ${
                  hidden ? 'scale-50 opacity-0 blur-sm' : 'scale-100 opacity-100'
                }`}
                style={{ transitionDuration: `${SWAP_MS}ms` }}
              >
                <RavanHead src={modelFor(head.icon)} className="h-full w-full" />
              </span>
            </span>
            <span>Ten services.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Each head is one complete capability: strategy, setup, automation and
            reporting for a single discipline. Subscribe to one, five, or all ten.
          </p>
        </div>

        {/* the stage: what the current head does */}
        <div
          className="relative mt-10 overflow-hidden rounded-3xl border border-line"
          style={{ background: `linear-gradient(135deg, ${group.from}1f, transparent 45%), linear-gradient(315deg, ${group.to}14, transparent 50%), var(--color-card)` }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* watermark numeral */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 right-6 select-none font-display text-[10rem] font-extrabold leading-none text-cream/[0.04] md:text-[14rem]"
          >
            {pad(head.n)}
          </span>

          <div className="grid items-center gap-8 p-7 md:p-10 lg:grid-cols-[1fr_0.9fr]">
            {/* same CSS fade as the head: content swaps while faded out */}
            <div
              className={`transition-all ease-out ${hidden ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100'}`}
              style={{ transitionDuration: `${SWAP_MS}ms` }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="rounded-full px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#14100c]"
                    style={{ background: grad(group, '90deg') }}
                  >
                    {group.title}
                  </span>
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
                    Head {pad(head.n)} of 10 · {head.short}
                  </span>
                </div>
                <h3 className="mt-5 text-3xl font-bold leading-[1.08] md:text-5xl">{head.title}</h3>
                <p className="mt-4 max-w-lg text-[1rem] leading-relaxed text-muted">{LINE[head.icon]}</p>

                <p className="mt-6 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">What this head does</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {head.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border px-3 py-1 text-[0.7rem] font-semibold text-cream/90"
                      style={{ borderColor: `${group.from}55`, background: `${group.from}14` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-5">
                  <span
                    className="bg-clip-text font-display text-xl font-extrabold text-transparent md:text-2xl"
                    style={{ backgroundImage: grad(group, '90deg') }}
                  >
                    {head.metric}
                  </span>
                  <Link
                    to={head.href ?? '/contact'}
                    className="inline-flex items-center gap-2 text-sm font-bold text-cream transition-colors hover:text-gold"
                  >
                    Explore this head <Arrow className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* product visual */}
            <div
              className={`relative overflow-hidden rounded-2xl border border-line transition-all ease-out ${
                hidden ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'
              }`}
              style={{ transitionDuration: `${SWAP_MS}ms` }}
            >
                <img
                  src={VISUALS[head.icon]}
                  alt={`${head.title} — interface concept`}
                  loading="lazy"
                  className="block aspect-video w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: `linear-gradient(180deg, transparent 55%, ${group.to}55)` }}
                />
            </div>
          </div>

          {/* head picker with a progress bar under the active one */}
          <div className="border-t border-line px-4 py-3 md:px-6">
            <div className="flex gap-1 overflow-x-auto md:grid md:grid-cols-10 md:gap-2">
              {STAGE.map((h, i) => {
                const g = groupOf(h.icon)
                const active = i === idx
                return (
                  <button
                    key={h.n}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-pressed={active}
                    title={h.title}
                    className={`group relative flex min-w-[64px] flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-[0.58rem] font-bold uppercase tracking-[0.12em] transition-colors ${
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
                    {h.short}
                    <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-cream/10">
                      {active && (
                        <span
                          key={idx}
                          className="block h-full rounded-full"
                          style={{
                            background: grad(g, '90deg'),
                            animation: `grow-x ${CYCLE_MS}ms linear forwards`,
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

        {/* all ten at a glance, colour-coded by group */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: grad(g) }} />
                  <h3 className="font-display text-lg font-bold">{g.title}</h3>
                </div>
                <p className="mt-1 pl-[1.4rem] text-xs text-muted">{g.blurb}</p>
              </div>
              <div className="flex flex-col gap-2">
                {g.icons.map((icon) => {
                  const h = HEADS.find((x) => x.icon === icon)
                  return (
                    <Link
                      key={icon}
                      to={h.href ?? '/contact'}
                      className="group flex items-center gap-3 rounded-xl border border-line bg-card/70 px-3 py-2.5 transition-colors hover:border-cream/25"
                      style={{ borderLeft: `3px solid ${g.from}` }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: g.from, background: `${g.from}1a` }}>
                        <HeadIcon name={icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold transition-colors group-hover:text-gold">{h.title}</span>
                        <span className="block text-[0.65rem] uppercase tracking-wider text-muted">{h.metric}</span>
                      </span>
                      <Arrow className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
