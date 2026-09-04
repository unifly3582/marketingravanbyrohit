import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer, useCountUp } from './usePlayer.js'
import { Arrow, Check } from '../../components/icons.jsx'

/*
 * Head 08 — Interactive Web & UI/UX Design.
 * Demo: four Lighthouse rings sweep to 100 on the left; on the right a small
 * playground of the micro-interactions we ship — a tilting glass card, a
 * magnetic button, a spring toggle and a Core Web Vitals readout.
 */

const RINGS = [
  ['Performance', 100],
  ['Accessibility', 100],
  ['Best practices', 100],
  ['SEO', 100],
]

function Ring({ label, target, active, delay }) {
  const v = useCountUp(target, active, 1500 + delay)
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 84 84" className="h-24 w-24">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(244,234,219,0.08)" strokeWidth="6" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill="#F0A32F" fontFamily="Bricolage Grotesque, system-ui">
          {Math.round(v)}
        </text>
        <defs>
          <linearGradient id="ringGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#F0A32F" />
            <stop offset="1" stopColor="#E2571E" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  )
}

function TiltCard() {
  const ref = useRef(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [10, -10]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-12, 12]), { stiffness: 200, damping: 20 })
  const glow = useTransform([mx, my], ([x, y]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(240,163,47,0.35), transparent 55%)`)

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const b = ref.current.getBoundingClientRect()
        mx.set((e.clientX - b.left) / b.width)
        my.set((e.clientY - b.top) / b.height)
      }}
      onPointerLeave={() => {
        mx.set(0.5)
        my.set(0.5)
      }}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', perspective: 800 }}
      className="relative h-full min-h-[9rem] cursor-default overflow-hidden rounded-2xl border border-cream/15 bg-cream/[0.06] p-4 backdrop-blur-md"
    >
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-gold">Glass card · tilt</p>
      <p className="mt-2 font-display text-lg font-extrabold">Move your cursor</p>
      <p className="mt-1 text-[0.7rem] text-muted">3D tilt + light that follows the pointer. 60 fps, GPU only.</p>
    </motion.div>
  )
}

function MagneticButton() {
  const ref = useRef(null)
  const x = useSpring(0, { stiffness: 180, damping: 14 })
  const y = useSpring(0, { stiffness: 180, damping: 14 })
  return (
    <div
      className="flex h-full min-h-[9rem] items-center justify-center rounded-2xl border border-line bg-card"
      onPointerMove={(e) => {
        const b = ref.current.getBoundingClientRect()
        x.set((e.clientX - (b.left + b.width / 2)) * 0.35)
        y.set((e.clientY - (b.top + b.height / 2)) * 0.35)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      <motion.span ref={ref} style={{ x, y }} className="btn-primary !py-3 !px-6 text-xs">
        Magnetic <Arrow className="h-3.5 w-3.5" />
      </motion.span>
    </div>
  )
}

function SpringToggle() {
  const [on, setOn] = useState(true)
  return (
    <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-card">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative h-9 w-16 rounded-full p-1 transition-colors ${on ? 'bg-gradient-to-r from-gold to-ember' : 'bg-card2'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className={`block h-7 w-7 rounded-full bg-cream shadow ${on ? 'ml-auto' : ''}`}
        />
      </button>
      <p className="text-[0.65rem] text-muted">Spring toggle · {on ? 'on' : 'off'}</p>
    </div>
  )
}

function UiuxDemo() {
  const { ref, step } = usePlayer(3, { stepMs: 2200, pauseMs: 6000 })
  const active = step >= 1
  const vitals = [
    ['LCP', '0.8s', 'good'],
    ['INP', '48ms', 'good'],
    ['CLS', '0.00', 'good'],
  ]

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* lighthouse */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line bg-card2 px-5 py-3.5">
          <p className="text-sm font-bold">Lighthouse · mobile</p>
          <span className="text-[0.65rem] text-muted">marketingravan.com</span>
        </div>
        <div className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-4 lg:grid-cols-2">
          {RINGS.map(([l, t], i) => (
            <Ring key={l} label={l} target={t} active={active} delay={i * 150} />
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {vitals.map(([k, v]) => (
            <div key={k} className="px-3 py-3.5 text-center">
              <p className="font-display text-base font-extrabold text-gold">{active ? v : '—'}</p>
              <p className="flex items-center justify-center gap-1 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                {k} {active && <Check className="h-3 w-3 text-gold" />}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* playground */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">MICRO-INTERACTIONS</p>
          <p className="text-[0.65rem] text-muted">try them — hover, drag, click</p>
        </div>
        <div className="grid flex-1 gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TiltCard />
          </div>
          <MagneticButton />
          <SpringToggle />
        </div>
        <div className="border-t border-line px-5 py-3.5">
          <p className="text-[0.72rem] text-muted">
            Every one of these ships at <span className="text-gold">0 kB of layout shift</span> and under a frame of input delay.
          </p>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 8,
  hero: {
    line1: 'Websites that feel like products,',
    line2: 'and load like lightning.',
    body:
      'The Linear, Apple and Stripe school of web design: glassmorphism, 3D and SVG micro-animations, every interaction considered — shipped at a perfect Lighthouse score, because beautiful and fast are the same thing.',
    secondary: 'Play with the details',
  },
  cta: { label: 'Start a website project' },
  demo: {
    eyebrow: 'Interactive',
    title: 'Perfect scores, and the details that earn them.',
    body:
      'The rings are this site\'s own Lighthouse audit. The playground is a sample of the micro-interactions we ship — go ahead and touch them.',
    node: <UiuxDemo />,
  },
  jobs: {
    title: 'What the design head',
    titleMuted: 'builds.',
    labels: ['You need', 'We deliver'],
    items: [
      {
        title: 'Marketing websites',
        trigger: 'A brand site that has to convert, not just exist',
        steps: 'Story-first structure → motion that guides the eye → CMS your team can run',
        outcome: 'A site people remember',
      },
      {
        title: 'Product landing pages',
        trigger: 'A launch, a campaign, a single offer',
        steps: 'One message, one action → 3D or video hero → A/B-ready sections',
        outcome: 'Built to test and to win',
      },
      {
        title: 'Web apps & dashboards',
        trigger: 'Software your customers or team log into',
        steps: 'Interaction design → component system → React build with real data',
        outcome: 'Software that feels expensive',
      },
      {
        title: 'Design systems',
        trigger: 'Five people shipping UI that looks like five brands',
        steps: 'Tokens, components, motion rules → documented in Figma and code',
        outcome: 'Consistency that scales',
      },
      {
        title: '3D & motion',
        trigger: 'A product worth showing off',
        steps: 'Optimised 3D models → scroll-driven scenes → shader effects that still hit 60 fps',
        outcome: 'The "how did they do that" moment',
      },
      {
        title: 'Conversion optimisation',
        trigger: 'Traffic that isn\'t turning into leads',
        steps: 'Heatmaps + session replays → hypotheses → redesign and test the pages that matter',
        outcome: 'More from the visitors you already have',
      },
    ],
  },
  trust: {
    eyebrow: 'Craft, with a budget',
    title: 'Beautiful and fast',
    titleMuted: 'are the same thing.',
    body:
      'Most agencies make you choose between an impressive site and a fast one. We treat performance and accessibility as design constraints from the first sketch — and it shows in the score.',
    items: [
      ['Performance budget', 'Every page has a byte and frame budget before design starts. 3D, video and motion have to earn their weight.'],
      ['Accessible by default', 'Keyboard, screen reader, contrast, reduced motion — built in from the first component, not patched at the end.'],
      ['Modern stack, no lock-in', 'React, Vite or Next.js, Tailwind, GSAP and Three.js. You own the code and the repo from day one.'],
    ],
  },
  stack: {
    title: 'The tools behind the polish.',
    body: 'Designed in Figma, built in code, deployed on infrastructure that keeps it fast everywhere in India.',
    tools: ['Figma', 'React', 'Next.js', 'Vite', 'Tailwind', 'GSAP', 'Motion', 'Three.js', 'Webflow', 'Sanity', 'Vercel', 'Cloudflare'],
  },
  numbers: {
    items: [
      ['100', 'Lighthouse performance on mobile'],
      ['<1 sec', 'largest contentful paint'],
      ['2x', 'conversion lift on redesigned pages'],
    ],
  },
  process: {
    title: 'From brief to a site that flies.',
    steps: [
      ['Discovery + wireframes', 'Goals, audience, competitors and the one action each page exists for. Low-fi wireframes you can react to fast.'],
      ['Design in Figma', 'Full visual design with motion prototypes, so you feel the interactions before we build them.'],
      ['Build + motion', 'Component-driven code, performance budget enforced on every commit, real content from your CMS.'],
      ['Launch + optimise', 'Analytics, heatmaps and a monthly improvement cycle on the pages that drive revenue.'],
    ],
  },
}

export default function HeadUiux() {
  return <HeadLayout {...CONTENT} />
}
