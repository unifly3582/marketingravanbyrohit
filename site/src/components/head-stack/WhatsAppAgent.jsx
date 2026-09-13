import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/*
 * The WhatsApp AI card's visual: a phone on the right receiving a customer's
 * messages, and the agent's backend on the left showing what it thinks and
 * which tools it reaches for before it replies. A looping ~45-second script,
 * three conversations long:
 *
 *   1. Smile Dental      a booking: intent, calendar, hold a slot, CRM, reminder
 *   2. Woodline          a Hinglish product enquiry: catalog card, delivery, pay link
 *   3. Nova Mobiles      a complaint: sentiment, order lookup, handoff to a human
 *
 * Every reply lands like a real notification: the phone buzzes and a banner
 * drops in from the top. Built in DOM + CSS, drawn at a fixed 420x318 and
 * scaled to the card. Runs only while the card is in the middle of the pile;
 * with reduced motion it shows the end of the first conversation, still.
 */
export const BASE_W = 420
export const BASE_H = 318

const TOOLS = [
  { key: 'calendar', label: 'Bookings' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'pay', label: 'Payments' },
  { key: 'order', label: 'Orders' },
  { key: 'crm', label: 'CRM' },
  { key: 'bell', label: 'Reminders' },
  { key: 'hand', label: 'Handoff' },
  { key: 'lang', label: '12 languages' },
]

/* ---- the script: a flat list of steps, `wait` is the pause after each ---- */
const SCRIPT = []
const step = (wait, s) => SCRIPT.push({ ...s, wait })
const reset = (biz) => step(300, { type: 'reset', biz })
/* a customer message: sent, then delivered, then read */
const out = (text, wait) => {
  step(420, { type: 'out', text })
  step(650, { type: 'status', s: 'delivered' })
  step(Math.max(200, wait - 1070), { type: 'status', s: 'read' })
}
const think = (text, tool, wait = 650) => step(wait, { type: 'think', text, tool })
const typing = (wait = 1200) => step(wait, { type: 'typing' })
/* the agent's reply: buzz + banner, banner leaves after 2.2 s */
const reply = (text, secs, wait, card) => {
  step(2200, { type: 'in', text, secs, card })
  step(Math.max(200, wait - 2200), { type: 'banner-off' })
}
const system = (text, wait) => step(wait, { type: 'system', text })

// 1. a booking
reset({ name: 'Smile Dental', initial: 'S', hue: '#f0a32f' })
out('Hi, is there a slot for a cleaning this Saturday?', 1300)
think('Intent: book appointment', 'lang', 600)
think('English · tone: friendly', 'lang', 600)
think('Calendar → Sat: 11 am, 4 pm free', 'calendar', 800)
typing(1300)
reply('Yes! Saturday 11 am and 4 pm are free for a cleaning with Dr Mehta. Which suits you?', 2.8, 2900)
out('4 pm please', 1200)
think('Hold 4:00 pm · Dr Mehta', 'calendar', 650)
think('CRM → new lead saved', 'crm', 650)
think('Reminder → Friday 7 pm', 'bell', 650)
typing(1100)
reply('Booked ✅ Saturday 4 pm with Dr Mehta. I will remind you Friday evening. See you!', 2.1, 3400)

// 2. a Hinglish product enquiry
reset({ name: 'Woodline Furniture', initial: 'W', hue: '#5fd3a3' })
out('2 seater sofa ka price kya hai?', 1300)
think('Intent: price enquiry · Hinglish', 'lang', 650)
think('Catalog → 3 two-seaters in stock', 'catalog', 800)
typing(1200)
reply('Teen fabric 2-seater stock mein hain, ₹18,900 se. Store visit ya delivery?', 3.2, 3000, {
  title: 'Oslo · fabric 2-seater',
  price: '₹18,900',
})
out('Delivery, Pune', 1200)
think('Pune: 4-6 days · free over ₹15k', 'order', 700)
think('Payment link → created', 'pay', 700)
typing(1000)
reply('Pune mein 4-6 din, delivery free 🎉 Pay link: rzp.io/woodline-oslo. Order confirm hote hi update bhejta hoon.', 2.4, 3400)

