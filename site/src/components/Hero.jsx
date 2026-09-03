import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import ShaderGrain from './ShaderGrain.jsx'
import RavanHead from './RavanHead.jsx'

/*
 * The signature animation: a slim arc sweeping the right side of the panel.
 * One 3D head PRESENTS at the center of the visible arc, full size, facing
 * right, while the NEXT head waits small at the arc's corner looking toward
 * the stage. On cue the presenter exits down the arc, the waiter grows as it
 * glides to center, and a fresh head slides in to wait. The capability card
 * springs up from beneath the presenting head. Three rotating hosts cover
 * waiter + presenter + exiter being on stage at once.
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

const START = -18      // off the right edge, where a waiter slides in from
const EXIT = -228      // fully gone past the bottom-left
const T_SLIDE = 0.9    // seconds: slide in to the waiting corner
const T_MOVE = 1.4     // seconds: corner -> center, growing
const T_HOLD = 4.6     // seconds: presenting at center
const T_EXIT = 2.0     // seconds: center -> gone
const PERIOD = T_MOVE + T_HOLD // a new head takes the stage every PERIOD
const WAIT_SCALE = 0.55

const easeOutCubic = (p) => 1 - (1 - p) ** 3
const easeInQuad = (p) => p * p
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

/* pose the parent feeds each head: facing right on stage, toward it waiting */
const YAW = { wait: -0.35, move: 0.1, present: 0.55, exit: 0.3 }

