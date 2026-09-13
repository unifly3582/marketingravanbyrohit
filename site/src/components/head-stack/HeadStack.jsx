import { useCallback, useRef, useState } from 'react'
import { HEADS } from '../../data/heads.js'
import { openRavan } from '../../lib/ravan.js'
import Statement from '../Statement.jsx'
import CardStack, { INTRO_VH, STEP_VH, TAIL_VH } from './CardStack.jsx'
import './head-stack.css'

/*
 * Sections 2 + 3 fused into one pinned block. A tall wrapper scrolls; inside
 * it a sticky, viewport-high stage holds the statement line on top and the
 * pile of ten head cards peeking below. Scrolling first lifts the statement
 * away while the pile rises into place, then steps the pile one card per
 * STEP_VH of scroll with the traced sink/snap/settle. Nothing moves on its
 * own: the visitor's thumb drives every step.
 */
export default function HeadStack() {
  const wrapRef = useRef(null)
  const stmtRef = useRef(null)
  const hudRef = useRef(null)
  const [front, setFront] = useState(0)
  const onFront = useCallback((f) => setFront(f), [])
  const onIntro = useCallback((e) => {
    // statement lifts, blurs and fades; the pill only exists once the pile is in place
    if (stmtRef.current) {
      stmtRef.current.style.transform = `translateY(${-e * 28}vh)`
      stmtRef.current.style.opacity = (1 - e).toFixed(3)
      stmtRef.current.style.filter = e > 0 ? `blur(${(e * 6).toFixed(1)}px)` : 'none'
      stmtRef.current.style.pointerEvents = e > 0.5 ? 'none' : ''
    }
    if (hudRef.current) {
      hudRef.current.style.opacity = e.toFixed(3)
      hudRef.current.style.pointerEvents = e > 0.6 ? '' : 'none'
    }
  }, [])
  const head = HEADS[front]
  const height = `calc(100svh + ${INTRO_VH + STEP_VH * (HEADS.length - 1) + TAIL_VH}vh)`

  return (
    <section id="heads" ref={wrapRef} className="hs-wrap" style={{ height }}>
      {/* scroll-snap targets: pin start, then one per card. Positioned by CardStack. */}
      {Array.from({ length: HEADS.length + 1 }, (_, i) => (
        <i key={i} className="hs-snap" aria-hidden="true" />
      ))}
      <div className="hs-section">
        <div ref={stmtRef} className="hs-statement">
          <Statement trigger={wrapRef} />
        </div>
        <CardStack heads={HEADS} wrapRef={wrapRef} onFront={onFront} onIntro={onIntro} />
        <div ref={hudRef} className="hs-hud" style={{ opacity: 0, pointerEvents: 'none' }}>
          <button type="button" className="hs-pill" onClick={openRavan}>
            <span aria-hidden="true">↗</span> Ask about {head.short.toLowerCase()}
          </button>
        </div>
      </div>
    </section>
  )
}