// 3. a complaint, handed to a human
reset({ name: 'Nova Mobiles', initial: 'N', hue: '#7aa7ff' })
out('My order #4821 came with a cracked screen 😞', 1300)
think('Intent: complaint · upset', 'lang', 650)
think('Order 4821: delivered, in warranty', 'order', 750)
think('Damage → replace + human handoff', 'hand', 750)
typing(1000)
reply('So sorry about that. Replacement approved, no charge. Bringing in Rohan from our team, he will call you in 10 minutes.', 3.6, 2400)
system('Rohan joined the chat', 2800)

const SCENE_ONE_END = SCRIPT.findIndex((s, i) => i > 0 && s.type === 'reset')

const INIT = { biz: null, msgs: [], thoughts: [], tool: null, typing: false, banner: null, buzz: 0, replied: null, seq: 1 }

function reduce(st, s) {
  const id = st.seq
  const next = { ...st, seq: id + 1 }
  switch (s.type) {
    case 'reset':
      return { ...INIT, biz: s.biz, seq: id + 1 }
    case 'out':
      return { ...next, msgs: [...st.msgs, { id, dir: 'out', text: s.text, status: 'sent' }], replied: null }
    case 'status': {
      const msgs = st.msgs.slice()
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].dir === 'out') {
          msgs[i] = { ...msgs[i], status: s.s }
          break
        }
      }
      return { ...st, msgs }
    }
    case 'think':
      return {
        ...next,
        thoughts: [...st.thoughts.map((t) => ({ ...t, state: 'done' })), { id, text: s.text, state: 'run' }].slice(-3),
        tool: s.tool ?? st.tool,
      }
    case 'typing':
      return { ...st, typing: true, thoughts: st.thoughts.map((t) => ({ ...t, state: 'done' })) }
    case 'in':
      return {
        ...next,
        typing: false,
        msgs: [...st.msgs, { id, dir: 'in', text: s.text, card: s.card }],
        banner: { id, title: st.biz?.name ?? 'WhatsApp', body: s.text },
        buzz: st.buzz + 1,
        replied: s.secs,
      }
    case 'banner-off':
      return { ...st, banner: null }
    case 'system':
      return { ...next, msgs: [...st.msgs, { id, dir: 'sys', text: s.text }] }
    default:
      return st
  }
}

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const STILL = SCRIPT.slice(0, SCENE_ONE_END).reduce((st, s) => reduce(st, s), INIT)

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="hs-wa-spin">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 18" strokeLinecap="round" />
    </svg>
  )
}
function Check() {
  return (
    <svg viewBox="0 0 16 16" className="hs-wa-check">
      <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Ticks({ status }) {
  return (
    <svg viewBox="0 0 18 12" className={`hs-wa-ticks is-${status}`}>
      <path d="M1.5 6.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {status !== 'sent' ? (
        <path d="M7.5 6.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </svg>
  )
}
function WaGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="hs-wa-glyph">
      <path
        d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.6 20.4l4.1-1.1A8.5 8.5 0 1 0 12 3.5z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.6c0 .5-.4 1.2-1.4 1.2-2.9 0-6.1-3.2-6.1-6.1 0-.5.1-1 0-1.4z" fill="#fff" />
    </svg>
  )
}

