import { useCallback, useState } from 'react'
import { HEADS } from '../../data/heads.js'
import { openRavan } from '../../lib/ravan.js'
import CardStack from './CardStack.jsx'
import './head-stack.css'

/*
 * Homepage section 3: the ten heads as a tilted pile of cards that steps
 * through itself. Built from a reference recording (2026-09-13): sink, snap,
 * settle timing traced frame by frame; slots own tilt and z-order; the
 * middle card is always on top.
 */
export default function HeadStack() {
  const [front, setFront] = useState(0)
  const onFront = useCallback((f) => setFront(f), [])
  const head = HEADS[front]

  return (
    <section id="heads" className="hs-section">
      <div className="hs-head">
        <p className="hs-label">Ten heads. One retainer.</p>
        <p className="hs-hint">Tap a card to see the next head</p>
      </div>
      <CardStack heads={HEADS} onFront={onFront} />
      <div className="hs-hud">
        <button type="button" className="hs-pill" onClick={openRavan}>
          <span aria-hidden="true">↗</span> Ask about {head.short.toLowerCase()}
        </button>
      </div>
    </section>
  )
}
