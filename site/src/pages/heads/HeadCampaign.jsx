import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer, useCountUp } from './usePlayer.js'

/*
 * Head 04 — Digital Campaigns, full-funnel.
 * Demo: one offer runs across four channels and the funnel fills top to
 * bottom — search click, YouTube view, email open, booked call — with the
 * stage counts ticking up as the campaign runs.
 */

const STAGES = [
  { key: 'reach', label: 'Reached', chan: 'Google Search · YouTube', target: 48200, w: 100 },
  { key: 'visit', label: 'Visited landing page', chan: 'Search ads · retargeting', target: 6140, w: 78 },
  { key: 'lead', label: 'Left details', chan: 'Form · WhatsApp', target: 812, w: 54 },
  { key: 'nurture', label: 'Nurtured', chan: 'Email · WhatsApp sequence', target: 640, w: 38 },
  { key: 'booked', label: 'Booked a call', chan: 'Calendar', target: 131, w: 24 },
]

const EVENTS = [
  ['11:02', 'Google Search', '"CA firm for startup registration" → ad → landing page'],
  ['11:04', 'YouTube', '15s pre-roll seen by the same visitor on a startup channel'],
  ['11:20', 'Retargeting', 'Display + Instagram reminder with the free-consult offer'],
  ['11:31', 'Email', '"Your registration checklist" opened, link clicked'],
  ['11:38', 'WhatsApp', 'Reply to the follow-up: "yes, Thursday works"'],
  ['11:39', 'Booked', 'Thursday 4pm on the founder\'s calendar'],
]

