import { useEffect, useRef, useState } from 'react'
import { HEADS } from '../../data/heads.js'
import './alien-ticker.css'

/*
 * The phone stand-in for the statement line: an alien-tech readout that
 * decodes the name of one head at a time. Every letter starts as a random
 * glyph and locks into place on its own frame, the line holds, then the next
 * service scrambles in. The metric under it swaps with each name. Runs only
 * while on screen and the tab is visible; reduced motion just swaps the text.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&<>/|=+*'
const TICK_MS = 45 // one scramble frame
const DECODE_STEPS = 16 // frames until the last letter locks
const HOLD_MS = 1700 // a decoded name holds this long

const rnd = (n) => Math.floor(Math.random() * n)
const glyph = () => GLYPHS[rnd(GLYPHS.length)]

export default function AlienTicker() {
  const rootRef = useRef(null)
  const wordRef = useRef(null)
  const [i, setI] = useState(0)
  const [seen, setSeen] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const n = HEADS.length
  const head = HEADS[i % n]

  // only tick while the readout is on screen and the tab is visible
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // start at once if already in view (the observer's first report can
    // lag a frame); the observer takes over from there
    const r = el.getBoundingClientRect()
    setSeen(r.bottom > 0 && r.top < innerHeight)
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const el = wordRef.current
    if (!el) return
    const target = head.short
    if (reduced) {
      el.textContent = target
      if (!seen || hidden) return
      const t = setTimeout(() => setI((v) => v + 1), HOLD_MS + 1300)
      return () => clearTimeout(t)
    }
    if (!seen || hidden) return
    // each letter locks on its own frame; spaces and & stay put
    const locks = [...target].map((c) => (c === ' ' ? 0 : 2 + rnd(DECODE_STEPS - 2)))
    let f = 0
    let hold
    const id = setInterval(() => {
      f += 1
      el.textContent = [...target].map((c, j) => (f >= locks[j] ? c : glyph())).join('')
      if (f >= DECODE_STEPS) {
        clearInterval(id)
        el.textContent = target
        hold = setTimeout(() => setI((v) => v + 1), HOLD_MS)
      }
    }, TICK_MS)
    return () => {
      clearInterval(id)
      clearTimeout(hold)
    }
  }, [i, seen, hidden, reduced, head.short])

  return (
    <div ref={rootRef} className="at-root">
      <p className="at-kicker" aria-hidden="true">
        <span className="at-dot" /> ten heads // what we do
      </p>
      <h2 className="at-word">
        <span className="sr-only">What we do: {HEADS.map((h) => h.short.toLowerCase()).join(', ')}.</span>
        <span ref={wordRef} aria-hidden="true" />
      </h2>
      <p key={i} className="at-sub" aria-hidden="true">
        {String(head.n).padStart(2, '0')} / {head.metric}
      </p>
      <div className="at-scan" aria-hidden="true" />
    </div>
  )
}
