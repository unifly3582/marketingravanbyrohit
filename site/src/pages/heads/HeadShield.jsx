import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 10 — AI Reputation & Sentiment Monitor.
 * Demo: a live stream of mentions from reviews, social and forums, each
 * scored for sentiment. A one-star review trips the alert; the agent drafts
 * a reply in the brand's voice, gets approval and posts it. The gauge on
 * the right tracks overall sentiment.
 */

const FEED = [
  { src: 'Google Reviews', who: 'Anita R.', text: 'Fast delivery and the caramel flavour is unreal. 5 stars.', s: 0.92 },
  { src: 'Instagram', who: '@fitwithkaran', text: 'Third box this month. NutriBar has ruined other bars for me 😂', s: 0.85 },
  { src: 'Reddit', who: 'u/mumbai_lifter', text: 'Anyone tried NutriBar? Price seems ok but curious about protein per bar.', s: 0.1 },
  { src: 'Google Reviews', who: 'Vikram S.', text: 'Order arrived 4 days late and half the bars were melted. Nobody replies on support. 1 star.', s: -0.88, alert: true },
  { src: 'X', who: '@snehap', text: 'NutriBar customer support actually called me back within the hour. Rare these days.', s: 0.7 },
]

const REPLY =
  'Vikram, that is on us — a melted box after a 4-day delay is not the experience we promise. A fresh box is on its way today with cold packaging, and I have DM\'d you a refund for this order. — Priya, NutriBar'

function Gauge({ value }) {
  // value in [-1, 1] → angle sweep -90..90
  const angle = value * 90
  return (
    <svg viewBox="0 0 200 120" className="h-auto w-full max-w-[16rem]">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#E2571E" />
          <stop offset="0.5" stopColor="#A3937F" />
          <stop offset="1" stopColor="#F0A32F" />
        </linearGradient>
      </defs>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" opacity="0.9" />
      <motion.g animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 60, damping: 14 }} style={{ originX: '100px', originY: '100px' }}>
        <line x1="100" y1="100" x2="100" y2="32" stroke="#F4EADB" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill="#F4EADB" />
      </motion.g>
      <text x="20" y="116" fontSize="9" fill="#A3937F">NEGATIVE</text>
      <text x="180" y="116" fontSize="9" fill="#A3937F" textAnchor="end">POSITIVE</text>
    </svg>
  )
}

