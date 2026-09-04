import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import ShaderGrain from './ShaderGrain.jsx'
import RavanHead from './RavanHead.jsx'

/*
 * The signature animation: a slim arc sweeping the right side of the panel.
 * One 3D head PRESENTS at the center of the visible arc, full size, facing
 * right, while the NEXT head waits small at the arc's corner looking toward
 * the stage. On cue the presenter exits down the arc, settles at the lower
 * corner, the waiter grows as it glides to center, and a fresh head slides in
 * to wait. The capability card springs up from beneath the presenting head.
 * Four rotating hosts keep the outgoing head visible instead of replacing it
 * early with the incoming one.
 */

/* which personality model presents each capability (by heads.js icon key) */
const MODEL_FOR_ICON = {
  agent: 'head-engineer',
  sdr: 'head-closer',
  voice: 'head-orator',
  geo: 'head-sage',
  erp: 'head-engineer',
  ads: 'head-showman',
  bi: 'head-sage',
  uiux: 'head-showman',
  api: 'head-engineer',
  shield: 'head-orator',
}
const modelFor = (head) => `/models/${MODEL_FOR_ICON[head.icon] ?? 'ravan-head2'}-web.glb`

/* the order heads take the stage: marketing first, then web, sales, ops.
 * Drives the 3D head, the card and the rotating headline word together. */
const STAGE_ORDER = ['ads', 'geo', 'uiux', 'sdr', 'voice', 'agent', 'erp', 'api', 'bi', 'shield']
const STAGE = STAGE_ORDER.map((icon) => HEADS.find((h) => h.icon === icon)).filter(Boolean)

/* the rotating word in the headline. Runs on its own clock, independent of
 * which head is on the arc, so the breadth reads quickly. Marketing first. */
const WORDS = [
  'Meta ads',
  'Google ads',
  'SEO',
  'GEO',
  'website',
  'sales follow-ups',
  'customer calls',
  'ERP',
  'integrations',
  'analytics',
  'brand reputation',
]
const WORD_MS = 2000

/* the breadth of the offer, shown as chips under the hero copy. Marketing
 * first (the user's main focus), then web, then operations and AI. */
const WE_HANDLE = [
  'Meta Ads',
  'Google Ads',
  'SEO',
  'GEO (AI search)',
  'Ad Creatives',
  'Websites & UI/UX',
  'AI Sales Agents',
  'Voice AI',
  'Smart ERP',
  'Integrations',
  'Analytics & BI',
  'Brand Monitoring',
]

const START = -38      // just outside the right edge, where a waiter arrives
const EXIT = -220      // fully gone past the bottom-left
const T_SLIDE = 1.1    // seconds: slide in to the waiting corner
const T_MOVE = 1.7     // seconds: corner -> center, growing
const T_HOLD = 4.8     // seconds: presenting at center
const T_GLIDE = 1.45   // seconds: center -> far corner, shrinking
const T_DEPART = 1.0   // seconds: far corner -> gone past the bottom-left
const PERIOD = T_MOVE + T_HOLD // a new head takes the stage every PERIOD
// A finished head rests at the lower arc corner through the next handoff,
// then leaves just before a second parked head would crowd that corner.
const REST_END = 2 * PERIOD - T_DEPART - 0.1
const WAIT_SCALE = 0.55       // desktop; halved on narrow screens in measure()

const easeOutCubic = (p) => 1 - (1 - p) ** 3
const easeInQuad = (p) => p * p
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

/* pose the parent feeds each head: facing right on stage, toward it waiting */
const YAW = { wait: -0.35, move: 0.1, present: 0.55, exit: 0.3, rest: 0.35 }

