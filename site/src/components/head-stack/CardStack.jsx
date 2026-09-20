import { Suspense, lazy, startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react'
import StackCard from './StackCard.jsx'
import StackBackdrop from './StackBackdrop.jsx'
import StackDots from './StackDots.jsx'
import PosterArt from './PosterArt.jsx'
import WebsiteShowcase from './WebsiteShowcase.jsx'
import MetaAdsShowcase from './MetaAdsShowcase.jsx'

const WhatsAppAgent = lazy(() => import('./WhatsAppAgent.jsx'))
const VoiceCall = lazy(() => import('./VoiceCall.jsx'))
import { createStackMotion, lookAt } from './stackMotion.js'

const LIGHT = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1]
/* live piece per head, keyed by the head's icon; a head without one (the
   website card, for now) is a plain text card. Story cards (WhatsApp,
   calling) run a loop while at the front; poster cards animate a small
   illustration. */
const poster = (kind) => (props) => <PosterArt {...props} kind={kind} />
const VISUAL = {
  uiux: WebsiteShowcase,
  ads: MetaAdsShowcase,
  social: poster('social'),
  campaign: poster('campaign'),
  ecom: poster('ecom'),
  erp: poster('erp'),
  agent: poster('agent'),
  geo: poster('geo'),
  voice: (props) => (
    <Suspense fallback={<div className="vc" />}>
      <VoiceCall {...props} />
    </Suspense>
  ),
  sdr: (props) => (
    <Suspense fallback={<div className="hs-wa" />}>
      <WhatsAppAgent {...props} />
    </Suspense>
  ),
}
/* cards whose visual sets the whole card's look (they are never 'light') */
const SKIN = {
  uiux: 'is-website is-light',
  ads: 'is-meta-ads',
  voice: 'is-voice',
  sdr: 'is-wa',
  // poster cards (PosterArt + poster.css): accent tone per head, light/dark kept alternating
  social: 'is-poster tone-social',
  campaign: 'is-poster tone-campaign is-light',
  ecom: 'is-poster tone-ecom',
  erp: 'is-poster tone-erp is-light',
  agent: 'is-poster tone-agent',
  geo: 'is-poster tone-geo is-light',
}

/* scroll budget, in viewport heights (stackBudget.js). The owner sizes its wrapper with these. */
import { INTRO_VH, STEP_VH, TAIL_VH } from './stackBudget.js'
export { INTRO_VH, STEP_VH, TAIL_VH }
const PEEK_VH = 44 // where the pile waits during the intro (below centre)
/* the fan (1024px up): cards sit on an arc around a pivot far below the
   stage, FAN_DEG apart, with the pivot FAN_RADIUS card-widths down */
