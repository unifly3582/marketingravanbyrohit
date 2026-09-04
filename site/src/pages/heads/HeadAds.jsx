import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Arrow } from '../../components/icons.jsx'

/*
 * Head 06 — Hyper-Personalized Ad Campaigns.
 * Demo: one campaign, four audience segments. The ad and its landing page
 * rewrite themselves per segment (auto-cycling, or click a segment); the
 * variant leaderboard shows budget flowing to the winners.
 */

const SEGMENTS = [
  {
    key: 'cart',
    name: 'Cart abandoners',
    who: 'Left a ₹2k+ cart in the last 48h',
    hook: 'Your cart is still waiting.',
    sub: 'Finish checkout today and shipping is on us.',
    cta: 'Complete my order',
    offer: 'FREE SHIPPING · 24H',
    grad: 'from-[#E2571E] to-[#8E1F1F]',
    roas: 6.8,
    spend: 34,
  },
  {
    key: 'new',
    name: 'First-timers · Mumbai',
    who: 'New visitors, Mumbai, mobile',
    hook: 'Mumbai\'s favourite protein bar, ₹99 to try.',
    sub: 'Same-day delivery across the city. No sign-up drama.',
    cta: 'Try the ₹99 box',
    offer: 'SAME-DAY · MUMBAI',
    grad: 'from-[#F0A32F] to-[#E2571E]',
    roas: 3.4,
    spend: 28,
  },
  {
    key: 'gym',
    name: 'Gym owners',
    who: 'B2B · fitness studio operators',
    hook: 'Stock the bar your members already ask for.',
    sub: 'Wholesale pricing, free display stand, 30-day terms.',
    cta: 'Get wholesale rates',
    offer: 'B2B · NET-30',
    grad: 'from-[#2c2c34] to-[#0D0907]',
    roas: 4.9,
    spend: 22,
  },
  {
    key: 'loyal',
    name: 'Returning buyers',
    who: '3+ orders, no purchase in 30 days',
    hook: 'We made a new flavour. You get it first.',
    sub: 'Salted caramel drops Friday — early access for regulars.',
    cta: 'Reserve mine',
    offer: 'EARLY ACCESS',
    grad: 'from-[#6b3fa0] to-[#2a1550]',
    roas: 8.1,
    spend: 16,
  },
]

