import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import StackCard from './StackCard.jsx'
import StackBackdrop from './StackBackdrop.jsx'
import StackDots from './StackDots.jsx'
import { createStackMotion, lookAt } from './stackMotion.js'

const LIGHT = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1]

/*
 * Lays the cards in a column and drives them from the motion engine.
 * Geometry: card width is a share of the stage width (85% on phones), cards
 * are spaced 1.09 card-heights apart, so three show at once. Transforms are
 * written directly to the DOM every frame; React only re-renders on a step.
 */
export default function CardStack({ heads, cardShare = 0.85, maxCardWidth = 420, onFront }) {
  const stageRef = useRef(null)
  const bdRef = useRef(null)
  const cardRefs = useRef([])
  const engineRef = useRef(null)
  const geom = useRef({ cw: 0, pitch: 0 })
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
    geom.current = { cw, pitch }
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
    const rel = (i, active) => {
      let r = i - active
      if (r > N / 2) r -= N
      if (r < -N / 2) r += N
      return r
    }
    const dist = (i, j) => Math.min(Math.abs(i - j), N - Math.abs(i - j))

    const engine = createStackMotion({
      count: N,
      reduced,
      onFront: (f) => {
        setFront(f)
        onFront?.(f)
      },
      onFrame: (s) => {
        const { cw, pitch } = geom.current
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const r = rel(i, s.active)
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
        if (bdRef.current) bdRef.current.style.transform = `translateY(${s.bgY}px)`
      },
    })
    engineRef.current = engine
    engine.setGeometry(geom.current)
    engine.start()

    // only run while on screen; a hidden pile burns battery for nothing
    const io = new IntersectionObserver(([e]) => engine.setAuto(e.isIntersecting), { threshold: 0.35 })
    if (stageRef.current) io.observe(stageRef.current)
    const onVis = () => engine.resetClock()
    document.addEventListener('visibilitychange', onVis)

    return () => {
      engine.stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [N, onFront])

  // touch: hold pauses the timer, a tap or a short vertical flick steps it.
  // Page scrolling stays native (touch-action: pan-y), so a long swipe scrolls.
  const press = useRef(null)
  const onPointerDown = (e) => {
    press.current = { y: e.clientY, t: performance.now() }
    engineRef.current?.setPaused(true)
  }
  const onPointerUp = (e) => {
    const p = press.current
    press.current = null
    engineRef.current?.setPaused(false)
    if (!p) return
    const dy = e.clientY - p.y
    const dt = performance.now() - p.t
    if (Math.abs(dy) < 12 && dt < 400) engineRef.current?.begin(1)
    else if (dt < 350 && dy < -40) engineRef.current?.begin(1)
    else if (dt < 350 && dy > 40) engineRef.current?.begin(-1)
  }
  const onPointerCancel = () => {
    press.current = null
    engineRef.current?.setPaused(false)
  }

  return (
    <div
      ref={stageRef}
      className="hs-stage"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') engineRef.current?.begin(1)
        if (e.key === 'ArrowDown') engineRef.current?.begin(-1)
      }}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="The ten heads"
    >
      <StackBackdrop ref={bdRef} />
      <div className="hs-pile">
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
