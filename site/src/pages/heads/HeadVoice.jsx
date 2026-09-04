import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 03 — Human-like Voice AI & Call Automation.
 * Demo: a live inbound call. Left: the transcript with a breathing waveform
 * and a latency stamp on every agent turn. Right: the call console — intent,
 * CRM lookup, booking, sentiment.
 */

const SCRIPT = [
  { who: 'caller', text: 'Hello, Dr. Mehta ka clinic hai? Mujhe appointment chahiye.', log: { label: 'Language', text: 'Hindi detected · switching voice to Hindi' } },
  { who: 'agent', text: 'Ji haan, Dr. Mehta clinic mein aapka swagat hai. Kis din aana chahenge?', lat: '0.6s', log: { label: 'Intent', text: 'Book appointment · confidence 0.97' } },
  { who: 'caller', text: 'Kal subah possible hai? Around 10?' },
  { who: 'agent', text: 'Kal subah 10:15 available hai. Aapka naam aur phone number bata dijiye.', lat: '0.5s', log: { label: 'Calendar', text: 'Tomorrow 10:15 free · holding slot' } },
  { who: 'caller', text: 'Ramesh Iyer, 98200 xxxxx. Actually — is it a cash clinic or insurance also?' },
  { who: 'agent', text: 'Dono chalta hai, Ramesh ji. Cashless ke liye bas card saath laayein. 10:15 confirm kar doon?', lat: '0.7s', log: { label: 'CRM', text: 'Ramesh Iyer · existing patient · last visit Mar 2026' } },
  { who: 'caller', text: 'Haan, confirm kar do.' },
  { who: 'agent', text: 'Done. Kal 10:15, Dr. Mehta. WhatsApp par confirmation bhej diya hai. Dhanyavaad!', lat: '0.5s', log: { label: 'Booked', text: 'Appointment #A-3172 · WhatsApp confirmation sent' } },
  { log: { label: 'Sentiment', text: 'Positive · call 48 sec · no human needed' } },
]

function Wave({ live }) {
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-gold"
          animate={live ? { scaleY: [h, 0.25, h * 0.9, 1, h] } : { scaleY: 0.25 }}
          transition={live ? { duration: 0.9 + i * 0.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          style={{ height: '100%', transformOrigin: 'bottom' }}
        />
      ))}
    </span>
  )
}