const FAN_DEG = 12
const FAN_RADIUS = 3

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
export default function CardStack({ heads, wrapRef, cardShare = 0.85, maxCardWidth = 420, fanCardWidth = 440, onFront, onIntro }) {
  const stageRef = useRef(null)
  const pileRef = useRef(null)
  const bdRef = useRef(null)
  const cardRefs = useRef([])
  const engineRef = useRef(null)
  const geom = useRef({ cw: 0, pitch: 0, vh: 800 })
  const dirty = useRef(true) // layout changed: re-measure where the wrapper sits
  const [front, setFront] = useState(0)
  // The live pieces (the two story cards and the two showcases) are the
  // heaviest DOM on the page and sit below the fold, behind a scroll. They
  // mount in a transition on the visitor's first scroll, touch or key (long
  // before a card can be in view), so the first screen never waits on them.
  const [withVisuals, setWithVisuals] = useState(false)
  useEffect(() => {
    let done = false
    const go = () => {
      if (done) return
      done = true
      startTransition(() => setWithVisuals(true))
    }
    const opts = { passive: true, once: true }
    window.addEventListener('scroll', go, opts)
    window.addEventListener('pointerdown', go, opts)
    window.addEventListener('touchstart', go, opts)
    window.addEventListener('keydown', go, opts)
    const timer = setTimeout(go, 12000)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', go)
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('touchstart', go)
      window.removeEventListener('keydown', go)
    }
  }, [])
  const N = heads.length

  // Geometry is computed from the viewport rather than read back from the
  // DOM: this runs inside React's commit, and reading a size there forces a
  // full page layout in the middle of the commit task. The stage is the
  // viewport width on phones and 480px from md up (head-stack.css); the
  // backdrop row is its line-height times its font-size.
  const measure = () => {
    const stage = stageRef.current
    if (!stage) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const wide = vw >= 768
    // 1024 up the cards fan across the full width (head-stack.css), sized
    // from the height so the heading above and below the fan keeps its room
    const fan = vw >= 1024
    const stageW = fan ? vw : wide ? 480 : vw
    const cw = fan
      ? Math.min(fanCardWidth, Math.round(vh * 0.6), Math.round(vw * 0.3))
      : Math.min(maxCardWidth, Math.round(stageW * cardShare))
    const ch = Math.round(cw / 1.32)
    const pitch = Math.round(ch * 1.09)
    stage.style.setProperty('--hs-cw', `${cw}px`)
    stage.style.setProperty('--hs-ch', `${ch}px`)
    // the visuals are drawn at a fixed stage size and scaled to the card's
    // inner width (cw minus the 1px borders); one write here instead of a
    // measuring layout effect in every visual
    for (const w of [320, 408, 420]) stage.style.setProperty(`--hs-s${w}`, ((cw - 2) / w).toFixed(4))
    geom.current = { cw, pitch, vh, fan }
    dirty.current = true
    const row = 0.86 * (fan ? Math.min(0.11 * vw, 160) : wide ? 96 : Math.min(0.19 * vw, 128))
    if (bdRef.current) {
      const total = row * bdRef.current.childElementCount
      bdRef.current.style.marginTop = `${-(total - vh) / 2}px`
    }
    engineRef.current?.setGeometry({ row })
  }

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardShare, maxCardWidth, fanCardWidth])

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastIntro = -1

    // ---- landing: ease the page to the nearest card once the scroll is quiet
    let touching = false
    let lastY = -1 // read in the first frame, not here (that would force a layout mid-commit)
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
      const y = cachedY
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

    // Where the wrapper sits is read from layout only when the scroll
    // position or the layout has changed. Reading it every frame forced a
    // full page layout per frame (the frame before had just written ten
    // transforms), which kept the main thread busy while nothing moved.
    let cachedY = 0
    const onResize = () => { dirty.current = true }
    window.addEventListener('resize', onResize)
    const readScroll = () => {
      const now = performance.now()
      const sy = window.scrollY
      if (sy !== lastY || dirty.current) {
        const wrap = wrapRef?.current
        cachedY = wrap ? Math.max(0, -wrap.getBoundingClientRect().top) : 0
        dirty.current = false
      }
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
      const y = cachedY
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

    let lastFrame = { p: -1, lean: 0, front: -1, dirty: true }
    const engine = createStackMotion({
      count: N,
      reduced,
      readScroll,
      onFront: (f) => {
        setFront(f)
        onFront?.(f)
      },
      onFrame: (s) => {
        // nothing moved since the last frame: write nothing (the loop idles
        // at almost zero cost between scrolls)
        if (Math.abs(s.p - lastFrame.p) < 1e-4 && Math.abs(s.lean - lastFrame.lean) < 1e-3 && s.front === lastFrame.front && !lastFrame.dirty) return
        lastFrame = { p: s.p, lean: s.lean, front: s.front, dirty: false }
        const { cw, pitch, fan } = geom.current
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const slot = i - s.p
          if (Math.abs(slot) > (fan ? 3.6 : 3.2)) {
            el.style.visibility = 'hidden'
            return
          }
          el.style.visibility = 'visible'
          if (fan) {
            // the fan: the cards to come wait on the left and cross to the
            // right through the middle, which stands upright and on top; the
            // further out a card sits the lower it hangs, the more it leans
            // outward and the further back it steps
            const a = (-slot * FAN_DEG * Math.PI) / 180
            const R = FAN_RADIUS * cw
            const x = R * Math.sin(a)
            const y = R * (1 - Math.cos(a))
            const scale = 1 - 0.045 * Math.min(3, Math.abs(slot))
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(-slot * FAN_DEG + s.lean).toFixed(2)}deg) scale(${scale.toFixed(3)})`
          } else {
            const look = lookAt(slot)
            el.style.transform = `translate(${(look.x / 100) * cw}px, ${slot * pitch}px) rotate(${look.tilt + s.lean}deg)`
          }
          el.style.zIndex = N - Math.abs(i - s.front)
        })
        if (bdRef.current) bdRef.current.style.transform = `translateY(${s.bgY}px)`
      },
    })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__hsEngine = engine
    // the loop runs only while the block is anywhere near the viewport
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dirty.current = true
          lastFrame.dirty = true
          engine.start()
        } else engine.stop()
      },
      { rootMargin: '25% 0px' },
    )
    if (wrapRef?.current) io.observe(wrapRef.current)
    else engine.start()
    return () => {
      io.disconnect()
      engine.stop()
      window.removeEventListener('resize', onResize)
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
            light={!!LIGHT[i % LIGHT.length] && !SKIN[h.icon]}
            skin={SKIN[h.icon]}
            hidden={i !== front}
            lite={Math.abs(i - front) > 3}
            /* the live piece is built only for cards within two of the front
               (the others keep their skin and an empty stage): the two story
               cards and the showcases are the heaviest DOM on the page */
            visual={VISUAL[h.icon] ? (withVisuals && Math.abs(i - front) <= 2 ? (() => { const V = VISUAL[h.icon]; return <V active={i === front} /> })() : <div />) : null}
          />
        ))}
      </div>
      <StackDots count={N} current={front} />
    </div>
  )
}
