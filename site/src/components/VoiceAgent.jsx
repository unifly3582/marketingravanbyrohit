import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { VoiceAgentClient, STATES, fetchVoiceConfig, originReachable } from '../lib/voiceAgent.js'
import { Cross } from './icons.jsx'
import WhatsAppHandoff from './WhatsAppHandoff.jsx'
import WhatsAppDemo from './WhatsAppDemo.jsx'
import WhatsAppLive from './WhatsAppLive.jsx'

/*
 * The site's own agent, as a floating panel.
 *
 * It is the product demo and the product at once. It opens on a question —
 * what do you want to see? — with tappable answers, and a visitor gets value
 * before anyone asks for a microphone: a WhatsApp agent they can play with
 * right here, a call to their phone, a quick audit of what we would automate
 * for them. Voice is one tap away at every point, never a gate.
 *
 * Two kinds of screen live in here. Local ones (the opening choices, the
 * WhatsApp demo, the call-me form) cost nothing and need no session. The
 * conversation itself is a live session with Ravan, started in text or voice,
 * switchable between the two, and it drives the page as it talks — the tool
 * chips and the route changing under the visitor are the point, because a
 * prospect who watches an agent operate a UI understands what we sell faster
 * than any case study explains it.
 */

const CAPTION_LIMIT = 14

/** What the launcher says, by page. The corner button should know where it is. */
const LAUNCHER_LABEL = {
  '/heads/sdr': 'Try the WhatsApp agent',
  '/heads/voice': 'Get a call from Ravan',
  '/pricing': 'Ask about pricing',
}

/** The opening screen. `intent` is what the server is told; local screens have none. */
const INTENTS = [
  { key: 'whatsapp', label: 'WhatsApp agent', sub: 'Live demo on your own WhatsApp', tone: 'wa', glyph: 'wa', screen: 'wa' },
  { key: 'voice', label: 'Voice agent', sub: 'Ravan calls your phone', tone: 'voice', glyph: 'phone', screen: 'call' },
  { key: 'audit', label: 'What could you automate?', sub: 'Three taps. A plan for your business.', tone: 'gold', glyph: 'spark', wide: true, intent: 'audit' },
  { key: 'pricing', label: 'Pricing', sub: 'Straight from our playbook', tone: 'plain', glyph: 'tag', intent: 'pricing' },
  { key: 'question', label: 'Ask a question', sub: 'Type below, in any language', tone: 'plain', glyph: 'ask', focus: true },
]

