import { useEffect, useRef, useState } from 'react'

/*
 * The WhatsApp handoff, inside the voice panel.
 *
 * Opens when the agent decides a person is needed, when the microphone or the
 * connection fails, when the session hits its ceiling, or when the visitor
 * asks for it. Asks for a name and a number, and nothing else: the server
 * already has the transcript.
 *
 * After submit it shows the exact message that went to their WhatsApp, with
 * delivery ticks, and asks them to reply to it — the reply is what opens the
 * 24-hour window that lets the WhatsApp agent (or a person) answer freely.
 */

const HEADLINES = {
  agent: 'Let’s continue on WhatsApp',
  error: 'Voice trouble? Continue on WhatsApp',
  ended: 'Continue on WhatsApp',
  visitor: 'Continue on WhatsApp',
}

/**
 * @param {object} props
 * @param {{trigger: string, reason?: string, summary?: string}} props.handoff
 * @param {{name?: string|null, phone10?: string|null}} props.identity
 * @param {string|null} props.runId
 * @param {string} props.page
 * @param {() => void} props.onClose
 */
export default function WhatsAppHandoff({ handoff, identity, runId, page, onClose }) {
  const [name, setName] = useState(identity?.name ?? '')
  const [phone, setPhone] = useState(identity?.phone10 ?? '')
  const [note, setNote] = useState(handoff?.summary ?? '')
  const [state, setState] = useState('form') // form | sending | done | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (identity?.name && !name) setName(identity.name)
    if (identity?.phone10 && !phone) setPhone(identity.phone10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.name, identity?.phone10])

  async function submit(e) {
    e.preventDefault()
    if (state === 'sending') return
    const digits = phone.replace(/\D/g, '')
    const p10 = /^[6-9]\d{9}$/.test(digits) ? digits : /^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : null
    if (!p10) {
      setError('Enter a 10-digit Indian mobile number.')
      return
    }
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          phone: p10,
          note: note.trim() || null,
          reason: handoff?.reason ?? HEADLINES[handoff?.trigger] ?? 'Visitor asked to continue on WhatsApp',
          runId: runId ?? null,
          page,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reach the server.')
      setResult(data)
      setState('done')
    } catch (err) {
      setError(err.message)
      setState('form')
    }
  }

  if (state === 'done' && result) return <HandoffDone result={result} onClose={onClose} />

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-cream">{HEADLINES[handoff?.trigger] ?? HEADLINES.visitor}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {handoff?.trigger === 'error'
            ? 'Leave your number and we’ll message you on WhatsApp — the conversation so far comes with it.'
            : 'We’ll message you on WhatsApp with what we discussed, and a person from the team picks it up from there.'}
        </p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        aria-label="Your name"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-ember"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp number (10 digits)"
        inputMode="numeric"
        autoComplete="tel-national"
        aria-label="WhatsApp number"
        required
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-ember"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What is it about? (optional)"
        aria-label="What is it about"
        maxLength={400}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-ember"
      />
      {error && <p className="text-xs text-ember">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={state === 'sending'} className="btn-primary flex-1 justify-center !py-2.5 text-xs disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : 'Message me on WhatsApp'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-ember hover:text-ember"
        >
          Not now
        </button>
      </div>
    </form>
  )
}

/** Delivery ticks, the way WhatsApp draws them. */
function Ticks({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'not_sent') return <span className="text-ember">not sent</span>
  if (s === 'failed') return <span className="text-ember">failed</span>
  if (s === 'read') return <span className="text-sky-400">✓✓ read</span>
  if (s === 'delivered') return <span>✓✓ delivered</span>
  return <span>✓ sent</span>
}

function HandoffDone({ result, onClose }) {
  const [status, setStatus] = useState({ status: result.sent ? 'sent' : 'not_sent', replied: false, human: false })
  const timer = useRef(null)

  // Poll for delivery and for their reply. Stops on its own once they have
  // replied, or after ten minutes — nobody is watching a panel longer than that.
  useEffect(() => {
    if (!result.token) return undefined
    const startedAt = Date.now()
    async function tick() {
      try {
        const r = await fetch(`/api/handoff/${result.token}`)
        if (r.ok) {
          const d = await r.json()
          setStatus(d)
          if (d.replied || Date.now() - startedAt > 10 * 60 * 1000) return
        }
      } catch {
        /* keep polling */
      }
      timer.current = setTimeout(tick, 4000)
    }
    timer.current = setTimeout(tick, 3000)
    return () => clearTimeout(timer.current)
  }, [result.token])

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm font-semibold text-cream">
        {status.replied ? 'Got your reply — we’re on it' : result.sent ? 'Sent to your WhatsApp' : 'Saved — but the message didn’t send'}
      </p>

      {result.text && (
        <div className="rounded-2xl rounded-tl-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-cream">
          {result.text}
          <div className="mt-1 text-right text-[0.6rem] text-muted">
            <Ticks status={status.status} />
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted">
        {status.replied
          ? status.human
            ? 'A person from the team has your thread now.'
            : 'Our WhatsApp agent has picked it up, and a person from the team joins the moment you need one.'
          : result.sent
            ? 'Reply to that message so we can keep talking there — WhatsApp only lets us write freely once you have.'
            : 'Open WhatsApp and send us a message instead; the conversation continues from there.'}
      </p>

      {!status.replied && result.waLink && (
        <a
          href={result.waLink}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full justify-center !py-2.5 text-xs"
        >
          Open WhatsApp
        </a>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-ember hover:text-ember"
      >
        Back to the conversation
      </button>
    </div>
  )
}
