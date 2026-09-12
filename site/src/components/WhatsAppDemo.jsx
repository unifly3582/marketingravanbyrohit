import { useEffect, useRef, useState } from 'react'

/*
 * The WhatsApp agent, as a phone inside the panel.
 *
 * The visitor plays the customer of a sample business and taps replies; the
 * "agent" answers the way ours does for a client — books, quotes, holds a
 * slot, sends a link. It is scripted on purpose: it costs nothing, it works
 * before any session opens, it never hallucinates a price for a business that
 * does not exist, and it finishes in four taps. The live agent (Ravan, in the
 * panel around this) is where the real intelligence is; this is the shape of
 * what the customer sees.
 *
 * Prices and timings here belong to the fictional businesses, not to us.
 */

const BUSINESSES = [
  {
    key: 'dental',
    name: 'Smile Dental, Andheri',
    initial: 'S',
    opening: 'Hi! Smile Dental here. Are you looking to book a visit, or ask about a treatment?',
    replies: [
      {
        q: 'Book a cleaning',
        a: 'Sure. We have Thursday 11 am and Saturday 4 pm free this week. Which suits you?',
        next: [
          { q: 'Saturday 4 pm', a: 'Booked: Saturday 4 pm, cleaning with Dr Mehta. I will send a reminder Friday evening. Anything else?', event: 'Booked a slot' },
          { q: 'Thursday 11 am', a: 'Booked: Thursday 11 am, cleaning with Dr Mehta. Reminder coming Wednesday evening. Anything else?', event: 'Booked a slot' },
        ],
      },
      {
        q: 'How much is a root canal?',
        a: 'A single-sitting root canal here is ₹4,500. The crown is priced after the doctor sees the tooth. Want a consultation first?',
        next: [
          { q: 'Yes, book a consult', a: 'Done: Thursday 11 am with Dr Mehta, no charge for the first consult. Reminder the evening before.', event: 'Booked a consult' },
          { q: 'Do you take insurance?', a: 'Yes, cashless with Star, HDFC Ergo and ICICI Lombard; others on reimbursement. I can hold Thursday 11 am for you?', event: 'Answered from the playbook' },
        ],
      },
      {
        q: 'Kya aap Sunday open hain?',
        a: 'Sunday band rehta hai. Saturday 10 se 6 tak, last slot 5:30 ka. Ek slot hold kar doon?',
        next: [
          { q: 'Haan, 5:30 hold karo', a: 'Ho gaya: Saturday 5:30 pm, aapke number pe hold hai. Plan badle toh yahin reply kar dena.', event: 'Held a slot, in Hinglish' },
        ],
      },
    ],
  },
  {
    key: 'furniture',
    name: 'Woodline Furniture',
    initial: 'W',
    opening: 'Hello! Woodline here. Looking for something specific, or want to see what is new this week?',
    replies: [
      {
        q: 'Sofa for a small flat',
        a: 'For a small living room our two-seaters around 150 cm work best. Fabric or leather?',
        next: [
          { q: 'Fabric', a: 'Three fabric two-seaters are in stock today, from ₹18,900. Photos of all three sent above. Visit the store, or order delivery?', event: 'Sent the catalogue' },
          { q: 'Leather', a: 'Two leather two-seaters in stock, from ₹34,500, both with a five-year warranty. Photos sent. Visit, or delivery?', event: 'Sent the catalogue' },
        ],
      },
      {
        q: 'Delivery to Pune?',
        a: 'Yes. Pune delivery takes four to six days and is free above ₹15,000. Which item are you looking at?',
        next: [
          { q: 'The oak dining table', a: 'The oak six-seater is in stock. Free delivery to Pune, assembled at your home. Reserved under your number for 48 hours.', event: 'Reserved an item' },
        ],
      },
    ],
  },
  {
    key: 'coaching',
    name: 'Aarambh Academy',
    initial: 'A',
    opening: 'Hi! Aarambh Academy here. Which course are you asking about, and for which exam?',
    replies: [
      {
        q: 'NEET batch timings',
        a: 'Our NEET 2027 batch runs Monday to Saturday, 7 to 9:30 am, with a test every Sunday. Class 11 or 12?',
        next: [
          { q: 'Class 12', a: 'Class 12 batch starts 6 October: 40 seats, 22 left. A free demo class is this Saturday. Booked you in; details sent above.', event: 'Booked a demo class' },
          { q: 'Class 11', a: 'Class 11 batch starts 13 October. Free demo this Saturday at 9 am. Booked you in; the address is above.', event: 'Booked a demo class' },
        ],
      },
      {
        q: 'JEE fees?',
        a: 'The JEE two-year programme is ₹1,20,000, in four instalments, with a scholarship test on the 15th. Want the syllabus and the test link?',
        next: [
          { q: 'Send the test link', a: 'Sent. The scholarship test link and syllabus are above. Results in 48 hours, and I will message you the outcome here.', event: 'Sent the test link' },
        ],
      },
    ],
  },
]

