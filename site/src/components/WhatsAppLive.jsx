import { useEffect, useRef, useState } from 'react'

/*
 * The WhatsApp agent demo, for real, on the visitor's own number.
 *
 * They type a name and a number. Our demo template lands on their phone and
 * asks them to reply; the reply opens WhatsApp's 24-hour window, and from
 * then on the same WhatsApp agent we ship to clients answers them there.
 *
 * What the panel shows afterwards depends on where they are:
 *   - on a phone, the conversation is one tap away, so the panel offers the
 *     "Open WhatsApp" button first and mirrors the thread underneath;
 *   - on a computer, the phone is in their pocket, so the panel becomes a
 *     read-only window on the thread — every message as it happens, nothing
 *     to type. The conversation belongs on their phone; this only watches.
 */

const POLL_MS = 3000
const POLL_FOR_MS = 20 * 60 * 1000

/** Coarse pointer or a phone UA: good enough to pick which button comes first. */
export function onMobile() {
  if (typeof navigator === 'undefined') return false
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && window.innerWidth < 900
}

/**
 * @param {object} props
 * @param {string} props.page
 * @param {(text: string, tone?: string) => void} props.onEvent   for the "Ravan just" trail
 * @param {() => void} props.onSample   the visitor would rather see the scripted sample
 * @param {() => void} props.onBack
 */
export default function WhatsAppLive({ page, onEvent, onSample, onBack }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('form') // form | sending | live
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const mobile = onMobile()

  async function submit(e) {
    e.preventDefault()
    if (state === 'sending') return
    const digits = phone.replace(/\D/g, '')
    const p10 = /^[6-9]\d{9}$/.test(digits) ? digits : /^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : null
    if (!p10) return setError('Enter a 10-digit Indian mobile number.')
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/demo/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null, phone: p10, page, device: mobile ? 'mobile' : 'desktop' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reach the server.')
      setResult(data)
      setState('live')
      onEvent(`Saved your number, ${name.trim().split(/\s+/)[0] || 'thanks'}`, 'good')
      if (data.sent) onEvent('Sent the demo to your WhatsApp', 'good')
    } catch (err) {
      setError(err.message)
      setState('form')
    }
  }

  if (state === 'live' && result) {
    return <LiveThread result={result} mobile={mobile} onEvent={onEvent} onBack={onBack} />
  }

  return (
    <div className="space-y-3">
      <BackLink onClick={onBack} />
      <div>
        <h3 className="font-display text-lg leading-tight font-bold text-balance">The WhatsApp agent, on your WhatsApp</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Ravan messages you first. Reply to it and the agent takes it from there, the way it would for your customers.
          {mobile ? '' : ' Watch the whole chat live, right here.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-2xl border border-line bg-card p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          aria-label="Your name"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base outline-none placeholder:text-muted focus:border-ember md:text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp number (10 digits)"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-label="WhatsApp number"
          required
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base outline-none placeholder:text-muted focus:border-ember md:text-sm"
        />
        {error && <p className="text-xs text-ember">{error}</p>}
        <button
          type="submit"
          disabled={state === 'sending'}
          className="w-full rounded-full py-2.5 text-xs font-bold text-[#06281a] transition-opacity disabled:opacity-60"
          style={{ background: '#25D366' }}
        >
          {state === 'sending' ? 'Sending…' : 'Send the demo to my WhatsApp'}
        </button>
        <p className="text-[0.62rem] leading-relaxed text-muted">
          One message from Marketing Ravan. Reply STOP any time. We keep your number to follow up on this demo.
        </p>
      </form>

      <button type="button" onClick={onSample} className="w-full text-center text-[0.66rem] font-semibold text-muted hover:text-cream">
        Rather not share a number? See a sample first
      </button>
    </div>
  )
}

/**
 * The read-only mirror. Polls for the thread every few seconds and stops on
 * its own after twenty minutes, or when the panel goes away.
 */
