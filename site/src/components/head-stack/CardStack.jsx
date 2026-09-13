import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import StackCard from './StackCard.jsx'
import StackBackdrop from './StackBackdrop.jsx'
import StackDots from './StackDots.jsx'
import WebShowcase from './WebShowcase.jsx'
import AdsShowcase from './AdsShowcase.jsx'
import { createStackMotion, lookAt } from './stackMotion.js'

const LIGHT = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1]
/* live piece per head, keyed by the head's icon; cards without one show text only */
const VISUAL = { uiux: WebShowcase, ads: AdsShowcase }

/* scroll budget, in viewport heights. The owner sizes its wrapper with these. */
export const INTRO_VH = 60 // statement lifts away, pile rises into place
export const STEP_VH = 48 // scroll distance per card
export const TAIL_VH = 40 // rest on the last card before the block scrolls away
const PEEK_VH = 44 // where the pile waits during the intro (below centre)

const easeInOut = (u) => -(Math.cos(Math.PI * u) - 1) / 2

/*
 * Lays the cards in a column and drives them from the page scroll.
 * `wrapRef` is the tall wrapper the sticky stage lives in; how far it has
 * scrolled past the top of the viewport decides everything: the first
 * INTRO_VH move the pile up from its peek position, then every STEP_VH is
 * one card. The pile follows the scroll through the spring in stackMotion,
 * so it moves with the thumb. Landing on a card is done here, not with CSS
 * scroll-snap: once the finger is up and the scroll has been quiet for a
 * moment, the page eases to the nearest card. CSS snap on the root was
 * uneven going back up on phones, where the address bar reappearing
 * resizes the viewport and makes the browser re-snap mid-gesture.
 * Transforms are written straight to the DOM; React re-renders only when the
 * middle card changes.
 */
const QUIET_MS = 140 // no scroll change for this long, finger up: land
const easeOutCubic = (u) => 1 - (1 - u) ** 3
export default function CardStack({ heads, wrapRef, cardShare = 0.85, maxCardWidth = 420, onFront, onIntro }) {
  const stageRef = useRef(null)
  const pileRef = useRef(null)
  const bdRef = useRef(null)
  const cardRefs = useRef([])
  const engineRef = useRef(null)
  const geom = useRef({ cw: 0, pitch: 0, vh: 800 })
  const [front, setFront] = useState(0)
  const N = heads.length

  const measure = () => {
    const stage = stageRef.current
    if (!stage) return
    const cw = Math.min(maxCardWidth, Math.round(stage.clientWidth * cardShare))
    const ch = Math.round(cw / 1.32)
    const pitch = Math.round(ch * 1.09)
    const vh = window.innerHeight
    stage.style.setProperty('--hs-cw', `${cw}px`)
    stage.style.setProperty('--hs-ch', `${ch}px`)
    geom.current = { cw, pitch, vh }
    const rowEl = bdRef.current?.firstElementChild
    const row = rowEl ? rowEl.getBoundingClientRect().height : 80
    if (bdRef.current) {
      const total = row * bdRef.current.childElementCount
      bdRef.current.style.marginTop = `${-(total - stage.clientHeight) / 2}px`
    }
    engineRef.current?.setGeometry({ row })
  }

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardShare, maxCardWidth])

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastIntro = -1

    // ---- landing: ease the page to the nearest card once the scroll is quiet
    let touching = false
    let lastY = window.scrollY
    let lastChange = performance.now()
    let landing = null // { from, to, t0, dur }
    const cancelLanding = () => {
      landing = null
    }
    const onTouchStart = () => {
      touching = true
      cancelLanding()
    }
    const onTouchEnd = () => {
      touching = false
      lastChange = performance.now()
    }
    const onWheel = () => {
      cancelLanding()
      lastChange = performance.now()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onWheel)

    const land = (now) => {
      const { vh } = geom.current
      const wrap = wrapRef?.current
      if (!wrap) return
      const y = -wrap.getBoundingClientRect().top
      const introPx = (INTRO_VH / 100) * vh
      const stepPx = (STEP_VH / 100) * vh
      const lastPx = introPx + (N - 1) * stepPx
      // only inside the card range; leaving the block upward or downward stays free
      if (y < introPx - 0.35 * stepPx || y > lastPx + 0.5 * stepPx) return
      const k = Math.max(0, Math.min(N - 1, Math.round((y - introPx) / stepPx)))
      const dy = introPx + k * stepPx - y
      if (Math.abs(dy) < 1) return
      landing = { from: window.scrollY, to: window.scrollY + dy, t0: now, dur: Math.min(650, 260 + Math.abs(dy) * 0.7) }
    }

    const readScroll = () => {
      const now = performance.now()
      const sy = window.scrollY
      if (landing) {
        const u = Math.min(1, (now - landing.t0) / landing.dur)
        window.scrollTo({ top: landing.from + (landing.to - landing.from) * easeOutCubic(u), behavior: 'instant' })
        if (u >= 1) landing = null
        lastY = window.scrollY
        lastChange = now
      } else if (sy !== lastY) {
        lastY = sy
        lastChange = now
      } else if (!touching && now - lastChange > QUIET_MS) {
        land(now)
        lastChange = now
      }

      const { vh } = geom.current
      const wrap = wrapRef?.current
      const y = wrap ? Math.max(0, -wrap.getBoundingClientRect().top) : 0
      const introPx = (INTRO_VH / 100) * vh
      const stepPx = (STEP_VH / 100) * vh
      const intro = easeInOut(Math.min(1, y / introPx))
      if (intro !== lastIntro) {
        lastIntro = intro
        if (pileRef.current) pileRef.current.style.transform = `translateY(${(PEEK_VH / 100) * vh * (1 - intro)}px)`
        if (bdRef.current) bdRef.current.style.opacity = intro.toFixed(3)
        onIntro?.(intro)
      }
      return Math.max(0, y - introPx) / stepPx
    }

    const engine = createStackMotion({
      count: N,
      reduced,
      readScroll,
      onFront: (f) => {
        setFront(f)
        onFront?.(f)
      },
      onFrame: (s) => {
        const { cw, pitch } = geom.current
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const slot = i - s.p
          if (Math.abs(slot) > 3.2) {
            el.style.visibility = 'hidden'
            return
          }
          el.style.visibility = 'visible'
          const look = lookAt(slot)
          el.style.transform = `translate(${(look.x / 100) * cw}px, ${slot * pitch}px) rotate(${look.tilt + s.lean}deg)`
          el.style.zIndex = N - Math.abs(i - s.front)
        })
        if (bdRef.current) bdRef.current.style.transform = `translateY(${s.bgY}px)`
      },
    })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__hsEngine = engine
    engine.start()
    return () => {
      engine.stop()
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onWheel)
    }
  }, [N, onFront, onIntro, wrapRef])

  return (
    <div ref={stageRef} className="hs-stage" aria-roledescription="carousel" aria-label="The ten heads">
      <StackBackdrop ref={bdRef} />
      <div ref={pileRef} className="hs-pile">
        {heads.map((h, i) => (
          <StackCard
            key={h.n}
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            head={h}
            light={!!LIGHT[i % LIGHT.length]}
            hidden={i !== front}
            visual={VISUAL[h.icon] ? (() => { const V = VISUAL[h.icon]; return <V active={i === front} /> })() : null}
          />
        ))}
      </div>
      <StackDots count={N} current={front} />
    </div>
  )
}
