import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { VoiceAgentClient, STATES, fetchVoiceConfig } from '../lib/voiceAgent.js'
import { Cross } from './icons.jsx'

/*
 * The site's own voice agent, as a floating panel.
 *
 * It is the product demo and the product at once: a visitor talks, Ravan
 * answers aloud, and the page moves to whatever is being discussed. The
 * navigation is deliberately visible — a tool chip appears and the route
 * changes under them — because a prospect who watches an agent operate a UI
 * understands what we sell faster than any case study explains it.
 */

const CAPTION_LIMIT = 6

/** Copy for each state, so the button never says something the agent isn't doing. */
const STATUS = {
  [STATES.idle]: 'Ready when you are',
  [STATES.requesting]: 'Waiting for microphone permission…',
  [STATES.connecting]: 'Connecting…',
  [STATES.listening]: 'Listening',
  [STATES.speaking]: 'Speaking',
  [STATES.ended]: 'Session ended',
  [STATES.error]: 'Something went wrong',
}

export default function VoiceAgent() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [available, setAvailable] = useState(null) // null = still checking
  const [open, setOpen] = useState(false)
  const [state, setState] = useState(STATES.idle)
  const [level, setLevel] = useState(0)
  const [captions, setCaptions] = useState([])
  const [partial, setPartial] = useState({ user: '', agent: '' })
  const [activity, setActivity] = useState([])
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('')

  const clientRef = useRef(null)
  const scrollRef = useRef(null)
  const live = state === STATES.listening || state === STATES.speaking

  // Don't offer a microphone button the server would refuse. One cheap call,
  // once, so a disabled agent is simply absent rather than broken.
  useEffect(() => {
    let cancelled = false
    fetchVoiceConfig()
      .then((cfg) => !cancelled && setAvailable(!!cfg.enabled))
      .catch(() => !cancelled && setAvailable(false))
    return () => { cancelled = true }
  }, [])

  // The visitor may navigate by hand mid-conversation; keep the agent oriented
  // so it doesn't offer to open a page they are already reading.
  useEffect(() => {
    clientRef.current?.setPage(pathname)
  }, [pathname])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [captions, partial])

  const note = useCallback((text, tone = 'tool') => {
    setActivity((prev) => [...prev.slice(-3), { id: crypto.randomUUID(), text, tone }])
  }, [])

  const startSession = useCallback(async () => {
    setError(null)
    setCaptions([])
    setPartial({ user: '', agent: '' })
    setActivity([])

    const client = new VoiceAgentClient({ page: pathname })
    clientRef.current = client

    client.addEventListener('state', (e) => setState(e.detail))
    client.addEventListener('level', (e) => setLevel(e.detail))
    client.addEventListener('error', (e) => setError(e.detail.message))

    client.addEventListener('transcript', (e) => {
      const { role, text, final } = e.detail
      if (final) {
        setPartial((p) => ({ ...p, [role]: '' }))
        setCaptions((prev) => [...prev, { id: crypto.randomUUID(), role, text }].slice(-CAPTION_LIMIT))
      } else {
        setPartial((p) => ({ ...p, [role]: p[role] + text }))
      }
    })

    client.addEventListener('navigate', (e) => {
      // This is the moment the demo lands, so it is announced as well as done.
      note(`Opening ${e.detail.path}`, 'navigate')
      navigate(e.detail.path)
    })
    client.addEventListener('tool', (e) => {
      if (e.detail.status === 'ok' && e.detail.name !== 'navigate_site') note(e.detail.label)
    })
    client.addEventListener('identity', (e) => {
      if (e.detail.phone10) note(`Saved your number, ${e.detail.name ?? 'thanks'}`, 'good')
    })
    client.addEventListener('callback', () => note('Calling you now — pick up', 'good'))
    client.addEventListener('whatsapp', () => note('WhatsApp follow-up sent', 'good'))

    await client.start()
  }, [navigate, note, pathname])

  const endSession = useCallback(() => {
    clientRef.current?.stop()
    clientRef.current = null
  }, [])

  // A tab closed mid-conversation must still release the microphone and let
  // the server close out the run.
  useEffect(() => () => clientRef.current?.stop(), [])

  function submitTyped(e) {
    e.preventDefault()
    const text = typed.trim()
    if (!text || !live) return
    clientRef.current?.sendText(text)
    setTyped('')
  }

  if (available === false) return null

  return (
    <>
      <LauncherButton open={open} live={live} level={level} onClick={() => setOpen((v) => !v)} />

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Talk to Ravan, the AI agent"
            className="fixed right-4 bottom-24 z-50 flex max-h-[min(34rem,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-surface/95 shadow-2xl backdrop-blur-xl md:right-6 md:bottom-28"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="font-display text-sm font-bold">
                  Talk to <span className="text-gold">Ravan</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {live ? STATUS[state] : 'Our AI agent — the same one we build for clients'}
                </p>
              </div>
              <button
                onClick={() => { endSession(); setOpen(false) }}
                aria-label="Close"
                className="rounded-full border border-line p-1.5 text-muted transition-colors hover:text-cream"
              >
                <Cross className="h-3.5 w-3.5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {!live && state !== STATES.connecting && state !== STATES.requesting && (
                <Intro state={state} error={error} />
              )}

              {captions.map((c) => (
                <Caption key={c.id} role={c.role} text={c.text} />
              ))}
              {partial.user && <Caption role="user" text={partial.user} faded />}
              {partial.agent && <Caption role="agent" text={partial.agent} faded />}

              {activity.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {activity.map((a) => (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide ${
                        a.tone === 'navigate'
                          ? 'border-gold/40 bg-gold/10 text-gold'
                          : a.tone === 'good'
                            ? 'border-ember/40 bg-ember/10 text-ember'
                            : 'border-line text-muted'
                      }`}
                    >
                      {a.text}
                    </motion.li>
                  ))}
                </ul>
              )}

              {error && <p className="text-xs leading-relaxed text-ember">{error}</p>}
            </div>

            <footer className="border-t border-line px-5 py-4">
              {live ? (
                <>
                  <form onSubmit={submitTyped} className="flex gap-2">
                    <input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="…or type instead"
                      aria-label="Type to the agent instead of speaking"
                      className="w-full rounded-full border border-line bg-card px-4 py-2 text-xs outline-none placeholder:text-muted focus:border-ember"
                    />
                    <button
                      type="button"
                      onClick={endSession}
                      className="shrink-0 rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-ember hover:text-ember"
                    >
                      End
                    </button>
                  </form>
                  <p className="mt-2 text-[0.65rem] text-muted">
                    Just talk — interrupt any time. Nothing is recorded; only the transcript is kept.
                  </p>
                </>
              ) : (
                <button
                  onClick={startSession}
                  disabled={state === STATES.connecting || state === STATES.requesting}
                  className="btn-primary w-full justify-center !py-3 text-xs disabled:opacity-60"
                >
                  {state === STATES.requesting
                    ? 'Allow the microphone…'
                    : state === STATES.connecting
                      ? 'Connecting…'
                      : state === STATES.ended || state === STATES.error
                        ? 'Talk again'
                        : 'Start talking'}
                </button>
              )}
            </footer>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function Intro({ state, error }) {
  if (error) return null
  return (
    <div className="space-y-2 text-xs leading-relaxed text-muted">
      {state === STATES.ended ? (
        <p>Thanks for talking. Start again any time.</p>
      ) : (
        <>
          <p>
            Ravan answers out loud, in English, Hindi or Hinglish, and will move this page to
            whatever you ask about.
          </p>
          <p>
            We&apos;ll ask for your microphone next. It stays on only while you&apos;re talking, and
            we never store the audio.
          </p>
        </>
      )}
    </div>
  )
}

function Caption({ role, text, faded = false }) {
  const agent = role === 'agent'
  return (
    <p
      className={`text-sm leading-relaxed ${faded ? 'opacity-55' : ''} ${
        agent ? 'text-cream' : 'text-muted'
      }`}
    >
      <span className={`mr-2 text-[0.6rem] font-bold tracking-widest uppercase ${agent ? 'text-gold' : 'text-muted/70'}`}>
        {agent ? 'Ravan' : 'You'}
      </span>
      {text}
    </p>
  )
}

/** The floating button. Breathes with the visitor's voice while a session is live. */
function LauncherButton({ open, live, level, onClick }) {
  const scale = live ? 1 + Math.min(level, 0.6) * 0.5 : 1
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Hide the voice agent' : 'Talk to our AI agent'}
      aria-expanded={open}
      className="fixed right-4 bottom-4 z-50 grid h-14 w-14 place-items-center rounded-full md:right-6 md:bottom-6"
    >
      <span
        aria-hidden="true"
        style={{ transform: `scale(${scale})` }}
        className={`absolute inset-0 rounded-full transition-[transform,opacity] duration-100 ${
          live ? 'bg-ember/30' : 'bg-transparent'
        }`}
      />
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-gold to-ember shadow-[0_10px_32px_rgba(226,87,30,0.4)]" />
      <span className="relative text-[#1a0d05]">
        {open ? (
          <Cross className="h-5 w-5" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {live && (
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ground bg-ember">
          <span className="absolute inset-0 animate-ping rounded-full bg-ember" />
        </span>
      )}
    </button>
  )
}
