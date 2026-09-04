import { motion, AnimatePresence } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 02 — Autonomous AI Sales Engine.
 * Demo: one lead, three channels. The left panel is the conversation as it
 * hops WhatsApp → email → LinkedIn; the right panel is the pipeline board
 * where the lead card moves from New to Meeting booked.
 */

const STAGES = ['New', 'Engaged', 'Qualified', 'Booked']

const SCRIPT = [
  { ch: 'WhatsApp', who: 'lead', text: 'Hi, saw your ad. Do you do bulk packaging for food brands?', stage: 0, t: '11:02' },
  { ch: 'WhatsApp', who: 'sdr', text: 'Hi Priya! Yes — we run 5k to 500k units for D2C food brands. Which product is this for?', stage: 1, t: '11:02', lat: '23s' },
  { ch: 'WhatsApp', who: 'lead', text: 'Protein bars. Around 40k units a month to start.', stage: 1, t: '11:09' },
  { ch: 'WhatsApp', who: 'sdr', text: 'Perfect fit. Are you deciding this month, and is there a budget range you\'re working within?', stage: 1, t: '11:09', lat: '18s' },
  { ch: 'WhatsApp', who: 'lead', text: 'Yes, launching in Oct. Budget is roughly ₹6–8 per unit.', stage: 2, t: '11:14' },
  { ch: 'Email', who: 'sdr', text: 'Sent: spec sheet + 3 case studies from food brands at your volume. Subject: "40k bars a month — how we\'d do it".', stage: 2, t: '11:15', lat: '41s' },
  { ch: 'LinkedIn', who: 'sdr', text: 'Connected with Priya (Head of Ops, NutriBar). Note: "Loved the launch plan — sent the packaging deck on email."', stage: 2, t: '11:16' },
  { ch: 'WhatsApp', who: 'sdr', text: 'Rohan from our team can walk you through samples. Thursday 4 PM or Friday 11 AM?', stage: 2, t: '11:16', lat: '9s' },
  { ch: 'WhatsApp', who: 'lead', text: 'Thursday 4 works.', stage: 3, t: '11:31' },
  { ch: 'WhatsApp', who: 'sdr', text: 'Booked ✅ Invite sent, samples courier dispatched. Rohan has the full brief.', stage: 3, t: '11:31', lat: '6s' },
]

const CH_STYLE = {
  WhatsApp: 'bg-[#25D366]/15 text-[#5ee39a]',
  Email: 'bg-gold/15 text-gold',
  LinkedIn: 'bg-[#0A66C2]/20 text-[#6fb3ff]',
}

