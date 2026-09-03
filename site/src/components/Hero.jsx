import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import headBadge from '../assets/head-badge.jpg'

/*
 * The signature animation: a curved chute sweeping from the top-right down to
 * the bottom-left of the hero panel. The ten heads of Ravan ride it as glowing
 * badges, each dragging a motion-blur comet tail. Hovering the panel pauses the
 * run and hovering a badge reveals that head's capability + metric.
 */

const SPEED = 28            // degrees per second along the arc (slow, regal)
const SPAWN = 1.6           // seconds between entries
const ENTER = -56           // entry angle (off the top-right edge)
const EXIT = -220           // fully gone past the bottom-left
const GHOSTS = 7

export default function Hero() {
  const panelRef = useRef(null)
  const layerRef = useRef(null)
  const pausedRef = useRef(false)
  const [active, setActive] = useState(null) // head shown in the info slot

  useEffect(() => {
    const panel = panelRef.current
    const layer = layerRef.current
    if (!panel || !layer) return

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, cx = 0, cy = 0, r = 0, bandIn = 0, bandOut = 0, bs = 0
    let bandEl = null, shadeEl = null
    const badges = []
    let headIdx = 0
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
        ` #241710 ${bandIn}px ${bandOut - 2}px, rgba(0,0,0,0) ${bandOut}px)`
      shadeEl.style.background =
        `radial-gradient(circle closest-side, rgba(0,0,0,0) ${bandIn - 2}px,` +
        ` rgba(226,87,30,.10) ${bandIn + 2}px, rgba(0,0,0,0) ${bandIn + (bandOut - bandIn) * 0.5}px,` +
        ` rgba(240,163,47,.08) ${bandOut - 10}px, rgba(0,0,0,0) ${bandOut}px)`
    }

    function measure() {
      W = panel.clientWidth
      H = panel.clientHeight
      if (W < 768) {
        // narrow screens: hug the bottom-right corner, away from the copy
        cx = 1.12 * W
        cy = 1.0 * H
        r = 0.58 * W
        bandIn = r - 0.14 * W
        bandOut = r + 0.14 * W
        bs = Math.max(54, 0.145 * W)
      } else {
        cx = 0.96 * W
        cy = 1.0 * H
        r = 0.46 * W
        bandIn = r - 0.115 * W
        bandOut = r + 0.115 * W
        bs = Math.min(Math.max(58, 0.115 * W), 112)
      }
      buildBand()
    }

    function makeBadge(angle) {
      const head = HEADS[headIdx % HEADS.length]
      headIdx += 1
      const ghosts = []
      for (let i = GHOSTS; i >= 1; i--) {
        const g = document.createElement('div')
        g.className = 'chute-ghost'
        g.style.opacity = (0.6 * (1 - i / (GHOSTS + 2))).toFixed(3)
        g.style.filter = `blur(${5 + i * 1.8}px)`
        ghosts.push(g)
        layer.appendChild(g)
      }
      const el = document.createElement('div')
      el.className = 'chute-badge'
      el.innerHTML =
        `<img src="${headBadge}" alt="" draggable="false"/>` +
        `<span class="fn">${String(head.n).padStart(2, '0')} · ${head.short}</span>`
      el.addEventListener('pointerenter', () => setActive(head))
      layer.appendChild(el)
      badges.push({ el, ghosts, angle })
    }

    function place(el, ang, size) {
      const rad = (ang * Math.PI) / 180
      el.style.width = el.style.height = size + 'px'
      el.style.transform =
        `translate(${cx + r * Math.cos(rad) - size / 2}px, ${cy + r * Math.sin(rad) - size / 2}px)`
    }

    function render() {
      for (const b of badges) {
        place(b.el, b.angle, bs)
        b.ghosts.forEach((g, j) => {
          const i = GHOSTS - j
          place(g, b.angle + i * 4.2, bs * (1 - 0.04 * i))
        })
      }
    }

    function cull() {
      for (let i = badges.length - 1; i >= 0; i--) {
        if (badges[i].angle < EXIT) {
          badges[i].el.remove()
          badges[i].ghosts.forEach((g) => g.remove())
          badges.splice(i, 1)
        }
      }
    }

    measure()
    const onResize = () => { measure(); render() }
    window.addEventListener('resize', onResize)

    if (reduced) {
      ;[-95, -135, -175].forEach((a) => makeBadge(a))
      badges.forEach((b) => b.ghosts.forEach((g) => (g.style.opacity = 0)))
      render()
      return () => window.removeEventListener('resize', onResize)
    }

    // pre-seed so the chute starts mid-run
    for (let k = 3; k >= 0; k--) makeBadge(ENTER - SPEED * SPAWN * k)
    badges.forEach((b, i) => { b.angle = ENTER - SPEED * SPAWN * (3 - i) })

    let last = performance.now()
    let sinceSpawn = 0
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!pausedRef.current) {
        for (const b of badges) b.angle -= SPEED * dt
        sinceSpawn += dt
        if (sinceSpawn >= SPAWN) {
          sinceSpawn -= SPAWN
          makeBadge(ENTER)
        }
        cull()
        render()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      layer.innerHTML = ''
      bandEl = null
    }
  }, [])

  const shown = active ?? HEADS[0]

  return (
    <section id="top" className="container-x pt-24 pb-4">
      {/* full-width hero panel */}
      <div
        ref={panelRef}
        className="relative min-h-[560px] overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-[#1A110A] to-[#120B07] lg:h-[82vh] lg:max-h-[820px]"
        onPointerEnter={() => { pausedRef.current = true }}
        onPointerLeave={() => { pausedRef.current = false; setActive(null) }}
      >
          <div ref={layerRef} className="absolute inset-0 z-0" aria-hidden="true" />

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

            {/* live head readout, fed by the chute */}
            <div className="mt-4 flex max-w-md items-center gap-4 rounded-2xl border border-line bg-ground/60 p-4 backdrop-blur-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-card text-gold">
                <HeadIcon name={shown.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{shown.title}</p>
                <p className="text-xs font-bold tracking-wide text-gold">{shown.metric}</p>
              </div>
              <span className="ml-auto shrink-0 font-display text-2xl font-extrabold text-cream/20">
                {String(shown.n).padStart(2, '0')}
              </span>
            </div>
          </div>
      </div>
    </section>
  )
}