export default function WhatsAppAgent({ active }) {
  const hostRef = useRef(null)
  const listRef = useRef(null)
  const viewRef = useRef(null)
  const [st, setSt] = useState(reduced ? STILL : INIT)

  // scale the fixed-size stage to the card
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fit = () => host.style.setProperty('--s', (host.clientWidth / BASE_W).toFixed(4))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // run the script while the card is in front; restart from the top when it comes back
  useEffect(() => {
    if (!active || reduced) return
    let i = 0
    let timer = 0
    const run = () => {
      const s = SCRIPT[i]
      setSt((prev) => reduce(prev, s))
      i = (i + 1) % SCRIPT.length
      timer = setTimeout(run, s.wait)
    }
    timer = setTimeout(run, 350)
    return () => clearTimeout(timer)
  }, [active])

  // keep the newest message at the foot of the chat, sliding older ones up
  useLayoutEffect(() => {
    const list = listRef.current
    const view = viewRef.current
    if (!list || !view) return
    const y = Math.min(0, view.clientHeight - list.offsetHeight)
    list.style.transform = `translateY(${y}px)`
  }, [st.msgs, st.typing])

  // the phone buzzes once per reply: alternating two identical animations restarts it
  const buzz = st.buzz ? (st.buzz % 2 ? ' is-buzz-a' : ' is-buzz-b') : ''
  const biz = st.biz ?? STILL.biz
  return (
    <div ref={hostRef} className="hs-wa" aria-hidden="true">
      <div className="hs-wa-stage">
        {/* ---- backend: what the agent thinks and reaches for ---- */}
        <div className={`hs-wa-brain${st.typing ? ' is-sending' : ''}`}>
          <div className="hs-wa-brain-head">
            <i className="hs-wa-live" />
            <span>Ravan agent</span>
            {st.replied != null ? <b key={st.seq}>replied in {st.replied}s</b> : null}
          </div>
          <ul className="hs-wa-thoughts">
            {st.thoughts.map((t) => (
              <li key={t.id} className={`is-${t.state}`}>
                {t.state === 'run' ? <Spinner /> : <Check />}
                <span>{t.text}</span>
              </li>
            ))}
            {st.thoughts.length === 0 ? <li className="is-idle"><span>Listening on +91 98··· ·· 4321</span></li> : null}
          </ul>
          <div className="hs-wa-tools">
            {TOOLS.map((t) => (
              <i key={t.key} className={st.tool === t.key ? 'is-on' : ''}>
                {t.label}
              </i>
            ))}
          </div>
        </div>

        {/* ---- the phone ---- */}
        <div className={`hs-wa-phone${buzz}`}>
          <div className="hs-wa-screen">
            <div className="hs-wa-status">
              <span>10:41</span>
              <i className="hs-wa-island" />
              <span className="hs-wa-sig">
                <i />
                <i />
                <i />
                <b />
              </span>
            </div>
            <div className="hs-wa-header">
              <svg viewBox="0 0 12 20" className="hs-wa-back">
                <path d="M10 2L3 10l7 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hs-wa-avatar" style={{ background: biz?.hue }}>
                {biz?.initial}
              </span>
              <span className="hs-wa-who">
                <b>{biz?.name}</b>
                <small className={st.typing ? 'is-typing' : ''}>{st.typing ? 'typing…' : 'online'}</small>
              </span>
              <span className="hs-wa-more">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div ref={viewRef} className="hs-wa-chat">
              <div ref={listRef} className="hs-wa-msgs">
                <div className="hs-wa-day">Today</div>
                {st.msgs.map((m) =>
                  m.dir === 'sys' ? (
                    <div key={m.id} className="hs-wa-sys">
                      {m.text}
                    </div>
                  ) : (
                    <div key={m.id} className={`hs-wa-bubble is-${m.dir}`}>
                      {m.card ? (
                        <div className="hs-wa-card">
                          <div className="hs-wa-card-img">🛋️</div>
                          <div className="hs-wa-card-body">
                            <b>{m.card.title}</b>
                            <span>{m.card.price}</span>
                          </div>
                        </div>
                      ) : null}
                      <span className="hs-wa-text">{m.text}</span>
                      <span className="hs-wa-meta">
                        10:41
                        {m.dir === 'out' ? <Ticks status={m.status} /> : null}
                      </span>
                    </div>
                  ),
                )}
                {st.typing ? (
                  <div className="hs-wa-bubble is-in is-dots">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="hs-wa-input">
              <span>Message</span>
              <i />
            </div>
            <div className={`hs-wa-banner${st.banner ? ' is-in' : ''}`}>
              <span className="hs-wa-app">
                <WaGlyph />
              </span>
              <span className="hs-wa-banner-text">
                <b>
                  {st.banner?.title ?? biz?.name}
                  <em>now</em>
                </b>
                <small>{st.banner?.body}</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