function SdrDemo() {
  const { ref, step, done } = usePlayer(SCRIPT.length, { stepMs: 1500, pauseMs: 4500 })
  const visible = SCRIPT.slice(0, step)
  const stage = visible.length ? visible[visible.length - 1].stage : 0
  const lastCh = visible.length ? visible[visible.length - 1].ch : 'WhatsApp'

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* omni-channel thread */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <div className="flex gap-1.5">
            {['WhatsApp', 'Email', 'LinkedIn'].map((c) => (
              <span
                key={c}
                className={`rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] transition-all ${
                  c === lastCh ? CH_STYLE[c] : 'text-muted/60'
                }`}
              >
                {c}
              </span>
            ))}
          </div>
          <span className="ml-auto text-[0.65rem] text-muted">Priya · NutriBar · inbound from Meta ad</span>
        </div>
        <div className="flex min-h-[24rem] flex-col justify-end gap-2.5 p-5">
          <AnimatePresence initial={false}>
            {visible.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35 }}
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[0.83rem] leading-relaxed ${
                  m.who === 'sdr'
                    ? 'self-start rounded-bl-md border border-gold/25 bg-ground text-cream'
                    : 'self-end rounded-br-md bg-card2 text-cream/90'
                }`}
              >
                <p className="mb-1 flex items-center gap-2 text-[0.55rem] font-bold uppercase tracking-[0.18em] opacity-70">
                  <span className={`rounded px-1.5 py-0.5 ${CH_STYLE[m.ch]}`}>{m.ch}</span>
                  {m.who === 'sdr' ? 'AI SDR' : 'Priya'} · {m.t}
                  {m.lat && <span className="text-gold">· replied in {m.lat}</span>}
                </p>
                {m.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* pipeline board */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">PIPELINE</p>
          <p className="text-[0.65rem] text-muted">CRM · synced live</p>
        </div>
        <div className="flex-1 space-y-2.5 p-5">
          {STAGES.map((s, i) => {
            const here = i === stage
            const past = i < stage
            return (
              <div
                key={s}
                className={`relative rounded-2xl border p-4 transition-colors duration-500 ${
                  here ? 'border-gold/40 bg-card' : 'border-line bg-card/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${
                      past || (here && done) ? 'bg-gold/20 text-gold' : here ? 'bg-gold text-[#1a0d05]' : 'bg-card2 text-muted'
                    }`}
                  >
                    {past || (here && done) ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={`text-sm font-bold ${here || past ? 'text-cream' : 'text-muted'}`}>{s}</span>
                  {here && (
                    <motion.span
                      layoutId="lead-card"
                      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                      className="ml-auto flex items-center gap-2 rounded-xl border border-gold/30 bg-ground px-3 py-1.5 text-[0.7rem]"
                    >
                      <span className="h-5 w-5 rounded-full bg-gradient-to-br from-gold to-ember" />
                      <span className="font-bold">Priya · NutriBar</span>
                      <span className="text-muted">₹3.2L/mo</span>
                    </motion.span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-line px-5 py-3.5">
          <p className="text-[0.72rem] text-muted">
            {done ? (
              <span className="text-gold">Lead to booked meeting in 29 minutes. Human time: zero — until the meeting.</span>
            ) : (
              'Working the lead…'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 2,
  hero: {
    line1: 'A sales team that never sleeps,',
    line2: 'and never forgets a lead.',
    body:
      'AI SDRs that work WhatsApp, email and LinkedIn around the clock — replying in seconds, qualifying with real questions and booking meetings straight onto your closer\'s calendar.',
    secondary: 'Watch a lead get booked',
  },
  cta: { label: 'Book a pipeline audit' },
  demo: {
    title: 'One lead. Three channels. One meeting.',
    body:
      'A lead taps your Meta ad at 11:02. By 11:31 she has a spec sheet, a LinkedIn connection and a Thursday meeting — and your team has only just noticed.',
    node: <SdrDemo />,
  },
  jobs: {
    title: 'Work an AI SDR can own',
    titleMuted: 'outright.',
    labels: ['Trigger', 'The SDR'],
    items: [
      {
        title: 'Speed-to-lead',
        trigger: 'A new lead from your form, IndiaMART, Justdial or Meta ads',
        steps: 'Enrich → first reply on WhatsApp inside 30 seconds → keep the thread alive until they answer',
        outcome: 'Nobody waits, nobody goes cold',
      },
      {
        title: 'Qualification',
        trigger: 'Lead replies',
        steps: 'Ask budget, timeline, use-case in plain language → score → route hot leads, nurture the rest',
        outcome: 'Closers only talk to buyers',
      },
      {
        title: 'Dead-lead revival',
        trigger: 'Leads untouched for 30+ days in your CRM',
        steps: 'Personalised re-open message → new offer or content → re-qualify',
        outcome: 'Revenue from leads you already paid for',
      },
      {
        title: 'LinkedIn outbound',
        trigger: 'Your ideal-customer list',
        steps: 'Connect → contextual note → 4-touch sequence across LinkedIn + email',
        outcome: 'A warm outbound pipe, every week',
      },
      {
        title: 'Meeting booking',
        trigger: 'Lead says yes',
        steps: 'Offer two slots → book on the closer\'s calendar → reminders on WhatsApp → reschedule if needed',
        outcome: 'No-shows cut in half',
      },
      {
        title: 'Handoff brief',
        trigger: 'Meeting confirmed',
        steps: 'Summarise the whole conversation → push to CRM → brief the closer 30 minutes before',
        outcome: 'Every meeting starts warm',
      },
    ],
  },
  trust: {
    eyebrow: 'Sounds like you, not a bot',
    title: 'Your voice,',
    titleMuted: 'with guardrails.',
    body:
      'Every SDR we ship is trained on your best rep\'s messages and bound by rules you set. It sells the way you would — and never promises what you can\'t deliver.',
    items: [
      ['Trained on your best rep', 'We feed it your winning threads, objections and tone. Hindi, English or Hinglish — whatever your customers write in.'],
      ['Hard rules', 'Discount limits, delivery dates, claims it can never make. The SDR asks you before stepping outside them.'],
      ['One-tap handoff', 'When intent is hot, or a lead asks for a human, the thread lands on your phone with the full context.'],
    ],
  },
  stack: {
    title: 'Every channel your leads live on.',
    body: 'The SDR plugs into your existing CRM and inboxes — no new tool for your team to learn.',
    tools: ['WhatsApp Business API', 'Gmail', 'Outlook', 'LinkedIn', 'HubSpot', 'Zoho CRM', 'IndiaMART', 'Justdial', 'Meta Lead Ads', 'Google Calendar', 'Calendly', 'Custom CRM'],
  },
  numbers: {
    items: [
      ['<30 sec', 'first reply to every new lead, day or night'],
      ['3x', 'more leads converted to booked meetings'],
      ['24/7', 'coverage across WhatsApp, email and LinkedIn'],
    ],
  },
  process: {
    title: 'From audit to a full pipe.',
    steps: [
      ['Pipeline audit', 'We read your last 200 lead conversations and find exactly where leads leak. You get the report either way.'],
      ['Playbook + voice', 'Qualification questions, objection handling, tone and hard rules — written with you, trained into the SDR.'],
      ['Supervised launch', 'Two weeks on one channel where you see every message before it goes. We tune until you stop editing.'],
      ['Scale channels', 'Add email, LinkedIn and outbound. Weekly pipeline reports; the SDR keeps learning from every close.'],
    ],
  },
}

export default function HeadSdr() {
  return <HeadLayout {...CONTENT} />
}