function AdsDemo() {
  const { ref, step } = usePlayer(SEGMENTS.length, { stepMs: 2600, pauseMs: 1 })
  const [pinned, setPinned] = useState(null)
  const idx = pinned ?? Math.min(SEGMENTS.length - 1, Math.max(0, step - 1))
  const seg = SEGMENTS[idx]

  // unpin after a while so the loop resumes
  useEffect(() => {
    if (pinned === null) return
    const id = setTimeout(() => setPinned(null), 7000)
    return () => clearTimeout(id)
  }, [pinned])

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      {/* segment picker + leaderboard */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">AUDIENCE SEGMENT</p>
          <p className="mt-1 text-[0.65rem] text-muted">Auto-cycling · click to pin</p>
          <div className="mt-4 grid gap-2">
            {SEGMENTS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setPinned(i)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                  i === idx ? 'border-gold/40 bg-card' : 'border-line bg-card/40 hover:border-gold/25'
                }`}
              >
                <span>
                  <span className={`block text-sm font-bold ${i === idx ? 'text-cream' : 'text-muted'}`}>{s.name}</span>
                  <span className="block text-[0.65rem] text-muted">{s.who}</span>
                </span>
                <span className={`font-display text-sm font-extrabold ${i === idx ? 'text-gold' : 'text-muted'}`}>
                  {s.roas.toFixed(1)}x
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">BUDGET ALLOCATION</p>
            <p className="text-[0.65rem] text-muted">rebalanced every 6h by ROAS</p>
          </div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-card2">
            {SEGMENTS.map((s, i) => (
              <motion.div
                key={s.key}
                className={`h-full bg-gradient-to-r ${s.grad} ${i === idx ? '' : 'opacity-50'}`}
                animate={{ width: `${s.spend}%` }}
                transition={{ duration: 0.8 }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[0.65rem] text-muted">
            <span>Blended ROAS</span>
            <span className="font-bold text-gold">5.6x · +250% vs. one-size-fits-all</span>
          </div>
        </div>
      </div>

      {/* creative + landing page */}
      <div className="grid gap-6 sm:grid-cols-[1fr_1fr]">
        {/* ad card */}
        <div className="overflow-hidden rounded-3xl border border-line bg-card">
          <div className="flex items-center gap-2 border-b border-line bg-card2 px-4 py-3">
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-gold to-ember" />
            <span className="text-[0.7rem] font-bold">NutriBar</span>
            <span className="ml-auto text-[0.6rem] text-muted">Sponsored</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={seg.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <div className={`relative flex aspect-square items-end bg-gradient-to-br p-5 ${seg.grad}`}>
                <span className="absolute left-4 top-4 rounded-full bg-black/35 px-2.5 py-1 text-[0.55rem] font-bold tracking-[0.18em] text-white">
                  {seg.offer}
                </span>
                <p className="font-display text-xl font-extrabold leading-tight text-white drop-shadow">{seg.hook}</p>
              </div>
              <div className="p-4">
                <p className="text-[0.78rem] leading-relaxed text-cream/85">{seg.sub}</p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-cream px-3.5 py-1.5 text-[0.7rem] font-bold text-ground">
                  {seg.cta} <Arrow className="h-3 w-3" />
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* landing page variant */}
        <div className="overflow-hidden rounded-3xl border border-line bg-card">
          <div className="flex items-center gap-2 border-b border-line bg-card2 px-4 py-3">
            <span className="flex gap-1">
              <i className="h-2 w-2 rounded-full bg-muted/40" />
              <i className="h-2 w-2 rounded-full bg-muted/40" />
              <i className="h-2 w-2 rounded-full bg-muted/40" />
            </span>
            <span className="ml-2 truncate text-[0.6rem] text-muted">nutribar.in/?v={seg.key}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={seg.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4"
            >
              <div className={`h-20 rounded-xl bg-gradient-to-br ${seg.grad}`} />
              <p className="mt-3 font-display text-sm font-extrabold leading-snug">{seg.hook}</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">{seg.sub}</p>
              <div className="mt-3 h-7 rounded-full bg-gradient-to-r from-gold to-ember" />
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 w-full rounded bg-card2" />
                <div className="h-1.5 w-4/5 rounded bg-card2" />
                <div className="h-1.5 w-3/5 rounded bg-card2" />
              </div>
              <p className="mt-3 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-gold">
                Landing variant · {seg.name}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 6,
  hero: {
    line1: 'One campaign,',
    line2: 'a thousand ads — each one personal.',
    body:
      'Dynamic creative optimisation that writes the copy, picks the visual and builds the landing-page variant for every audience segment — in real time, judged by return on ad spend, not by opinion.',
    secondary: 'See the ad change per person',
  },
  cta: { label: 'Get an ads audit' },
  demo: {
    eyebrow: 'Interactive',
    title: 'Same product. Four people. Four different ads.',
    body:
      'Pick a segment and watch the creative, the offer and the landing page rewrite themselves. Budget then flows to whichever variant is actually converting.',
    node: <AdsDemo />,
  },
  jobs: {
    title: 'What the ads head runs',
    titleMuted: 'every day.',
    labels: ['Signal', 'The system'],
    items: [
      {
        title: 'Dynamic creative',
        trigger: 'A new segment or a fatigued ad',
        steps: 'Generate copy + visuals on-brand → launch as variants → keep the winners, kill the rest',
        outcome: 'Fresh creative every week, no design queue',
      },
      {
        title: 'Segment landing pages',
        trigger: 'A click from a specific audience',
        steps: 'Match headline, offer and proof to the ad they saw → tracked per variant',
        outcome: 'Message match, end to end',
      },
      {
        title: 'Budget reallocation',
        trigger: 'Every six hours',
        steps: 'Read ROAS per variant → shift spend to winners → hold reserves for tests',
        outcome: 'Money follows results automatically',
      },
      {
        title: 'Fatigue detection',
        trigger: 'Frequency climbs, CTR drops',
        steps: 'Flag early → rotate a new angle before performance falls off a cliff',
        outcome: 'No dead ads burning budget',
      },
      {
        title: 'Catalogue & feed ads',
        trigger: 'Your product catalogue',
        steps: 'Clean the feed → dynamic product ads → retarget by product viewed',
        outcome: 'Every SKU sells itself',
      },
      {
        title: 'Retargeting sequences',
        trigger: 'A visitor who did not convert',
        steps: 'Day 1 reminder → day 3 proof → day 7 offer, each with its own creative',
        outcome: 'Second and third chances that convert',
      },
    ],
  },
  trust: {
    eyebrow: 'Performance, not vibes',
    title: 'Every rupee',
    titleMuted: 'accounted for.',
    body:
      'Personalisation at this scale only works with discipline: real measurement, brand rules the machine cannot break, and spend controls you set.',
    items: [
      ['Measured to the variant', 'Pixel plus server-side tracking, so every headline and every landing page carries its own ROAS — not a campaign average.'],
      ['Brand guardrails', 'Tone, claims, colours and words the generator may never use. Every variant passes the rules before it spends.'],
      ['Spend controls', 'Daily caps, minimum ROAS floors and a kill switch. The system moves money fast, but only inside your limits.'],
    ],
  },
  stack: {
    title: 'Wherever your buyers scroll.',
    body: 'We run the platforms you already advertise on and connect the tracking so the numbers are real.',
    tools: ['Meta Ads', 'Google Ads', 'YouTube', 'LinkedIn Ads', 'Meta Pixel + CAPI', 'GA4', 'Shopify', 'WooCommerce', 'Webflow', 'Figma', 'Canva', 'Custom landing pages'],
  },
  numbers: {
    items: [
      ['+250%', 'return on ad spend versus one-size-fits-all'],
      ['100s', 'of creative variants tested a week'],
      ['6 hrs', 'between budget rebalances'],
    ],
  },
  process: {
    title: 'From one ad to one per person.',
    steps: [
      ['Account + creative audit', 'What is working, what is fatigued, and which segments you are treating the same that behave differently.'],
      ['Segment map + setup', 'Define the audiences, the offers each deserves, and the brand rules. Wire the tracking properly.'],
      ['Launch + learn', 'Two weeks of structured testing across segments. We keep what wins and write down why.'],
      ['Scale + refresh', 'Budget follows ROAS automatically; creative refreshes weekly; you get one clear report a month.'],
    ],
  },
}

export default function HeadAds() {
  return <HeadLayout {...CONTENT} />
}