export default function Hero() {
  const panelRef = useRef(null)
  const layerRef = useRef(null)
  const hostRefs = [useRef(null), useRef(null), useRef(null)]
  const poseRefs = useRef([{ baseYaw: 0 }, { baseYaw: 0 }, { baseYaw: 0 }])
  const cardRef = useRef(null)
  const pausedRef = useRef(false)
  const [shown, setShown] = useState(HEADS[0]) // head being presented
  const [hostSrcs, setHostSrcs] = useState([
    modelFor(HEADS[0]),
    modelFor(HEADS[1]),
    modelFor(HEADS[2]),
  ])

  useEffect(() => {
    const panel = panelRef.current
    const layer = layerRef.current
    const hosts = hostRefs.map((r) => r.current)
    const card = cardRef.current
    if (!panel || !layer || !card || hosts.some((h) => !h)) return

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, cx = 0, cy = 0, r = 0, bandIn = 0, bandOut = 0, bs = 0
    let CORNER = -103, CENTER = -140
    let bandEl = null, shadeEl = null
    let raf = 0

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
        // narrow screens: a slim arc hugging the bottom-right corner
        cx = 1.18 * W
        cy = 1.0 * H
        r = 0.55 * W
        bandIn = r - 0.075 * W
        bandOut = r + 0.075 * W
        bs = Math.max(80, 0.24 * W)
        CORNER = -112
        CENTER = -150
      } else {
        // slim ring pushed to the right edge, clear of the copy
        cx = 1.04 * W
        cy = 1.0 * H
        r = 0.42 * W
        bandIn = r - 0.055 * W
        bandOut = r + 0.055 * W
        bs = Math.min(Math.max(90, 0.15 * W), 170)
        CORNER = -103
        CENTER = -140
      }
      for (const h of hosts) h.style.width = h.style.height = bs + 'px'
      buildBand()
    }

    function place(host, angle, scale) {
      if (angle === null) {
        host.style.transform = 'translate(-9999px, -9999px)'
        return
      }
      const rad = (angle * Math.PI) / 180
      host.style.transform =
        `translate(${cx + r * Math.cos(rad) - bs / 2}px, ${cy + r * Math.sin(rad) - bs / 2}px)` +
        ` scale(${scale})`
    }

    /* one head's journey; u = seconds since its stage slot began */
    function stateAt(u) {
      const waitStart = -T_HOLD // slides in as the previous head starts talking
      if (u < waitStart) return null
      if (u < waitStart + T_SLIDE) {
        const p = easeOutCubic((u - waitStart) / T_SLIDE)
        return { angle: START + (CORNER - START) * p, scale: WAIT_SCALE, phase: 'wait' }
      }
      if (u < 0) return { angle: CORNER, scale: WAIT_SCALE, phase: 'wait' }
      if (u < T_MOVE) {
        const p = easeInOutCubic(u / T_MOVE)
        return {
          angle: CORNER + (CENTER - CORNER) * p,
          scale: WAIT_SCALE + (1 - WAIT_SCALE) * p,
          phase: 'move',
        }
      }
      if (u < T_MOVE + T_HOLD) return { angle: CENTER, scale: 1, phase: 'present' }
      if (u < T_MOVE + T_HOLD + T_EXIT) {
        const p = easeInQuad((u - T_MOVE - T_HOLD) / T_EXIT)
        return { angle: CENTER + (EXIT - CENTER) * p, scale: 1 - 0.15 * p, phase: 'exit' }
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
      place(hosts[0], CENTER, 1)
      poseRefs.current[0].baseYaw = YAW.present
      place(hosts[1], CORNER, WAIT_SCALE)
      poseRefs.current[1].baseYaw = YAW.wait
      place(hosts[2], null, 1)
      card.style.opacity = '1'
      card.style.transform = 'none'
      return () => window.removeEventListener('resize', onResize)
    }

    // stateless timeline: everything derives from the paused-aware clock,
    // so a dropped frame or restarted loop can never wedge the animation.
    let clock = 0
    let last = performance.now()
    let lastTickAt = last
    let presentedSlot = -1
    const hostSlot = [0, 1, 2]

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      lastTickAt = now
      if (!pausedRef.current) clock += dt

      // heads k-1 (exiting), k (presenting), k+1 (waiting) can share the stage
      const kNow = Math.floor(clock / PERIOD)
      const assigned = [null, null, null]
      for (const k of [kNow - 1, kNow, kNow + 1]) {
        if (k < 0) continue
        const st = stateAt(clock - k * PERIOD)
        if (!st) continue
        const h = k % 3
        assigned[h] = st
        poseRefs.current[h].baseYaw = YAW[st.phase]
        if (hostSlot[h] !== k) {
          // this host just took over slot k — give it that head's model
          hostSlot[h] = k
          setHostSrcs((prev) => {
            const next = [...prev]
            next[h] = modelFor(HEADS[k % HEADS.length])
            return next
          })
        }
      }
      for (let h = 0; h < 3; h++) {
        place(hosts[h], assigned[h]?.angle ?? null, assigned[h]?.scale ?? 1)
      }

      // presenting slot drives the card
      const u = clock - kNow * PERIOD
      let presenting = -1
      if (u >= T_MOVE && u < T_MOVE + T_HOLD) presenting = kNow
      if (presenting !== presentedSlot) {
        const wasPresenting = presentedSlot >= 0
        presentedSlot = presenting
        if (presenting >= 0) {
          setShown(HEADS[presenting % HEADS.length])
          flyCardIn()
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

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(watchdog)
      window.removeEventListener('resize', onResize)
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
        className="theme-light relative min-h-[560px] overflow-hidden rounded-3xl border border-line lg:h-[82vh] lg:max-h-[820px]"
        onPointerEnter={() => { pausedRef.current = true }}
        onPointerLeave={() => { pausedRef.current = false }}
      >
          <ShaderGrain className="absolute inset-0 z-0 h-full w-full" />
          <div ref={layerRef} className="absolute inset-0 z-0" aria-hidden="true" />

          {/* three rotating 3D heads: waiter, presenter, exiter */}
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
            className="absolute bottom-[5%] right-[4%] z-[6] w-[62%] max-w-[300px] md:bottom-[7%] md:right-[5%] md:w-[30%] md:max-w-[330px]"
          >
            <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-ground/75 p-5 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md">
              {/* watermark number */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-5 font-display text-[4.5rem] font-extrabold leading-none text-gold/10"
              >
                {String(shown.n).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-card text-gold">
                  <HeadIcon name={shown.icon} className="h-4 w-4" />
                </div>
                <span className="chip border-gold/40 text-gold">Head {String(shown.n).padStart(2, '0')} · {shown.short}</span>
              </div>
              <p className="mt-3 font-display text-[0.95rem] font-bold leading-snug">{shown.title}</p>
              <p className="mt-1 text-xs font-extrabold tracking-wide">
                <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">{shown.metric}</span>
              </p>
              <p className="mt-2 hidden text-xs leading-relaxed text-muted md:block">{shown.desc}</p>
              {/* which head is on stage */}
              <div className="mt-4 flex items-center gap-1.5">
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

          <div className="relative z-10 flex h-full flex-col justify-between p-8 md:p-12">
            <div className="max-w-xl">
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="eyebrow"
              >
                The ten-headed growth engine
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className="mt-5 text-4xl font-bold leading-[1.08] md:text-6xl"
              >
                One retainer.
                <br />
                Ten heads.{' '}
                <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">
                  Zero mercy
                </span>{' '}
                for slow growth.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.16 }}
                className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted"
              >
                Marketing Ravan fuses agentic AI, smart ERP and next-gen digital
                marketing into one team. Every head is a weapon — deployed on
                your funnel, your ops and your brand.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.24 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <a href="/contact" className="btn-primary">
                  Summon the Ravan <Arrow className="h-4 w-4" />
                </a>
                <a href="#heads" className="btn-ghost">See the 10 Heads</a>
              </motion.div>
            </div>

            {/* deploys-across strip */}
            <p className="mt-10 max-w-lg text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
              Deploys across
              <span className="ml-3 font-semibold normal-case tracking-normal text-cream/55">
                WhatsApp · LinkedIn · Meta Ads · Google · Shopify · SAP · Tally · HubSpot
              </span>
            </p>
          </div>
      </div>
    </section>
  )
}
