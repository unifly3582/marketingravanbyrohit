import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { Link } from 'react-router-dom'
import Contact from '../components/Contact.jsx'
import { HeadIcon, Arrow, Check } from '../components/icons.jsx'

/*
 * Head 01 — Agentic AI & Workflow Automation.
 * Dedicated page: the hero sells "a digital employee", the centerpiece is a
 * self-playing invoice-to-books demo (WhatsApp thread + agent console side
 * by side), followed by job cards, the human-in-the-loop trust section,
 * integrations, numbers and the engagement process.
 */

/* ---------------- demo script ----------------
 * Each step can push a chat bubble, a console log line, or both.
 * The player advances one step at a time and loops.
 */
const SCRIPT = [
  {
    chat: { who: 'supplier', file: true, text: 'invoice_sharma_traders.jpg' },
    log: { label: 'Trigger', text: 'WhatsApp media received from Sharma Traders' },
  },
  {
    chat: { who: 'agent', text: 'Got it — reading the invoice…' },
    log: { label: 'OCR', text: '9 fields extracted — vendor, GSTIN, invoice #, amount, due date' },
  },
  {
    log: { label: 'Validate', text: 'GSTIN verified · duplicate check passed' },
  },
  {
    log: { label: 'Action', text: 'Entry #INV-2041 posted to Tally · inventory sheet updated' },
  },
  {
    chat: {
      who: 'agent',
      text: 'Recorded ₹42,300 from Sharma Traders, due 18 Sep. Approve payment?',
      actions: ['Approve', 'Hold'],
    },
    log: { label: 'Human-in-loop', text: 'Approval requested — one tap on WhatsApp' },
  },
  {
    chat: { who: 'you', text: 'Approve' },
    log: { label: 'Approved', text: 'Owner approved in 6 seconds' },
  },
  {
    chat: { who: 'agent', text: 'Payment scheduled for 18 Sep. Entry posted, supplier notified. Done ✅' },
    log: { label: 'Done', text: 'Loop closed · full audit trail saved' },
  },
]

const STEP_MS = 1600
const LOOP_PAUSE_MS = 4200