export default function Hero() {
  const panelRef = useRef(null)
  const layerRef = useRef(null)
  const hostRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const poseRefs = useRef([{ baseYaw: 0 }, { baseYaw: 0 }, { baseYaw: 0 }, { baseYaw: 0 }])
  const cardRef = useRef(null)
  const [shown, setShown] = useState(STAGE[0]) // head being presented
  const [word, setWord] = useState(0) // index into WORDS

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), WORD_MS)
    return () => clearInterval(id)
  }, [])
  const [hostSrcs, setHostSrcs] = useState([
    modelFor(STAGE[0]),
    modelFor(STAGE[1]),
    modelFor(STAGE[2]),
    modelFor(STAGE[3]),
  ])

  useEffect(() => {
    const panel = panelRef.current
    const layer = layerRef.current
    const hosts = hostRefs.map((r) => r.current)
    const card = cardRef.current
    if (!panel || !layer || !card || hosts.some((h) => !h)) return

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, cx = 0, cy = 0, r = 0, bandIn = 0, bandOut = 0, bs = 0
    // These anchors describe one deliberate sweep: enter just off-stage,
    // wait at the rim, take the centre-right focal point, then fall away.
    // Keeping them in this order avoids the sharp, zig-zagging path the old
    // placement produced on wide panels.
    let CORNER = -74, CENTER = -128, RESTC = -168, WS = WAIT_SCALE
    let bandEl = null, shadeEl = null
    let raf = 0
    const rendered = hosts.map(() => ({ x: -9999, y: -9999, scale: 1, shown: false }))

    function buildBand() {
      if (!bandEl) {
        bandEl = document.createElement('div')
        bandEl.className = 'chute-band'
        shadeEl = document.createElement('div')
        shadeEl.className = 'chute-shade'
        layer.appendChild(bandEl)
        layer.appendChild(shadeEl)
      }
      for (const el of [bandEl, shadeEl]) {
        el.style.width = el.style.height = 2 * bandOut + 'px'
        el.style.left = cx - bandOut + 'px'
        el.style.top = cy - bandOut + 'px'
      }
      bandEl.style.background =
        `radial-gradient(circle closest-side, rgba(0,0,0,0) ${bandIn - 2}px,` +
        ` rgba(28, 17, 9, 0.12) ${bandIn}px ${bandOut - 2}px, rgba(0,0,0,0) ${bandOut}px)`
      shadeEl.style.background =
        `radial-gradient(circle closest-side, rgba(0,0,0,0) ${bandIn - 2}px,` +
        ` rgba(226,87,30,.10) ${bandIn + 2}px, rgba(0,0,0,0) ${bandIn + (bandOut - bandIn) * 0.5}px,` +
        ` rgba(240,163,47,.08) ${bandOut - 10}px, rgba(0,0,0,0) ${bandOut}px)`
    }

    function measure() {
      W = panel.clientWidth
      H = panel.clientHeight
      if (W < 768) {
        // narrow screens: a big sweeping arc across the lower half, heads
        // riding high enough that the info card can nest inside the curve
        cx = 1.15 * W
        cy = 1.08 * H
        r = 0.9 * W
        bandIn = r - 0.09 * W
        bandOut = r + 0.09 * W
        bs = Math.max(100, 0.3 * W)
        CORNER = -78
        CENTER = -118
        RESTC = -162
        WS = WAIT_SCALE / 2
      } else {
        // slim ring pushed to the right edge, clear of the copy
        cx = 1.02 * W
        cy = 1.02 * H
        r = 0.48 * W
        bandIn = r - 0.055 * W
        bandOut = r + 0.055 * W
        bs = Math.min(Math.max(90, 0.15 * W), 170)
        CORNER = -74
        CENTER = -128
        RESTC = -168
        WS = WAIT_SCALE
      }
      for (const h of hosts) h.style.width = h.style.height = bs + 'px'
      // narrow screens: horizontal drags scrub the arc, vertical still scrolls
      panel.style.touchAction = W < 768 ? 'pan-y' : ''
      buildBand()
    }

    function place(host, index, angle, scale, dt = 0, immediate = false) {
      const current = rendered[index]
      if (angle === null) {
        current.shown = false
        host.style.opacity = '0'
        host.style.transform = 'translate3d(-9999px, -9999px, 0) scale(1)'
        return
      }
      const rad = (angle * Math.PI) / 180
      const targetX = cx + r * Math.cos(rad) - bs / 2
      const targetY = cy + r * Math.sin(rad) - bs / 2

      // Time-based damping makes the path remain fluid on a busy main thread
      // and on high-refresh displays. A newly appearing head is placed at its
      // entry point immediately; every subsequent frame eases toward the arc.
      if (!current.shown || immediate) {
        current.x = targetX
        current.y = targetY
        current.scale = scale
        current.shown = true
      } else {
        const damping = 1 - Math.exp(-Math.max(dt, 0.001) * 11)
        current.x += (targetX - current.x) * damping
        current.y += (targetY - current.y) * damping
        current.scale += (scale - current.scale) * damping
      }
      host.style.opacity = '1'
      host.style.transform =
        `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0) scale(${current.scale.toFixed(4)})`
    }

    /* one head's journey; u = seconds since its stage slot began */
    function stateAt(u) {
      const waitStart = -T_HOLD // slides in as the previous head starts talking
      if (u < waitStart) return null
      if (u < waitStart + T_SLIDE) {
        const p = easeOutCubic((u - waitStart) / T_SLIDE)
        return { angle: START + (CORNER - START) * p, scale: WS, phase: 'wait' }
      }
      if (u < 0) return { angle: CORNER, scale: WS, phase: 'wait' }
      if (u < T_MOVE) {
        const p = easeInOutCubic(u / T_MOVE)
        return {
          angle: CORNER + (CENTER - CORNER) * p,
          scale: WS + (1 - WS) * p,
          phase: 'move',
        }
      }
      if (u < T_MOVE + T_HOLD) return { angle: CENTER, scale: 1, phase: 'present' }
      if (u < T_MOVE + T_HOLD + T_GLIDE) {
        // done presenting: shrink and glide to the far end of the arc
        const p = easeInOutCubic((u - T_MOVE - T_HOLD) / T_GLIDE)
        return { angle: CENTER + (RESTC - CENTER) * p, scale: 1 + (WS - 1) * p, phase: 'exit' }
      }
      if (u < REST_END) return { angle: RESTC, scale: WS, phase: 'rest' }
      if (u < REST_END + T_DEPART) {
        // its host is needed for a fresh head: slip away down the arc
        const p = easeInQuad((u - REST_END) / T_DEPART)
        return { angle: RESTC + (EXIT - RESTC) * p, scale: WS, phase: 'exit' }
      }
      return null
    }

    function flyCardIn() {
      // the card springs up from just below the presenting head
      const rad = (CENTER * Math.PI) / 180
      const headX = cx + r * Math.cos(rad)
      const headY = cy + r * Math.sin(rad)
      const pr = panel.getBoundingClientRect()
      const cr = card.getBoundingClientRect()
      const dx = headX - (cr.left - pr.left + cr.width / 2)
      const dy = headY + bs * 0.55 - (cr.top - pr.top + cr.height / 2)
      card.style.transition = 'none'
      card.style.transform = `translate(${dx}px, ${dy}px) scale(0.5)`
      card.style.opacity = '0'
      requestAnimationFrame(() => {
        card.style.transition =
          'transform 0.7s cubic-bezier(0.22, 0.9, 0.3, 1), opacity 0.45s ease-out'
        card.style.transform = 'translate(0px, 0px) scale(1)'
        card.style.opacity = '1'
      })
    }

    function fadeCardOut() {
      card.style.transition = 'transform 0.4s ease-in, opacity 0.35s ease-in'
      card.style.transform = 'translate(0px, 14px) scale(0.96)'
      card.style.opacity = '0'
    }

    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)

    if (reduced) {
      place(hosts[0], 0, CENTER, 1, 0, true)
      poseRefs.current[0].baseYaw = YAW.present
      place(hosts[1], 1, CORNER, WS, 0, true)
      poseRefs.current[1].baseYaw = YAW.wait
      place(hosts[2], 2, RESTC, WS, 0, true)
      poseRefs.current[2].baseYaw = YAW.rest
      place(hosts[3], 3, null, 1, 0, true)
      card.style.opacity = '1'
      card.style.transform = 'none'
      return () => window.removeEventListener('resize', onResize)
    }

    // stateless timeline: everything derives from the clock, so a dropped
    // frame or restarted loop can never wedge the animation.
    let clock = 0
    let last = performance.now()
    let lastTickAt = last
    let presentedSlot = -1
    const hostSlot = [0, 1, 2, 3]

    // drag-to-scrub state: while a finger drags along the arc the clock
    // follows it; on release the flick velocity carries on and friction
    // eases the rate back to normal auto-play (1 clock-second per second)
    let dragging = false
    let dragMoved = false
    let rate = 1

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      lastTickAt = now
      if (!dragging) {
        rate += (1 - rate) * Math.min(1, dt * 2.5)
        clock = Math.max(0, clock + dt * rate)
      }

      // heads k-2 (parked at the lower corner), k-1 (exiting), k (presenting),
      // k+1 (waiting). Each gets its own host, so the outgoing head holds its
      // corner position throughout the handoff.
      const kNow = Math.floor(clock / PERIOD)
      const assigned = [null, null, null, null]
      for (const k of [kNow - 2, kNow - 1, kNow, kNow + 1]) {
        if (k < 0) continue
        const st = stateAt(clock - k * PERIOD)
        if (!st) continue
        const h = k % 4
        assigned[h] = st
        poseRefs.current[h].baseYaw = YAW[st.phase]
        if (hostSlot[h] !== k) {
          // this host just took over slot k — give it that head's model
          hostSlot[h] = k
          setHostSrcs((prev) => {
            const next = [...prev]
            next[h] = modelFor(STAGE[k % STAGE.length])
            return next
          })
        }
      }
      for (let h = 0; h < 4; h++) {
        place(hosts[h], h, assigned[h]?.angle ?? null, assigned[h]?.scale ?? 1, dt)
      }

      // presenting slot drives the card
      const u = clock - kNow * PERIOD
      let presenting = -1
      if (u >= T_MOVE && u < T_MOVE + T_HOLD) presenting = kNow
      if (presenting !== presentedSlot) {
        const wasPresenting = presentedSlot >= 0
        presentedSlot = presenting
        if (presenting >= 0) {
          setShown(STAGE[presenting % STAGE.length])
          if (dragging || Math.abs(rate - 1) > 0.6) {
            // mid-scrub: swap the card in place, no springy fly-in
            card.style.transition = 'opacity 0.25s ease-out'
            card.style.transform = 'translate(0px, 0px) scale(1)'
            card.style.opacity = '1'
          } else {
            flyCardIn()
          }
        } else if (wasPresenting) {
          fadeCardOut()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // watchdog: if the rAF chain ever silently dies, restart it
    const watchdog = setInterval(() => {
      if (performance.now() - lastTickAt > 1500) {
        cancelAnimationFrame(raf)
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }, 1500)

    // ---- drag the heads along the arc (narrow layout) ----
    // finger angle around the arc's center maps to timeline seconds, so the
    // heads track the finger along the curve; a flick hands its velocity to
    // `rate`, which friction then eases back to normal speed in tick()
    const SCRUB = 0.08 // timeline seconds per degree of arc
    let startX = 0, startY = 0, lastAngle = 0, lastMoveT = 0, scrubVel = 0

    const angleAt = (e) => {
      const pr = panel.getBoundingClientRect()
      return (Math.atan2(e.clientY - pr.top - cy, e.clientX - pr.left - cx) * 180) / Math.PI
    }
    const onDown = (e) => {
      if (W >= 768) return
      if (e.target.closest('a,button')) return
      const pr = panel.getBoundingClientRect()
      if (e.clientY - pr.top < 0.45 * H) return // only the arc zone
      dragging = true
      dragMoved = false
      startX = e.clientX
      startY = e.clientY
      lastAngle = angleAt(e)
      lastMoveT = performance.now()
      scrubVel = 0
    }
    const onMove = (e) => {
      if (!dragging) return
      if (!dragMoved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return
      dragMoved = true
      let d = angleAt(e) - lastAngle
      if (d > 180) d -= 360
      else if (d < -180) d += 360
      const now = performance.now()
      const dc = -d * SCRUB // counterclockwise along the arc = forward in time
      clock = Math.max(0, clock + dc)
      const dts = Math.max(0.016, (now - lastMoveT) / 1000)
      scrubVel = scrubVel * 0.7 + (dc / dts) * 0.3
      lastAngle = angleAt(e)
      lastMoveT = now
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      if (dragMoved) rate = Math.max(-6, Math.min(6, scrubVel))
    }
    panel.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(watchdog)
      window.removeEventListener('resize', onResize)
      panel.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      layer.innerHTML = ''
      bandEl = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section id="top" className="container-x pt-24 pb-4">
      {/* full-width hero panel */}
      <div
        ref={panelRef}
        className="theme-light relative min-h-[640px] overflow-hidden rounded-3xl border border-line md:min-h-[560px] lg:min-h-[82vh]"
      >
          <ShaderGrain className="absolute inset-0 z-0 h-full w-full" />
          <div ref={layerRef} className="absolute inset-0 z-0" aria-hidden="true" />

          {/* four rotating 3D heads: waiter, presenter, exiting, parked outgoing */}
          {hostRefs.map((ref, i) => (
            <div key={i} ref={ref} className="absolute left-0 top-0 z-[5] will-change-transform">
              <RavanHead src={hostSrcs[i]} poseRef={{ current: poseRefs.current[i] }} className="h-full w-full" />
            </div>
          ))}

          {/* capability card — springs up from beneath the presenting head */}
          <div
            ref={cardRef}
            aria-live="polite"
            style={{ opacity: 0 }}
            className="absolute bottom-[3%] right-[3%] z-[6] w-[40%] max-w-[150px] md:bottom-[7%] md:right-[5%] md:w-[30%] md:max-w-[330px]"
          >
            <div className="relative overflow-hidden rounded-lg border border-gold/25 bg-ground/75 p-2.5 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md md:rounded-2xl md:p-5">
              {/* watermark number */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-1 -top-2 font-display text-[2.2rem] font-extrabold leading-none text-gold/10 md:-right-2 md:-top-5 md:text-[4.5rem]"
              >
                {String(shown.n).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-card text-gold md:h-9 md:w-9">
                  <HeadIcon name={shown.icon} className="h-3 w-3 md:h-4 md:w-4" />
                </div>
                <span className="chip border-gold/40 !text-[0.5rem] text-gold md:!text-[0.65rem]">Head {String(shown.n).padStart(2, '0')} · {shown.short}</span>
              </div>
              <p className="mt-1.5 font-display text-[0.7rem] font-bold leading-snug md:mt-3 md:text-[0.95rem]">{shown.title}</p>
              <p className="mt-0.5 text-[0.58rem] font-extrabold tracking-wide md:mt-1 md:text-xs">
                <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">{shown.metric}</span>
              </p>
              <p className="mt-2 hidden text-xs leading-relaxed text-muted md:block">{shown.desc}</p>
              {/* which head is on stage */}
              <div className="mt-2 flex items-center gap-1 md:mt-4 md:gap-1.5">
                {HEADS.map((h) => (
                  <span
                    key={h.n}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      h.n === shown.n ? 'w-4 bg-gradient-to-r from-gold to-ember' : 'w-1 bg-cream/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-12">
            <div className="max-w-xl">
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="eyebrow"
              >
                Your complete digital growth team
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className="mt-4 text-[1.85rem] font-bold leading-[1.1] md:mt-5 md:text-[3.4rem] md:leading-[1.06]"
              >
                We run your{' '}
                <span className="inline-block whitespace-nowrap border-b-4 border-gold/50 leading-[1]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={word}
                      initial={{ opacity: 0, y: '0.35em' }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: '-0.35em' }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="inline-block"
                    >
                      {WORDS[word]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                .
                <br />
                <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">
                  One team for everything digital.
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.16 }}
                className="mt-4 max-w-md text-[0.82rem] leading-relaxed text-muted md:mt-5 md:text-[0.95rem]"
              >
                Ads. SEO. Websites. AI agents. ERP. Ten expert heads, one monthly
                retainer.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.24 }}
                className="mt-6 flex flex-wrap gap-3 md:mt-8"
              >
                <a href="/contact" className="btn-primary">
                  Book a call <Arrow className="h-4 w-4" />
                </a>
                <a href="#heads" className="btn-ghost">See everything we do</a>
              </motion.div>
            </div>

            {/* what-we-handle strip: the breadth of the offer, at a glance.
                Kept narrow on mobile so it stays clear of the capability card
                at the bottom-right of the panel. */}
            <div className="mt-8 max-w-[54%] md:mt-8 md:max-w-2xl">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-muted md:text-[0.62rem]">
                We handle
                <span className="ml-3 hidden font-semibold normal-case tracking-normal text-cream/45 md:inline">
                  · inside WhatsApp, LinkedIn, Meta, Google, Shopify, SAP, Tally and HubSpot
                </span>
              </p>
              {/* phones show the first six plus a "+N more" link; wider screens show all */}
              <ul className="mt-2 flex flex-wrap gap-1.5 md:gap-2" aria-label="Services we handle">
                {WE_HANDLE.map((s, i) => (
                  <li
                    key={s}
                    className={`rounded-full border border-cream/15 bg-ground/40 px-2 py-0.5 text-[0.55rem] font-semibold text-cream/75 backdrop-blur-sm md:px-3 md:py-1 md:text-[0.68rem] ${
                      i >= 6 ? 'hidden md:block' : ''
                    }`}
                  >
                    {s}
                  </li>
                ))}
                <li className="md:hidden">
                  <a
                    href="#heads"
                    className="block rounded-full border border-gold/40 px-2 py-0.5 text-[0.55rem] font-bold text-gold"
                  >
                    +{WE_HANDLE.length - 6} more
                  </a>
                </li>
              </ul>
            </div>
          </div>
      </div>
    </section>
  )
}