function VoiceDemo() {
  const { ref, step, done } = usePlayer(SCRIPT.length, { stepMs: 1700, pauseMs: 4200 })
  const visible = SCRIPT.slice(0, step)
  const turns = visible.filter((s) => s.who)
  const logs = visible.filter((s) => s.log).map((s) => s.log)
  const speaking = !done && turns.length ? turns[turns.length - 1].who : null
  const secs = Math.min(48, step * 6)

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* call transcript */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="relative flex h-2.5 w-2.5">
            {!done && <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />}
            <span className="relative h-2.5 w-2.5 rounded-full bg-ember" />
          </span>
          <p className="text-sm font-bold">Inbound · +91 98200 xxxxx</p>
          <span className="ml-auto font-mono text-[0.7rem] tabular-nums text-muted">
            00:{String(secs).padStart(2, '0')}
          </span>
        </div>

        <div className="flex min-h-[24rem] flex-col justify-end gap-3 p-5">
          {turns.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`flex max-w-[88%] items-start gap-3 ${t.who === 'agent' ? 'self-start' : 'self-end flex-row-reverse'}`}
            >
              <span
                className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-bold ${
                  t.who === 'agent' ? 'bg-gold/20 text-gold' : 'bg-card2 text-muted'
                }`}
              >
                {t.who === 'agent' ? 'AI' : 'RI'}
              </span>
              <div
                className={`rounded-2xl px-4 py-2.5 text-[0.85rem] leading-relaxed ${
                  t.who === 'agent'
                    ? 'rounded-bl-md border border-gold/25 bg-ground text-cream'
                    : 'rounded-br-md bg-card2 text-cream/90'
                }`}
              >
                {t.text}
                {t.lat && (
                  <span className="mt-1.5 block text-[0.6rem] font-bold uppercase tracking-[0.16em] text-gold">
                    responded in {t.lat}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Wave live={speaking === 'agent'} />
            <span className="text-[0.7rem] text-muted">
              {done ? 'Call ended' : speaking === 'agent' ? 'Agent speaking' : speaking ? 'Listening…' : 'Ringing…'}
            </span>
          </div>
          <span className="chip !py-1 text-[0.55rem]">Hindi · Sarvam voice</span>
        </div>
      </div>

      {/* call console */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">CALL CONSOLE</p>
          <p className="text-[0.65rem] text-muted">reception agent · Dr. Mehta Clinic</p>
        </div>
        <div className="flex-1 space-y-3 p-5">
          {logs.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15">
                <Check className="h-3 w-3 text-gold" />
              </span>
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-gold">{l.label}</p>
                <p className="text-[0.83rem] leading-relaxed text-cream/85">{l.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {[
            ['0.6s', 'avg response'],
            ['48s', 'call length'],
            ['0', 'human minutes'],
          ].map(([v, l]) => (
            <div key={l} className="px-4 py-3.5 text-center">
              <p className="font-display text-lg font-extrabold text-gold">{done ? v : '—'}</p>
              <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 3,
  hero: {
    line1: 'Calls answered in a heartbeat,',
    line2: 'in the language your customer speaks.',
    body:
      'Voice agents that pick up inbound calls, qualify telesales leads and run follow-ups — natural, interruptible, sub-second — in Hindi, English and ten more Indian languages. The IVR menu is dead.',
    secondary: 'Listen in on a call',
  },
  cta: { label: 'Get a demo call now', href: '/contact' },
  demo: {
    eyebrow: 'Live call',
    title: 'Listen to one call book itself.',
    body:
      'A patient rings a clinic after hours. The agent switches to Hindi, checks the calendar, recognises him from the CRM and confirms — under a second per turn, the whole way.',
    node: <VoiceDemo />,
  },
  jobs: {
    title: 'Calls a voice agent can take',
    titleMuted: 'off your desk.',
    labels: ['The call', 'The agent'],
    items: [
      {
        title: 'Front-desk reception',
        trigger: 'Every inbound call, 24/7, any line',
        steps: 'Answer by the second ring → understand the ask → resolve, book or route to the right human',
        outcome: 'No missed call, ever',
      },
      {
        title: 'Appointment booking',
        trigger: 'Clinics, salons, service centres, showrooms',
        steps: 'Check live availability → book → confirm on WhatsApp → remind → reschedule on request',
        outcome: 'A full calendar without a receptionist',
      },
      {
        title: 'Telesales qualification',
        trigger: 'Your lead list or fresh ad leads',
        steps: 'Outbound call within minutes → qualify in conversation → warm-transfer buyers to a closer',
        outcome: 'Closers only dial qualified numbers',
      },
      {
        title: 'Payment & EMI reminders',
        trigger: 'Dues coming up or overdue',
        steps: 'Polite reminder call → capture a promise-to-pay date → send the payment link on WhatsApp',
        outcome: 'Collections up, awkward calls down',
      },
      {
        title: 'Order & delivery status',
        trigger: '"Where is my order?"',
        steps: 'Verify the caller → pull live courier status → read it out → escalate only exceptions',
        outcome: 'Support lines go quiet',
      },
      {
        title: 'Feedback calls',
        trigger: 'Service or delivery completed',
        steps: 'Short call in the customer\'s language → capture rating and comments → flag detractors instantly',
        outcome: 'Reviews you can act on the same day',
      },
    ],
  },
  trust: {
    eyebrow: 'Not an IVR',
    title: 'A conversation,',
    titleMuted: 'not a menu.',
    body:
      'Customers interrupt, change their mind and mix languages mid-sentence. Our agents handle all of it — and they know exactly when to hand the call to a person.',
    items: [
      ['Interruptible', 'Barge-in works like a real call. The agent stops, listens and adapts — no "press 1 for" ever again.'],
      ['Knows when to hand off', 'Angry caller, complex query, high-value deal — the agent warm-transfers with a spoken summary to your team.'],
      ['Compliant by default', 'Consent line, call recording, DND-registry checks and calling-hour rules baked in from day one.'],
    ],
  },
  stack: {
    title: 'Your numbers, your tools.',
    body: 'Works on your existing phone lines and pushes every outcome into the systems you already run.',
    tools: ['Sarvam AI', 'Vobiz', 'Exotel', 'Twilio', 'WhatsApp', 'Google Calendar', 'Zoho', 'HubSpot', 'Tally', 'Shopify', 'Custom CRM', 'Slack alerts'],
  },
  numbers: {
    items: [
      ['<1 sec', 'response time on every turn'],
      ['11', 'Indian languages, plus English'],
      ['100%', 'of inbound calls answered'],
    ],
  },
  process: {
    title: 'From call audit to every line.',
    steps: [
      ['Call audit', 'We listen to 50 of your real calls and map what a voice agent can resolve alone versus route. You keep the findings.'],
      ['Persona + script', 'Name, voice, language mix and tone — designed with you, then trained on your FAQs, pricing and calendar.'],
      ['Pilot on one number', 'Two weeks on one line, every call reviewed. We tune understanding, edge cases and handoff rules.'],
      ['Scale to all lines', 'Roll out across inbound and outbound. Monthly call analytics and continuous training on new cases.'],
    ],
  },
}

export default function HeadVoice() {
  return <HeadLayout {...CONTENT} />
}
