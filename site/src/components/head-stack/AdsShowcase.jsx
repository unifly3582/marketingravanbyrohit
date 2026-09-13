import { useEffect, useRef, useState } from 'react'

/*
 * The Meta Ads card's visual: a pocket ads dashboard the AI is working on.
 * ROAS counts up while eight weekly bars grow to meet it, and a log line
 * ticks through what the AI just did. Loops every 7.5s while the card is in
 * the middle of the pile; elsewhere it sits at the finished state.
 */
const FROM = 1.4
const TO = 3.6
const WEEKS = [1.3, 1.5, 1.4, 1.9, 2.3, 2.8, 3.2, 3.6] // ROAS by week, ends at TO
const LOOP_MS = 7500
const GROW_MS = 3600 // numbers and bars reach their end values
const LOG = [
  'Paused 3 ad sets with CPA above ₹420',
  'Scaled the winning creative +40%',
  'Launched 6 new creative variants',
  'Retargeting 2,140 warm visitors',
]
const LOG_MS = LOOP_MS / LOG.length

const easeOut = (u) => 1 - (1 - u) ** 3
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function AdsShowcase({ active }) {
  const numRef = useRef(null)
  const deltaRef = useRef(null)
  const barRefs = useRef([])
  const [logI, setLogI] = useState(0)

  useEffect(() => {
    const paint = (u) => {
      // u: 0..1 progress of the grow phase
      const roas = FROM + (TO - FROM) * easeOut(u)
      if (numRef.current) numRef.current.textContent = `${roas.toFixed(1)}x`
      if (deltaRef.current) deltaRef.current.textContent = `+${Math.round(((roas - FROM) / FROM) * 100)}%`
      barRefs.current.forEach((el, i) => {
        if (!el) return
        // bars rise one after another across the grow phase
        const start = i / WEEKS.length
        const bu = Math.max(0, Math.min(1, (u - start * 0.85) / 0.3))
        el.style.transform = `scaleY(${(WEEKS[i] / TO) * easeOut(bu)})`
      })
    }
    if (!active || reduced) {
      paint(1)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const t = (now - t0) % LOOP_MS
      paint(Math.min(1, t / GROW_MS))
      setLogI(Math.floor(t / LOG_MS) % LOG.length)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  const line = active && !reduced ? logI : LOG.length - 1
  return (
    <div className="hs-ads" aria-hidden="true">
      <div className="hs-ads-stat">
        <span className="hs-ads-label">ROAS · last 8 weeks</span>
        <span className="hs-ads-num" ref={numRef}>
          {TO.toFixed(1)}x
        </span>
        <span className="hs-ads-delta" ref={deltaRef}>
          +157%
        </span>
      </div>
      <div className="hs-ads-bars">
        {WEEKS.map((w, i) => (
          <i
            key={i}
            ref={(el) => {
              barRefs.current[i] = el
            }}
            className={i === WEEKS.length - 1 ? 'is-last' : undefined}
            style={{ transform: `scaleY(${w / TO})` }}
          />
        ))}
      </div>
      <div className="hs-ads-log">
        <b>AI</b>
        <span key={line} className="hs-ads-line">
          {LOG[line]}
        </span>
      </div>
    </div>
  )
}