function Stage({ s, active, done }) {
  const v = useCountUp(s.target, active, 1600)
  return (
    <motion.div animate={{ opacity: active ? 1 : 0.3 }} className="flex items-center gap-4">
      <div className="w-36 shrink-0">
        <p className="text-sm font-bold">{s.label}</p>
        <p className="text-[0.62rem] text-muted">{s.chan}</p>
      </div>
      <div className="flex-1">
        <div className="h-8 overflow-hidden rounded-lg bg-cream/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: active ? `${s.w}%` : 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-gold to-ember pr-3 text-xs font-bold text-[#14100c]"
          >
            {active && v.toLocaleString('en-IN')}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function CampaignDemo() {
  // 1..5 funnel stages fill, 6..8 event log completes
  const { ref, step } = usePlayer(8, { stepMs: 1300, pauseMs: 4500 })
  const events = step >= 6 ? EVENTS.slice(0, Math.min(EVENTS.length, (step - 5) * 2)) : []

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-gold" />
          </span>
          <p className="text-sm font-bold">Campaign · "Startup registration in 7 days"</p>
          <span className="ml-auto text-[0.65rem] text-muted">Day 14 of 30</span>
        </div>
        <div className="space-y-4 p-5">
          {STAGES.map((s, i) => (
            <Stage key={s.key} s={s} active={step >= i + 1} />
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {[
            ['₹1,140', 'cost per booked call'],
            ['3.2x', 'pipeline vs last quarter'],
            ['4', 'channels, one funnel'],
          ].map(([v, l]) => (
            <div key={l} className="px-5 py-4">
              <p className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-xl font-extrabold text-transparent">
                {step >= 5 ? v : '—'}
              </p>
              <p className="text-[0.62rem] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-card p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">One visitor's journey</p>
        <div className="mt-4 space-y-2.5">
          {events.length === 0 && <p className="text-sm text-muted">Waiting for the funnel to fill…</p>}
          {events.map(([t, chan, text], i) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-2xl border p-3.5 ${
                i === EVENTS.length - 1 ? 'border-gold/50 bg-gold/10' : 'border-line bg-ground'
              }`}
            >
              <p className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-muted">
                <span>{t}</span>
                <span className="text-gold">{chan}</span>
              </p>
              <p className="mt-1 text-sm">{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 4,
  hero: {
    line1: 'One offer. Every channel.',
    line2: 'One funnel that closes.',
    body:
      'Google Search, YouTube, LinkedIn, email and retargeting run as one campaign around a single offer — with a landing page built to convert and a follow-up sequence that turns clicks into booked calls.',
    secondary: 'Watch a funnel fill',
  },
  cta: { label: 'Plan a campaign' },
  demo: {
    title: 'From a search at 11:02 to a call booked by 11:39.',
    body:
      'Every channel hands off to the next. The same person sees the ad, the video, the reminder and the email — and the funnel shows exactly where each rupee went.',
    node: <CampaignDemo />,
  },
  jobs: {
    title: 'Campaigns this head runs',
    titleMuted: 'end to end.',
    labels: ['The goal', 'The head'],
    items: [
      { title: 'Lead generation', trigger: 'You need booked calls or form fills every week', steps: 'Search + YouTube ads → landing page → WhatsApp and email follow-ups → calendar', outcome: 'A predictable weekly pipeline' },
      { title: 'Product or service launch', trigger: 'Something new goes live in 30 days', steps: 'Teaser → launch burst across channels → retargeting → offer close', outcome: 'A launch people notice' },
      { title: 'Google Search ads', trigger: 'Buyers are already searching for what you sell', steps: 'Keyword research → ad groups → negative keywords → bid and copy tests weekly', outcome: 'Show up when it matters' },
      { title: 'YouTube & video', trigger: 'A story worth 15 seconds', steps: 'Script → edit → pre-roll and Shorts placements → view-based retargeting', outcome: 'Reach at a fraction of TV cost' },
      { title: 'Email & WhatsApp nurture', trigger: 'Leads who are not ready yet', steps: '5-touch sequence → useful content → offer → re-engage the silent ones', outcome: 'Leads that warm up on their own' },
      { title: 'Seasonal pushes', trigger: 'Diwali, year-end, admissions season', steps: 'Offer design → creative set → phased spend → daily optimisation', outcome: 'Peak season, fully used' },
    ],
  },
  trust: {
    eyebrow: 'Measured, not guessed',
    title: 'You see every rupee',
    titleMuted: 'and what it brought back.',
    body:
      'One dashboard for the whole funnel: spend, clicks, leads, calls and revenue by channel. We optimise weekly and tell you what we changed and why.',
    items: [
      ['Tracking set up first', 'Google Tag Manager, conversion events, call tracking and CRM sync before the first rupee is spent.'],
      ['Weekly optimisation', 'Pause what does not work, scale what does. A short note every Monday on what changed.'],
      ['Your accounts, your data', 'Campaigns run in ad accounts you own. Leave any time and keep everything.'],
    ],
  },
  stack: {
    title: 'Every channel, one plan.',
    body: 'We run the platforms you already know, wired together so a click on one becomes a follow-up on the next.',
    tools: ['Google Ads', 'YouTube', 'LinkedIn Ads', 'Meta Ads', 'Google Analytics 4', 'Tag Manager', 'Mailchimp', 'Brevo', 'WhatsApp Business API', 'HubSpot', 'Zoho CRM', 'Calendly'],
  },
  numbers: {
    items: [
      ['3x', 'pipeline against the same spend, within a quarter'],
      ['-40%', 'cost per lead after the first month of optimisation'],
      ['4+', 'channels working as one funnel'],
    ],
  },
  process: {
    title: 'From offer to a funnel that runs weekly.',
    steps: [
      ['Offer + audience', 'What you sell, to whom, and the one promise the whole campaign makes. We audit your current spend.'],
      ['Build', 'Landing page, creatives, tracking and follow-up sequence, ready in two weeks.'],
      ['Launch + tune', 'Live across channels with a testing budget. Daily checks, weekly changes.'],
      ['Scale', 'Move spend to what converts, add channels, report monthly on pipeline and revenue.'],
    ],
  },
}

export default function HeadCampaign() {
  return <HeadLayout {...CONTENT} />
}