export default function VoiceAgent() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [available, setAvailable] = useState(null) // null = still checking
  const [wsOrigin, setWsOrigin] = useState(null)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState('intent') // intent | wa | phone | call — the local screens
  const [state, setState] = useState(STATES.idle)
  const [mode, setMode] = useState('text') // text | voice
  const [muted, setMuted] = useState(false)
  const [level, setLevel] = useState(0)
  const [captions, setCaptions] = useState([])
  const [partial, setPartial] = useState({ user: '', agent: '' })
  const [choices, setChoices] = useState(null) // { options, prompt } from the agent
  const [activity, setActivity] = useState([])
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('')
  // Who the agent has learned this is, so the WhatsApp form is pre-filled.
  const [identity, setIdentity] = useState({ name: null, phone10: null })
  // Messages that actually went to their WhatsApp, shown as they were sent.
  const [waMsgs, setWaMsgs] = useState([])
  // The handoff form: null, or { trigger, reason, summary, flagged }.
  const [handoff, setHandoff] = useState(null)
  const [runId, setRunId] = useState(null)

  const clientRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const live = state === STATES.listening || state === STATES.speaking
  const starting = state === STATES.connecting || state === STATES.requesting
  // Once a session has been started the panel body is the conversation,
  // whatever screen was showing before.
  const chatting = state !== STATES.idle

  // Don't offer a microphone button the server would refuse. One cheap call,
  // once, so a disabled agent is simply absent rather than broken.
  useEffect(() => {
    let cancelled = false
    fetchVoiceConfig()
      .then(async (cfg) => {
        if (cancelled) return
        setAvailable(!!cfg.enabled)
        if (!cfg.wsOrigin) return
        // Check the fast route now, while the visitor is still reading. If it
        // is unreachable from this network we simply never offer it, and the
        // session starts on the page's own origin with no delay at all.
        const ok = await originReachable(cfg.wsOrigin)
        if (cancelled) return
        if (ok) setWsOrigin(cfg.wsOrigin)
        else console.warn(`voice: ${cfg.wsOrigin} is not reachable from here; using this origin`)
      })
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
  }, [captions, partial, choices, activity, handoff, screen, waMsgs])

  const note = useCallback((text, tone = 'tool') => {
    setActivity((prev) => [...prev.slice(-3), { id: crypto.randomUUID(), text, tone }])
  }, [])

  /**
   * Start the live session.
   *
   * @param {object} opts
   * @param {'text'|'voice'} [opts.mode]
   * @param {string|null} [opts.intent]   what they tapped, for the greeting
   * @param {string|null} [opts.firstText] something they already typed, sent as soon as the agent is ready
   */
  const startSession = useCallback(async ({ mode: m = 'text', intent = null, firstText = null } = {}) => {
    setError(null)
    setCaptions([])
    setPartial({ user: '', agent: '' })
    setChoices(null)
    setWaMsgs([])
    setHandoff(null)
    setMode(m)
    setMuted(false)

    const client = new VoiceAgentClient({ page: pathname, wsOrigin })
    clientRef.current = client

    client.addEventListener('state', (e) => setState(e.detail))
    client.addEventListener('level', (e) => setLevel(e.detail))
    client.addEventListener('mode', (e) => setMode(e.detail))
    client.addEventListener('muted', (e) => setMuted(e.detail))
    client.addEventListener('error', (e) => {
      setError(e.detail.message)
      // A refused microphone mid-conversation is a hiccup; the socket is
      // still up and they can keep typing. Anything else — the network, a
      // full house — means voice failed them, and WhatsApp is the way out,
      // with the transcript so far.
      if (e.detail.recoverable) return
      setHandoff((h) => h ?? { trigger: 'error', reason: `Voice failed: ${e.detail.message}` })
    })
    client.addEventListener('ready', (e) => {
      setRunId(e.detail.runId ?? null)
      if (firstText) client.sendText(firstText)
    })
    client.addEventListener('end', (e) => {
      if (e.detail.reason === 'max_duration' || e.detail.reason === 'idle')
        setHandoff((h) => h ?? { trigger: 'ended', reason: `Session ended (${e.detail.reason})` })
    })

    client.addEventListener('transcript', (e) => {
      const { role, text, final } = e.detail
      // Whatever the visitor says or types answers the open question.
      if (role === 'user') setChoices(null)
      if (final) {
        setPartial((p) => ({ ...p, [role]: '' }))
        setCaptions((prev) => [...prev, { id: crypto.randomUUID(), role, text }].slice(-CAPTION_LIMIT))
      } else {
        setPartial((p) => ({ ...p, [role]: p[role] + text }))
      }
    })
    client.addEventListener('choices', (e) => setChoices({ options: e.detail.options, prompt: e.detail.prompt }))

    client.addEventListener('navigate', (e) => {
      // This is the moment the demo lands, so it is announced as well as done.
      note(`Opened ${e.detail.path}`, 'navigate')
      navigate(e.detail.path)
    })
    client.addEventListener('tool', (e) => {
      if (e.detail.status === 'ok' && e.detail.name !== 'navigate_site' && e.detail.name !== 'offer_choices')
        note(e.detail.label)
    })
    client.addEventListener('identity', (e) => {
      setIdentity({ name: e.detail.name ?? null, phone10: e.detail.phone10 ?? null })
      if (e.detail.phone10) note(`Saved your number, ${e.detail.name ?? 'thanks'}`, 'good')
    })
    client.addEventListener('callback', () => note('Calling you now — pick up', 'good'))
    client.addEventListener('whatsapp', (e) => {
      note(e.detail.mode === 'template' ? 'Sent to your WhatsApp — reply to continue there' : 'Sent to your WhatsApp', 'good')
      if (e.detail.text) setWaMsgs((prev) => [...prev, { id: crypto.randomUUID(), text: e.detail.text, mode: e.detail.mode }])
    })
    client.addEventListener('handoff', (e) => {
      // With a number already captured the server has flagged the thread and
      // messaged them; without one, the form is the handoff.
      if (e.detail.flagged) note('A person from the team will continue on WhatsApp', 'good')
      else setHandoff({ trigger: 'agent', reason: e.detail.reason, summary: e.detail.summary ?? null })
    })

    await client.start({ mode: m, intent })
  }, [navigate, note, pathname, wsOrigin])

  const endSession = useCallback(() => {
    clientRef.current?.stop()
    clientRef.current = null
  }, [])

  /**
   * Reset: back to the opening screen with nothing carried over. Ends a live
   * session, drops the transcript and the trail, forgets who they said they
   * were, and unmounts whichever demo was showing so it starts clean.
   */
  const startOver = useCallback(() => {
    endSession()
    setState(STATES.idle)
    setScreen('intent')
    setCaptions([])
    setPartial({ user: '', agent: '' })
    setChoices(null)
    setActivity([])
    setError(null)
    setTyped('')
    setLevel(0)
    setWaMsgs([])
    setHandoff(null)
    setIdentity({ name: null, phone10: null })
    setRunId(null)
    setMode('text')
    setMuted(false)
  }, [endSession])

  // Anything to reset? The opening screen with nothing said is already clean.
  const resettable = chatting || screen !== 'intent' || activity.length > 0 || !!handoff

  // A tab closed mid-conversation must still release the microphone and let
  // the server close out the run.
  useEffect(() => () => clientRef.current?.stop(), [])

  /** The microphone button: start in voice, or flip a live session's mode. */
  async function toggleMic() {
    const client = clientRef.current
    if (!chatting || !client) {
      startSession({ mode: 'voice', intent: screen === 'call' ? 'voice' : null })
      return
    }
    if (!live) return
    if (mode === 'voice') client.disableMic()
    else await client.enableMic()
  }

  function submitTyped(e) {
    e.preventDefault()
    const text = typed.trim()
    if (!text) return
    setTyped('')
    if (!chatting) {
      startSession({ mode: 'text', intent: 'question', firstText: text })
      return
    }
    if (!live) return
    setChoices(null)
    clientRef.current?.sendText(text)
  }

  function pick(option) {
    setChoices(null)
    clientRef.current?.sendText(option)
  }

  function chooseIntent(item) {
    if (item.screen) return setScreen(item.screen)
    if (item.intent) return startSession({ mode: 'text', intent: item.intent })
    if (item.focus) inputRef.current?.focus()
  }

  if (available === false) return null

  const launcherLabel = LAUNCHER_LABEL[pathname] ?? 'Ask Ravan'

  return (
    <>
      <LauncherButton open={open} live={live} level={level} label={launcherLabel} onClick={() => setOpen((v) => !v)} />

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Ravan, the AI agent"
            className="ravan-panel fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-t backdrop-blur-xl md:inset-x-auto md:right-6 md:bottom-28 md:max-h-[min(38rem,calc(100vh-8.5rem))] md:w-full md:max-w-sm md:rounded-3xl md:border"
          >
            <header className="flex items-center gap-2.5 border-b border-line px-4 py-3 md:px-5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold to-ember font-display text-sm font-extrabold text-[#1a0d05] shadow-[0_4px_14px_rgba(226,87,30,0.35)]"
              >
                R
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[0.95rem] leading-tight font-bold whitespace-nowrap">
                  Ravan
                  {!chatting && <span className="ml-1 text-[0.7rem] font-semibold tracking-wide text-gold">AI agent</span>}
                </p>
                <p className={`mt-0.5 flex items-center gap-1.5 text-xs text-muted ${live ? '' : ''}`}>
                  <span
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      live ? 'bg-ember shadow-[0_0_0_3px_rgba(226,87,30,0.25)]' : 'bg-muted/60'
                    }`}
                  />
                  <span className="truncate">{statusText(state, mode)}</span>
                </p>
              </div>

              {chatting && live && (
                <>
                  <div className="inline-flex rounded-full border border-line p-0.5 text-[0.62rem] font-bold tracking-wide">
                    <button
                      type="button"
                      onClick={() => mode === 'voice' && clientRef.current?.disableMic()}
                      className={`rounded-full px-2.5 py-1 transition-colors ${mode === 'text' ? 'bg-card2 text-cream' : 'text-muted'}`}
                      aria-pressed={mode === 'text'}
                    >
                      Type
                    </button>
                    <button
                      type="button"
                      onClick={() => mode === 'text' && clientRef.current?.enableMic()}
                      className={`rounded-full px-2.5 py-1 transition-colors ${mode === 'voice' ? 'bg-card2 text-cream' : 'text-muted'}`}
                      aria-pressed={mode === 'voice'}
                    >
                      Talk
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => clientRef.current?.setMuted(!muted)}
                    aria-label={muted ? 'Unmute Ravan' : 'Mute Ravan'}
                    aria-pressed={muted}
                    className={`rounded-full border border-line p-1.5 transition-colors ${muted ? 'text-ember' : 'text-muted hover:text-cream'}`}
                  >
                    <SpeakerIcon muted={muted} className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {resettable && (
                <button
                  type="button"
                  onClick={startOver}
                  aria-label="Reset the conversation"
                  title="Reset"
                  className="rounded-full border border-line p-1.5 text-muted transition-colors hover:text-cream"
                >
                  <ResetIcon className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={() => { endSession(); setOpen(false) }}
                aria-label="Close"
                className="rounded-full border border-line p-1.5 text-muted transition-colors hover:text-cream"
              >
                <Cross className="h-3.5 w-3.5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
              {!chatting && screen === 'intent' && <IntentScreen onPick={chooseIntent} />}

              {!chatting && screen === 'wa' && (
                <WhatsAppLive
                  page={pathname}
                  onEvent={note}
                  onSample={() => setScreen('phone')}
                  onBack={() => setScreen('intent')}
                />
              )}

              {!chatting && screen === 'phone' && (
                <WhatsAppDemo
                  onEvent={(text) => note(text, 'good')}
                  onTalk={() => startSession({ mode: 'text', intent: 'whatsapp' })}
                  onWhatsApp={() => setScreen('wa')}
                  onBack={() => setScreen('intent')}
                />
              )}

              {!chatting && screen === 'call' && (
                <CallMeScreen
                  page={pathname}
                  onCalled={(name) => note(`Calling ${name} now — pick up`, 'good')}
                  onTalkHere={() => startSession({ mode: 'voice', intent: 'voice' })}
                  onBack={() => setScreen('intent')}
                />
              )}

              {chatting && starting && captions.length === 0 && (
                <p className="text-xs leading-relaxed text-muted">
                  {state === STATES.requesting
                    ? 'Allow the microphone when your browser asks. It stays on only while you are talking, and we never store the audio.'
                    : 'Connecting you to Ravan…'}
                </p>
              )}

              {captions.map((c) => (
                <Caption key={c.id} role={c.role} text={c.text} />
              ))}
              {partial.user && <Caption role="user" text={partial.user} faded />}
              {partial.agent && <Caption role="agent" text={partial.agent} faded />}

              {choices && live && (
                <div>
                  {choices.prompt && <p className="mb-1.5 text-[0.62rem] font-bold tracking-widest text-muted uppercase">{choices.prompt}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {choices.options.map((o) => (
                      <Chip key={o} onClick={() => pick(o)}>{o}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {waMsgs.map((m) => (
                <WhatsAppCard key={m.id} text={m.text} mode={m.mode} />
              ))}

              {activity.length > 0 && <Trail items={activity} />}

              {error && <p className="text-xs leading-relaxed text-ember">{error}</p>}

              {chatting && (state === STATES.ended || state === STATES.error) && !handoff && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Chip onClick={() => startSession({ mode })}>Talk again</Chip>
                  <Chip onClick={startOver}>Reset</Chip>
                </div>
              )}

              {handoff && (
                <WhatsAppHandoff
                  handoff={handoff}
                  identity={identity}
                  runId={runId ?? clientRef.current?.runId ?? null}
                  page={pathname}
                  onClose={() => setHandoff(null)}
                />
              )}
            </div>

            <footer className="border-t border-line px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] md:px-5">
              <form onSubmit={submitTyped} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={starting}
                  placeholder={chatting ? (mode === 'voice' ? '…or type instead' : 'Type your reply') : 'Ask me anything…'}
                  aria-label="Message Ravan"
                  autoComplete="off"
                  enterKeyHint="send"
                  className="ravan-input min-w-0 flex-1 rounded-full px-4 py-2.5 text-base text-cream outline-none placeholder:text-muted disabled:opacity-60 md:py-2 md:text-xs"
                />
                <MicButton mode={mode} live={live} chatting={chatting} level={level} disabled={starting} onClick={toggleMic} />
                {chatting && live && (
                  <button
                    type="button"
                    onClick={endSession}
                    className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-ember hover:text-ember"
                  >
                    End
                  </button>
                )}
              </form>
              <p className="mt-2 flex items-center justify-between gap-2 text-[0.65rem] text-muted">
                <span className="truncate">
                  {mode === 'voice' && live
                    ? 'Just talk — interrupt any time. Nothing is recorded.'
                    : 'Nothing is recorded. Only the transcript is kept.'}
                </span>
                {!handoff && <WhatsAppLink onClick={() => setHandoff({ trigger: 'visitor' })} />}
              </p>
            </footer>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function statusText(state, mode) {
  switch (state) {
    case STATES.requesting: return 'Allow the microphone…'
    case STATES.connecting: return 'Connecting…'
    case STATES.listening: return mode === 'voice' ? 'Listening' : 'Your turn'
    case STATES.speaking: return 'Speaking'
    case STATES.ended: return 'Session ended'
    case STATES.error: return 'Something went wrong'
    default: return 'Text or voice · English, Hindi, Hinglish'
  }
}

/* ------------------------------------------------------------------ */
/* Local screens                                                       */
/* ------------------------------------------------------------------ */

function IntentScreen({ onPick }) {
  return (
    <div className="space-y-3.5">
      <div>
        <h3 className="font-display text-[1.35rem] leading-[1.1] font-extrabold tracking-tight text-balance">
          See it work, <span className="text-gold">in a minute.</span>
        </h3>
        <p className="mt-1.5 max-w-[30ch] text-[0.78rem] leading-relaxed text-muted">
          I&apos;m Ravan, the same AI agent we build for clients. Pick a demo, or ask me anything.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {INTENTS.map((item) => {
          const Glyph = GLYPHS[item.glyph]
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onPick(item)}
              data-tone={item.tone}
              className={`ravan-tile ${item.wide ? 'wide col-span-2' : ''}`}
            >
              <span className="glyph" aria-hidden="true"><Glyph /></span>
              <span className="min-w-0">
                <span className="label block">{item.label}</span>
                <span className="sub block">{item.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The tile glyphs: one per channel, tinted by the tile. */
const GLYPHS = {
  wa: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L4 21l1.6-4.3A8.5 8.5 0 1 1 21 12z" />
      <path d="M9 10h6M9 13.5h4" />
    </svg>
  ),
  phone: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  ),
  spark: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  ),
  tag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  ask: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9.5a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4" />
      <circle cx="12" cy="18" r="0.6" fill="currentColor" />
    </svg>
  ),
}

/**
 * "Ravan will call you." A real call from the outbound voice agent, placed
 * through the same endpoint the contact page uses. If dialing is not
 * configured the visitor is told, and offered the browser instead.
 */
function CallMeScreen({ page, onCalled, onTalkHere, onBack }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('form') // form | calling | done | error
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (state === 'calling') return
    const digits = phone.replace(/\D/g, '')
    const p10 = /^[6-9]\d{9}$/.test(digits) ? digits : /^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : null
    if (!p10) return setError('Enter a 10-digit Indian mobile number.')
    setError('')
    setState('calling')
    try {
      const res = await fetch('/api/request-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null, phone: p10, source: 'web-panel' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not place the call.')
      setState('done')
      onCalled(name.trim() || 'you')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div className="space-y-3">
      <BackLink onClick={onBack} />
      <div>
        <h3 className="font-display text-lg leading-tight font-bold text-balance">Ravan will call you</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          A real call from the voice agent, on your number, in about thirty seconds. Or talk here in the browser.
        </p>
      </div>

      {state === 'done' ? (
        <div className="rounded-2xl border border-ember/40 bg-ember/10 px-3 py-3 text-xs leading-relaxed text-cream">
          <span className="mb-1 block text-[0.6rem] font-bold tracking-widest text-ember uppercase">Calling now</span>
          Your phone is about to ring. Pick up, and say hello to Ravan.
        </div>
      ) : (
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
            placeholder="Mobile number (10 digits)"
            inputMode="numeric"
            autoComplete="tel-national"
            aria-label="Mobile number"
            required
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base outline-none placeholder:text-muted focus:border-ember md:text-sm"
          />
          {error && <p className="text-xs text-ember">{error}</p>}
          <button type="submit" disabled={state === 'calling'} className="btn-primary w-full justify-center !py-2.5 text-xs disabled:opacity-60">
            {state === 'calling' ? 'Placing the call…' : 'Call me'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onTalkHere}
        className="w-full rounded-full border border-line px-4 py-2.5 text-xs font-semibold text-cream transition-colors hover:border-gold/60 hover:bg-gold/5"
      >
        {state === 'error' ? 'Talk here in the browser instead' : 'Or talk here in the browser'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function BackLink({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-[0.66rem] font-semibold text-muted hover:text-cream">
      ← All options
    </button>
  )
}

export function Chip({ onClick, children, tone = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-display text-xs font-semibold transition-[border-color,background-color,transform] hover:-translate-y-px ${
        tone === 'wa'
          ? 'border-emerald-500/40 bg-card text-cream hover:bg-emerald-500/10'
          : 'border-line bg-card text-cream hover:border-gold/60 hover:bg-gold/5'
      }`}
    >
      {children}
    </button>
  )
}

