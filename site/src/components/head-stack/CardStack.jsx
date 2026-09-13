import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import StackCard from './StackCard.jsx'
import StackBackdrop from './StackBackdrop.jsx'
import StackDots from './StackDots.jsx'
import { createStackMotion, lookAt } from './stackMotion.js'

const LIGHT = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1]

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
 * one card. The engine plays the traced sink/snap/settle for each step.
 * Transforms are written straight to the DOM; React re-renders only on a step.
 */
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
    stage.style.setProperty('--hs-cw', `${cw}px`)
    stage.style.setProperty('--hs-ch', `${ch}px`)
    geom.current = { cw, pitch, vh: window.innerHeight }
    const rowEl = bdRef.current?.firstElementChild
    const row = rowEl ? rowEl.getBoundingClientRect().height : 80
    if (bdRef.current) {
      const total = row * bdRef.current.childElementCount
      bdRef.current.style.marginTop = `${-(total - stage.clientHeight) / 2}px`
    }
    engineRef.current?.setGeometry({ pitch, row })
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
    const dist = (i, j) => Math.abs(i - j)
    let lastIntro = -1

    const engine = createStackMotion({
      count: N,
      reduced,
      onFront: (f) => {
        setFront(f)
        onFront?.(f)
      },
      onFrame: (s) => {
        const { cw, pitch, vh } = geom.current

        // ---- read the scroll: how far the wrapper has gone past the top
        const wrap = wrapRef?.current
        const y = wrap ? Math.max(0, -wrap.getBoundingClientRect().top) : 0
        const introPx = (INTRO_VH / 100) * vh
        const stepPx = (STEP_VH / 100) * vh
        const intro = easeInOut(Math.min(1, y / introPx))
        engine.setTarget(Math.round(Math.max(0, y - introPx) / stepPx))

        // ---- intro: pile rises from its peek, wordmark fades in
        if (pileRef.current) pileRef.current.style.transform = `translateY(${(PEEK_VH / 100) * vh * (1 - intro)}px)`
        if (bdRef.current) {
          bdRef.current.style.transform = `translateY(${s.bgY}px)`
          bdRef.current.style.opacity = intro.toFixed(3)
        }
        if (intro !== lastIntro) {
          lastIntro = intro
          onIntro?.(intro)
        }

        // ---- cards
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const r = i - s.active
          if (Math.abs(r) > 3) {
            el.style.visibility = 'hidden'
            return
          }
          el.style.visibility = 'visible'
          const slot = r - s.progress
          const look = lookAt(slot)
          el.style.transform = `translate(${(look.x / 100) * cw}px, ${slot * pitch}px) rotate(${look.tilt + s.colRot}deg)`
          el.style.zIndex = N - dist(i, s.front)
        })
      },
    })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__hsEngine = engine
    engine.setGeometry(geom.current)
    engine.start()
    return () => engine.stop()
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
          />
        ))}
      </div>
      <StackDots count={N} current={front} />
    </div>
  )
}