function LiveThread({ result, mobile, onEvent, onBack }) {
  const [feed, setFeed] = useState({ messages: [], replied: false, human: false, status: result.sent ? 'sent' : 'not_sent' })
  const [expired, setExpired] = useState(false)
  const chatRef = useRef(null)
  const timer = useRef(null)
  const seen = useRef(0)

  useEffect(() => {
    if (!result.token) return undefined
    const startedAt = Date.now()
    let stopped = false
    async function tick() {
      try {
        const r = await fetch(`/api/demo/whatsapp/${result.token}`, { cache: 'no-store' })
        if (r.status === 404) { setExpired(true); return }
        if (r.ok) {
          const d = await r.json()
          setFeed(d)
          const inbound = d.messages.filter((m) => m.direction === 'in').length
          if (inbound > seen.current) {
            if (!seen.current) onEvent('Got your reply — the agent is on', 'good')
            seen.current = inbound
          }
          if (d.human) onEvent('A person from the team joined', 'good')
        }
      } catch {
        /* keep polling */
      }
      if (!stopped && Date.now() - startedAt < POLL_FOR_MS) timer.current = setTimeout(tick, POLL_MS)
    }
    timer.current = setTimeout(tick, 2000)
    return () => { stopped = true; clearTimeout(timer.current) }
    // onEvent is stable for the life of the panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.token])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [feed.messages.length])

  // Until the thread has caught up, show the template as we know we sent it.
  const messages = feed.messages.length
    ? feed.messages
    : result.text
      ? [{ id: 'intro', direction: 'out', text: result.text, status: feed.status, at: null }]
      : []

  const headline = expired
    ? 'This window has closed'
    : feed.human
      ? 'A person from the team has your chat'
      : feed.replied
        ? 'Live — the agent is answering you'
        : result.sent
          ? 'Sent to your WhatsApp'
          : 'Saved, but the message did not send'

  const hint = expired
    ? 'The conversation carries on in WhatsApp. Ask for a new demo any time.'
    : feed.replied
      ? mobile
        ? 'Keep chatting in WhatsApp. This box follows along.'
        : 'Keep chatting from your phone. This box only watches; nothing here can be typed.'
      : result.sent
        ? mobile
          ? 'Open WhatsApp and reply to it. The agent can only write freely once you have.'
          : 'Reply to it from your phone. WhatsApp only lets the agent write freely once you have, and every message will appear here.'
        : 'Open WhatsApp and message us instead; the demo starts from your first message.'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <BackLink onClick={onBack} />
        {!expired && (
          <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-bold tracking-widest text-muted uppercase">
            <span className={`h-1.5 w-1.5 rounded-full ${feed.replied ? 'animate-pulse bg-emerald-400' : 'bg-muted/60'}`} />
            {feed.replied ? 'Live' : 'Waiting for your reply'}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-cream">{headline}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      </div>

      {mobile && !feed.replied && !expired && result.waLink && (
        <a
          href={result.waLink}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-full py-2.5 text-center text-xs font-bold text-[#06281a]"
          style={{ background: '#25D366' }}
        >
          Open WhatsApp
        </a>
      )}

      <div className="overflow-hidden rounded-2xl border border-line" style={{ background: '#0b141a' }} aria-live="polite">
        <div className="flex items-center gap-2.5 px-3 py-2" style={{ background: '#1f2c34' }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold to-ember font-display text-[0.7rem] font-extrabold text-[#1a0d05]">
            R
          </span>
          <span className="leading-tight">
            <span className="block text-xs font-semibold" style={{ color: '#e9edef' }}>Marketing Ravan</span>
            <span className="block text-[0.6rem]" style={{ color: '#8696a0' }}>
              {feed.human ? 'A person is typing for us' : 'AI agent · your phone, mirrored here'}
            </span>
          </span>
        </div>

        <div ref={chatRef} className="grid max-h-64 gap-1.5 overflow-y-auto p-2.5">
          {messages.length === 0 && (
            <p className="px-1 py-3 text-center text-[0.7rem]" style={{ color: '#8696a0' }}>Nothing here yet.</p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} out={m.direction === 'out'} text={m.text} status={m.status} at={m.at} />
          ))}
        </div>

        <div className="px-3 py-2 text-center text-[0.62rem]" style={{ background: '#1f2c34', color: '#8696a0' }}>
          {mobile ? 'Reply in WhatsApp, not here' : 'Read-only. Reply from your phone.'}
        </div>
      </div>

      {!mobile && !feed.replied && !expired && result.waLink && (
        <p className="text-center text-[0.66rem] text-muted">
          Phone not nearby?{' '}
          <a href={result.waLink} target="_blank" rel="noreferrer" className="font-semibold text-emerald-400 underline-offset-2 hover:underline">
            Open WhatsApp Web
          </a>
        </p>
      )}
    </div>
  )
}

function Bubble({ out, text, status, at }) {
  const time = at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div
      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[0.74rem] leading-snug whitespace-pre-wrap ${
        out ? 'justify-self-end rounded-tr-sm' : 'justify-self-start rounded-tl-sm'
      }`}
      style={{ background: out ? '#005c4b' : '#202c33', color: '#e9edef' }}
    >
      {text}
      <span className="mt-0.5 block text-right text-[0.55rem]" style={{ color: '#8696a0' }}>
        {time}
        {out && <Ticks status={status} />}
      </span>
    </div>
  )
}

function Ticks({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'failed' || s === 'not_sent') return <span className="ml-1 text-ember">not sent</span>
  if (s === 'read') return <span className="ml-1" style={{ color: '#53bdeb' }}>✓✓</span>
  if (s === 'delivered') return <span className="ml-1">✓✓</span>
  return <span className="ml-1">✓</span>
}

function BackLink({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-[0.66rem] font-semibold text-muted hover:text-cream">
      ← All options
    </button>
  )
}