/** What the agent just did, as it does it. */
function Trail({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5 pt-1">
      <li className="mr-0.5 text-[0.58rem] font-bold tracking-widest text-muted uppercase">Ravan just</li>
      {items.map((a) => (
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
  )
}

/** The small always-available way out: no microphone needed. */
function WhatsAppLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap font-semibold text-emerald-400 underline-offset-2 hover:underline"
    >
      Continue on WhatsApp
    </button>
  )
}

/** A message that went to their WhatsApp, shown as they will see it. */
function WhatsAppCard({ text, mode }) {
  return (
    <div className="rounded-2xl rounded-tl-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-cream">
      <span className="mb-1 block text-[0.6rem] font-bold tracking-widest text-emerald-400 uppercase">Sent to your WhatsApp</span>
      {text}
      {mode === 'template' && <span className="mt-1 block text-[0.65rem] text-muted">Reply to it and we continue there.</span>}
    </div>
  )
}

function Caption({ role, text, faded = false }) {
  const agent = role === 'agent'
  if (agent) {
    return (
      <div className={`ravan-agent max-w-[92%] text-sm leading-relaxed text-cream ${faded ? 'opacity-55' : ''}`}>
        <span className="mb-0.5 block text-[0.58rem] font-extrabold tracking-[0.18em] text-gold uppercase">Ravan</span>
        {text}
      </div>
    )
  }
  return (
    <p className={`ml-auto max-w-[88%] text-right text-sm leading-relaxed text-muted ${faded ? 'opacity-55' : ''}`}>
      {text}
    </p>
  )
}

function MicIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" strokeLinecap="round" />
    </svg>
  )
}

function ResetIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function SpeakerIcon({ muted, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {muted ? <path d="M23 9l-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
    </svg>
  )
}

/**
 * The microphone, beside the text box. Starts a spoken session when there is
 * none, and flips a live one between typing and talking. Breathes with the
 * visitor's voice while the microphone is open.
 */
function MicButton({ mode, live, chatting, level, disabled, onClick }) {
  const on = chatting && live && mode === 'voice'
  const scale = on ? 1 + Math.min(level, 0.6) * 0.6 : 1
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={on ? 'Switch to typing' : chatting ? 'Switch to talking' : 'Talk instead'}
      aria-pressed={on}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-60 md:h-9 md:w-9"
    >
      <span
        aria-hidden="true"
        style={{ transform: `scale(${scale})` }}
        className={`absolute inset-0 rounded-full transition-transform duration-100 ${on ? 'bg-ember/30' : 'bg-transparent'}`}
      />
      <span
        className={`absolute inset-0 rounded-full ${
          on ? 'bg-gradient-to-br from-gold to-ember' : 'border border-line bg-card'
        }`}
      />
      <MicIcon className={`relative h-4 w-4 ${on ? 'text-[#1a0d05]' : 'text-cream'}`} />
    </button>
  )
}

/** The corner button. Says what it can do on this page, and breathes while a session is live. */
function LauncherButton({ open, live, level, label, onClick }) {
  const scale = live ? 1 + Math.min(level, 0.6) * 0.35 : 1
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Hide the agent' : label}
      aria-expanded={open}
      className="fixed right-4 bottom-4 z-50 inline-flex h-12 items-center gap-2.5 rounded-full pr-4 pl-2 font-display text-sm font-bold text-[#1a0d05] shadow-[0_10px_32px_rgba(226,87,30,0.4)] md:right-6 md:bottom-6"
    >
      <span
        aria-hidden="true"
        style={{ transform: `scale(${scale})` }}
        className={`absolute inset-0 rounded-full transition-[transform,opacity] duration-100 ${live ? 'bg-ember/30' : 'bg-transparent'}`}
      />
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-gold to-ember" />
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#1a0d05]/15">
        {open ? <Cross className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
      </span>
      <span className="relative">{open ? 'Close' : label}</span>
      {live && (
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ground bg-ember">
          <span className="absolute inset-0 animate-ping rounded-full bg-ember" />
        </span>
      )}
    </button>
  )
}