/**
 * @param {object} props
 * @param {(text: string) => void} props.onEvent   something the demo agent "did", for the trail
 * @param {() => void} props.onTalk                the visitor wants to talk to Ravan about it
 * @param {() => void} props.onWhatsApp            the visitor wants the real thing on their own WhatsApp
 * @param {() => void} props.onBack
 */
export default function WhatsAppDemo({ onEvent, onTalk, onWhatsApp, onBack }) {
  const [biz, setBiz] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [options, setOptions] = useState([])
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const chatRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing, options])

  function choose(b) {
    setBiz(b)
    setMsgs([{ id: 1, dir: 'in', text: b.opening }])
    setOptions(b.replies)
    setDone(false)
  }

  function reply(o) {
    setOptions([])
    setMsgs((m) => [...m, { id: m.length + 1, dir: 'out', text: o.q }])
    setTyping(true)
    timer.current = setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { id: m.length + 1, dir: 'in', text: o.a }])
      if (o.event) onEvent(o.event)
      if (o.next) setOptions(o.next)
      else {
        onEvent('Saved the lead')
        setDone(true)
      }
    }, 750)
  }

  if (!biz) {
    return (
      <div className="space-y-3">
        <BackLink onClick={onBack} />
        <div>
          <h3 className="font-display text-lg leading-tight font-bold text-balance">Pick a business</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">You play the customer. The agent answers the way it would for them.</p>
        </div>
        <div className="grid gap-2">
          {BUSINESSES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => choose(b)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left transition-colors hover:border-gold/60 hover:bg-gold/5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold to-ember font-display text-xs font-extrabold text-[#1a0d05]">
                {b.initial}
              </span>
              <span className="text-xs font-semibold text-cream">{b.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <BackLink onClick={onBack} />
        <button type="button" onClick={() => setBiz(null)} className="text-[0.66rem] font-semibold text-muted hover:text-cream">
          Another business
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line" style={{ background: '#0b141a' }}>
        <div className="flex items-center gap-2.5 px-3 py-2" style={{ background: '#1f2c34' }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold to-ember font-display text-[0.7rem] font-extrabold text-[#1a0d05]">
            {biz.initial}
          </span>
          <span className="leading-tight">
            <span className="block text-xs font-semibold" style={{ color: '#e9edef' }}>{biz.name}</span>
            <span className="block text-[0.6rem]" style={{ color: '#8696a0' }}>Business account · replies instantly</span>
          </span>
        </div>

        <div ref={chatRef} className="grid max-h-56 gap-1.5 overflow-y-auto p-2.5">
          {msgs.map((m) => (
            <Bubble key={m.id} dir={m.dir} text={m.text} />
          ))}
          {typing && (
            <div className="justify-self-start rounded-lg rounded-tl-sm px-3 py-2" style={{ background: '#202c33' }}>
              <span className="inline-flex gap-1">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#8696a0' }} />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" style={{ background: '#8696a0' }} />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" style={{ background: '#8696a0' }} />
              </span>
            </div>
          )}
        </div>

        {options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-1 pb-2.5">
            {options.map((o) => (
              <button
                key={o.q}
                type="button"
                onClick={() => reply(o)}
                className="rounded-full border px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors"
                style={{ background: '#1f2c34', borderColor: '#2a3942', color: '#53bdeb' }}
              >
                {o.q}
              </button>
            ))}
          </div>
        )}
      </div>

      {done && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-cream">
            That is the same agent, on your number, in your customer&apos;s language, at 2 am. Want it for your business?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={onTalk} className="btn-primary !py-2 !px-4 text-xs">
              Talk to Ravan about it
            </button>
            <button
              type="button"
              onClick={onWhatsApp}
              className="rounded-full border border-emerald-500/40 bg-card px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-emerald-500/10"
            >
              Try it on my WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Bubble({ dir, text }) {
  const out = dir === 'out'
  return (
    <div
      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[0.74rem] leading-snug ${
        out ? 'justify-self-end rounded-tr-sm' : 'justify-self-start rounded-tl-sm'
      }`}
      style={{ background: out ? '#005c4b' : '#202c33', color: '#e9edef' }}
    >
      {text}
      <span className="mt-0.5 block text-right text-[0.55rem]" style={{ color: '#8696a0' }}>
        10:42{out && <span style={{ color: '#53bdeb' }}> ✓✓</span>}
      </span>
    </div>
  )
}

function BackLink({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-[0.66rem] font-semibold text-muted hover:text-cream">
      ← All options
    </button>
  )
}