function ShieldDemo() {
  // 1..5 feed items, 6 alert, 7 draft, 8 approved+posted
  const { ref, step, done } = usePlayer(8, { stepMs: 1500, pauseMs: 4500 })
  const shown = FEED.slice(0, Math.min(FEED.length, step))
  const alert = step >= 6
  const draft = step >= 7
  const posted = step >= 8
  const avg = shown.length ? shown.reduce((a, m) => a + m.s, 0) / shown.length : 0
  const gauge = posted ? Math.min(1, avg + 0.25) : avg

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* mention feed */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-gold" />
          </span>
          <p className="text-sm font-bold">Live mentions · NutriBar</p>
          <span className="ml-auto text-[0.65rem] text-muted">11 sources · scored on arrival</span>
        </div>
        <div className="flex min-h-[24rem] flex-col justify-end gap-2.5 p-5">
          {shown.map((m, i) => {
            const neg = m.s < -0.3
            const pos = m.s > 0.3
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-3.5 ${
                  m.alert && alert ? 'border-ember/60 bg-ember/10' : 'border-line bg-ground'
                }`}
              >
                <div className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.16em]">
                  <span className="text-muted">{m.src}</span>
                  <span className="text-cream/70">· {m.who}</span>
                  <span
                    className={`ml-auto rounded px-1.5 py-0.5 ${
                      neg ? 'bg-ember/20 text-ember' : pos ? 'bg-gold/15 text-gold' : 'bg-card2 text-muted'
                    }`}
                  >
                    {neg ? 'Negative' : pos ? 'Positive' : 'Neutral'} {m.s > 0 ? '+' : ''}{m.s.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.83rem] leading-relaxed text-cream/85">{m.text}</p>
                {m.alert && alert && (
                  <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-ember">
                    ⚠ Alert · 1-star + "support" · owner pinged on WhatsApp
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* gauge + response */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">BRAND SENTIMENT</p>
            <p className="text-[0.65rem] text-muted">last 24h</p>
          </div>
          <div className="mt-3 flex items-center gap-5">
            <Gauge value={gauge} />
            <div>
              <p className="font-display text-3xl font-extrabold text-gold tabular-nums">{shown.length ? (gauge > 0 ? '+' : '') + gauge.toFixed(2) : '—'}</p>
              <p className="text-[0.65rem] text-muted">{posted ? 'recovered after reply' : alert ? 'dipped · 1 open issue' : 'healthy'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">RESPONSE DESK</p>
            <p className="text-[0.65rem] text-muted">{posted ? 'posted · 11 min' : draft ? 'awaiting approval' : alert ? 'drafting…' : 'idle'}</p>
          </div>
          <div className="flex-1 p-5">
            {draft ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted">Reply to Vikram S. · Google Reviews</p>
                <p className="mt-2 rounded-2xl border border-gold/25 bg-ground p-4 text-[0.83rem] leading-relaxed text-cream/90">{REPLY}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {posted ? (
                    <>
                      <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-bold text-gold">
                        <Check className="h-3 w-3" /> Approved by owner
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-bold text-gold">
                        <Check className="h-3 w-3" /> Posted publicly
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-bold text-gold">
                        <Check className="h-3 w-3" /> Refund + reship ticket raised
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-gold/20 px-3 py-1 text-[0.65rem] font-bold text-gold">Approve</span>
                      <span className="rounded-full border border-line px-3 py-1 text-[0.65rem] font-bold text-muted">Edit</span>
                      <span className="text-[0.65rem] text-muted">sent to owner on WhatsApp</span>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <p className="text-[0.78rem] text-muted">
                {alert ? 'Reading the review, order history and brand voice…' : 'No issues need a reply right now.'}
              </p>
            )}
          </div>
          <div className="border-t border-line px-5 py-3.5">
            <p className="text-[0.72rem] text-muted">
              {done ? <span className="text-gold">Public damage contained in 11 minutes. Vikram updated to 4 stars a week later.</span> : 'Watching 11 sources…'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 10,
  hero: {
    line1: 'Know what the internet says about you,',
    line2: 'before your customers do.',
    body:
      'Round-the-clock sentiment monitoring across social media, reviews and forums — with AI that spots the fire, drafts the reply in your voice and protects your reputation while you sleep.',
    secondary: 'Watch a 1-star get handled',
  },
  cta: { label: 'Get a reputation scan' },
  demo: {
    title: 'A one-star review, handled in eleven minutes.',
    body:
      'Mentions stream in and get scored. When a real complaint lands, the owner is pinged, the reply is drafted from the actual order history, approved with one tap and posted — publicly, warmly, fast.',
    node: <ShieldDemo />,
  },
  jobs: {
    title: 'What the shield head',
    titleMuted: 'watches for you.',
    labels: ['Signal', 'The response'],
    items: [
      {
        title: 'Review monitoring',
        trigger: 'Google, Zomato, Amazon, Justdial, app stores',
        steps: 'Score every review → reply to the good ones fast → route the bad ones with a drafted response',
        outcome: 'Every review answered within the hour',
      },
      {
        title: 'Social listening',
        trigger: 'Your brand, products and founders across social',
        steps: 'Track mentions, tags and comments → sentiment trend → surface what is gaining traction',
        outcome: 'Hear the conversation as it starts',
      },
      {
        title: 'Crisis early warning',
        trigger: 'A spike in negative mentions or a viral complaint',
        steps: 'Detect the pattern in minutes → alert the owner → holding statement drafted and ready',
        outcome: 'Hours of warning instead of a morning surprise',
      },
      {
        title: 'Competitor sentiment',
        trigger: 'What customers say about your rivals',
        steps: 'Track their reviews and mentions → find their weak points → feed to sales and marketing',
        outcome: 'Their complaints, your pitch',
      },
      {
        title: 'UGC & influencer tracking',
        trigger: 'Customers posting your product',
        steps: 'Collect posts → request permission → hand the best to your ads team',
        outcome: 'Free creative, with consent',
      },
      {
        title: 'Reputation reports',
        trigger: 'Every Monday',
        steps: 'Sentiment score, top themes, open issues, competitor comparison — one page',
        outcome: 'The brand\'s health, at a glance',
      },
    ],
  },
  trust: {
    eyebrow: 'Human warmth, machine speed',
    title: 'Never argue',
    titleMuted: 'in public.',
    body:
      'Replying fast is easy; replying well is the job. Every response is tone-matched to your brand, escalated by rules you set and, until you say otherwise, approved by a person.',
    items: [
      ['Tone-matched replies', 'Drafts written from your own best replies and the actual order or ticket history — never a generic "we\'re sorry to hear that".'],
      ['Escalation rules', 'Legal threats, safety issues, press and VIP customers go straight to a human. The agent knows what not to touch.'],
      ['Approve, then autopilot', 'Start by approving every reply on WhatsApp. Graduate positive-review replies to autopilot when you trust the voice.'],
    ],
  },
  stack: {
    title: 'Every place they talk about you.',
    body: 'We listen where your customers actually are — including the Indian platforms global tools ignore.',
    tools: ['Google Business Profile', 'Instagram', 'Facebook', 'X', 'LinkedIn', 'YouTube', 'Reddit', 'Justdial', 'Zomato / Swiggy', 'Amazon reviews', 'Play Store', 'WhatsApp / Slack alerts'],
  },
  numbers: {
    items: [
      ['24/7', 'monitoring, every source, every language'],
      ['<15 min', 'from complaint to drafted reply'],
      ['100%', 'of reviews and mentions answered'],
    ],
  },
  process: {
    title: 'From blind spot to brand shield.',
    steps: [
      ['Reputation scan', 'We pull everything said about you in the last 12 months, score it and show you the themes. Free, and often sobering.'],
      ['Response playbook', 'Your voice, your escalation rules, your policies on refunds and replacements — written down and trained in.'],
      ['Supervised replies', 'Two weeks where you approve every reply on WhatsApp. We tune tone until it sounds exactly like you.'],
      ['Autopilot + weekly report', 'Positive replies go automatic; complaints stay one-tap. Every Monday, one page on the brand\'s health.'],
    ],
  },
}

export default function HeadShield() {
  return <HeadLayout {...CONTENT} />
}