function InvoiceDemo() {
  const ref = useRef(null)
  const inView = useInView(ref, { margin: '-80px' })
  const reduced = useRef(
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [step, setStep] = useState(reduced.current ? SCRIPT.length : 0)

  useEffect(() => {
    if (reduced.current || !inView) return
    const id = setInterval(() => {
      setStep((s) => (s >= SCRIPT.length ? s : s + 1))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [inView])

  // restart the loop after a pause once the script finishes
  useEffect(() => {
    if (reduced.current || step < SCRIPT.length) return
    const id = setTimeout(() => setStep(0), LOOP_PAUSE_MS)
    return () => clearTimeout(id)
  }, [step])

  const visible = SCRIPT.slice(0, step)
  const chats = visible.filter((s) => s.chat).map((s) => s.chat)
  const logs = visible.filter((s) => s.log).map((s) => s.log)
  const done = step >= SCRIPT.length

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* phone / WhatsApp thread */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold">
            <HeadIcon name="agent" className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-bold">Payables Desk</p>
            <p className="text-[0.65rem] text-muted">WhatsApp Business · agent online</p>
          </div>
          <span className="ml-auto h-2 w-2 rounded-full bg-gold" />
        </div>

        <div className="flex min-h-[21rem] flex-col justify-end gap-2.5 p-5">
          {chats.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35 }}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.83rem] leading-relaxed ${
                c.who === 'agent'
                  ? 'self-start rounded-bl-md border border-gold/25 bg-ground text-cream'
                  : c.who === 'you'
                    ? 'self-end rounded-br-md bg-gradient-to-r from-gold to-ember font-bold text-[#1a0d05]'
                    : 'self-start rounded-bl-md border border-line bg-card2 text-cream/90'
              }`}
            >
              <p className="mb-1 text-[0.55rem] font-bold uppercase tracking-[0.18em] opacity-60">
                {c.who === 'agent' ? 'Agent' : c.who === 'you' ? 'You' : 'Supplier'}
              </p>
              {c.file ? (
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" aria-hidden="true">
                    <path d="M6 3h9l4 4v14H6z M15 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                  {c.text}
                </span>
              ) : (
                c.text
              )}
              {c.actions && (
                <span className="mt-2 flex gap-2">
                  {c.actions.map((a) => (
                    <span
                      key={a}
                      className={`rounded-full px-3 py-1 text-[0.65rem] font-bold ${
                        a === 'Approve'
                          ? 'bg-gold/20 text-gold'
                          : 'border border-line text-muted'
                      }`}
                    >
                      {a}
                    </span>
                  ))}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* agent console */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">AGENT CONSOLE</p>
          <p className="text-[0.65rem] text-muted">invoice-to-books · run #2041</p>
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
        <div className="border-t border-line px-5 py-3.5">
          <p className="text-[0.72rem] text-muted">
            {done ? (
              <span className="text-gold">Run complete — 14 seconds of agent time. Your time: one tap.</span>
            ) : (
              'Running…'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- page content ---------------- */

const JOBS = [
  {
    title: 'Invoice → Books',
    trigger: 'Invoice lands on WhatsApp or email',
    steps: 'OCR → validate GSTIN → post to Tally / Zoho → request payment approval',
    outcome: 'Books always current, zero data entry',
  },
  {
    title: 'Lead Follow-up',
    trigger: 'New lead from your form, IndiaMART or ads',
    steps: 'Enrich → first reply in under 60s → nurture across WhatsApp + email',
    outcome: 'No lead ever goes cold',
  },
  {
    title: 'Meeting Concierge',
    trigger: 'Prospect says "let\'s talk"',
    steps: 'Check calendars → book slot → send prep note from CRM history → follow up after',
    outcome: 'Meetings that book and prep themselves',
  },
  {
    title: 'Daily Ops Report',
    trigger: 'Every night at close',
    steps: 'Pull sales, stock and ad numbers → compile → one WhatsApp summary at 8 AM',
    outcome: 'The whole business in one morning message',
  },
  {
    title: 'Order Status Desk',
    trigger: 'Customer asks "where\'s my order?"',
    steps: 'Look up courier API → reply with live status → escalate only exceptions',
    outcome: 'Support tickets answer themselves',
  },
  {
    title: 'Document Chaser',
    trigger: 'KYC, PO or payment doc pending',
    steps: 'Polite reminder cadence → verify received file → update the record',
    outcome: 'Nothing stuck waiting on paperwork',
  },
]

const MODES = [
  ['Draft', 'The agent prepares every action — you review and send. Day one comfort.'],
  ['Approve', 'The agent acts after one tap from you on WhatsApp. The sweet spot.'],
  ['Autopilot', 'The agent acts on its own and sends you the log. Earned over time.'],
]

const TOOLS = [
  'WhatsApp Business', 'Gmail', 'Google Sheets', 'Tally', 'Zoho', 'HubSpot',
  'Slack', 'Telegram', 'Razorpay', 'IndiaMART', 'Shopify', 'Custom APIs',
]

const NUMBERS = [
  ['18+ hrs', 'saved per week, per workflow'],
  ['<60 sec', 'response to any trigger, 24/7'],
  ['0', 'follow-ups missed or forgotten'],
]

const PROCESS = [
  ['Workflow audit', 'We map your repetitive processes and pick the two or three with the highest ROI. You get the automation plan either way.'],
  ['Agent build', 'We build the agent and connect it to your real tools — your WhatsApp, your books, your CRM. Not a demo sandbox.'],
  ['Supervised launch', 'Two weeks where every action needs your one-tap approval while we tune judgment and edge cases.'],
  ['Autopilot + monitoring', 'The agent runs solo. We monitor, maintain and keep expanding what it can own.'],
]

export default function HeadAgents() {
  useEffect(() => {
    document.title = 'Agentic AI & Workflow Automation — Marketing Ravan'
    return () => { document.title = 'Marketing Ravan' }
  }, [])

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden pt-36 pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[60vh] w-[120vw] -translate-x-1/2"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(226,87,30,0.14), transparent 60%)' }}
        />
        <div className="container-x relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/35 bg-surface text-gold">
              <HeadIcon name="agent" className="h-6 w-6" />
            </span>
            <span className="font-display text-sm font-extrabold tracking-[0.2em] text-gold">
              HEAD 01 / 10 — AGENTS
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-8 max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl"
          >
            Hire a digital employee,
            <br />
            <span className="text-muted">not another tool.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mt-6 max-w-xl text-[1rem] leading-relaxed text-muted"
          >
            AI agents that read, decide and act across your apps — invoices,
            CRM, email, calendar — end to end, without a human pushing buttons.
            You approve; they execute.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link to="/contact" className="btn-primary">
              Book a workflow audit <Arrow className="h-4 w-4" />
            </Link>
            <a href="#demo" className="btn-ghost">Watch it work</a>
            <span className="chip border-gold/40 text-gold">10x Faster Execution</span>
          </motion.div>
        </div>
      </section>

      {/* live demo */}
      <section id="demo" className="border-y border-line bg-surface">
        <div className="container-x py-24">
          <p className="eyebrow">Live walkthrough</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            Watch one agent close the books.
          </h2>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">
            A supplier sends an invoice photo on WhatsApp. Nobody at the
            company touches it again — except one tap to approve.
          </p>
          <div className="mt-12">
            <InvoiceDemo />
          </div>
        </div>
      </section>

      {/* jobs an agent can own */}
      <section className="container-x py-24">
        <p className="eyebrow">The job description</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
          Work an agent can own <span className="text-muted">outright.</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((j, i) => (
            <motion.article
              key={j.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="flex flex-col rounded-3xl border border-line bg-card p-7"
            >
              <span className="font-display text-sm font-extrabold text-gold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 text-lg font-bold">{j.title}</h3>
              <dl className="mt-4 space-y-3 text-[0.83rem] leading-relaxed">
                <div>
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">Trigger</dt>
                  <dd className="mt-0.5 text-cream/85">{j.trigger}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">The agent</dt>
                  <dd className="mt-0.5 text-cream/85">{j.steps}</dd>
                </div>
              </dl>
              <p className="mt-auto pt-5 text-[0.83rem] font-bold text-gold">{j.outcome}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* human in the loop */}
      <section className="border-y border-line bg-surface">
        <div className="container-x grid gap-12 py-24 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Trust, engineered</p>
            <h2 className="mt-4 text-3xl font-bold md:text-5xl">
              Autonomy <span className="text-muted">you control.</span>
            </h2>
            <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted">
              An agent should earn independence the way an employee does. Every
              agent we ship starts supervised and graduates — and every action
              it ever takes is logged, reversible and reviewable.
            </p>
          </div>
          <div className="space-y-4">
            {MODES.map(([mode, body], i) => (
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-center gap-5 rounded-2xl border border-line bg-card p-6"
              >
                <span className="font-display text-sm font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-bold">{mode}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* integrations + numbers */}
      <section className="container-x py-24">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Plays well with</p>
            <h2 className="mt-4 text-2xl font-bold md:text-4xl">Your stack, not ours.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Agents connect to the tools you already run — no migration, no
              "platform" to move into.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">What we build for</p>
            <div className="mt-6 space-y-5">
              {NUMBERS.map(([n, label]) => (
                <div key={label} className="flex items-baseline gap-4 border-b border-line pb-5">
                  <span className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-4xl font-extrabold text-transparent md:text-5xl">
                    {n}
                  </span>
                  <span className="text-sm text-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              Typical targets we design each workflow around — set and measured
              per engagement.
            </p>
          </div>
        </div>
      </section>

      {/* process */}
      <section className="border-y border-line bg-surface">
        <div className="container-x py-24">
          <p className="eyebrow">How an engagement runs</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            From audit to autopilot.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map(([title, body], i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl border border-line bg-card p-7"
              >
                <span className="font-display text-sm font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link to="/contact" className="btn-primary">
              Book a workflow audit <Arrow className="h-4 w-4" />
            </Link>
            <Link to="/#heads" className="btn-ghost">
              <Arrow className="h-4 w-4 rotate-180" /> All ten heads
            </Link>
          </div>
        </div>
      </section>

      <Contact />
    </>
  )
}
