import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'

import imgAgents from '../assets/work-agents.jpg'
import imgSdr from '../assets/work-sdr.jpg'
import imgVoice from '../assets/work-voice.jpg'
import imgGeo from '../assets/work-geo.jpg'
import imgErp from '../assets/work-erp.jpg'
import imgAds from '../assets/work-ads.jpg'
import imgBi from '../assets/work-bi.jpg'
import imgUiux from '../assets/work-uiux.jpg'
import imgApi from '../assets/work-api.jpg'
import imgShield from '../assets/work-shield.jpg'

gsap.registerPlugin(ScrollTrigger)

const VISUALS = {
  agent: imgAgents,
  sdr: imgSdr,
  voice: imgVoice,
  geo: imgGeo,
  erp: imgErp,
  ads: imgAds,
  bi: imgBi,
  uiux: imgUiux,
  api: imgApi,
  shield: imgShield,
}

/*
 * The stacked-cards section, beew-scale: each head is a near-viewport card
 * with a big numeral, full copy and its own product visual. Cards pin with
 * position:sticky; GSAP dims and shrinks the card being covered.
 */

export default function Heads() {
  const wrapRef = useRef(null)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cards = wrapRef.current?.querySelectorAll('.head-card')
    if (!cards?.length) return
    const triggers = []
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return
      const next = cards[i + 1]
      triggers.push(
        gsap.to(card, {
          scale: 0.9,
          opacity: 0.06,
          ease: 'none',
          scrollTrigger: {
            trigger: next,
            start: 'top bottom',
            end: 'top top+=110',
            scrub: true,
          },
        }),
      )
    })
    return () => triggers.forEach((t) => t.scrollTrigger?.kill())
  }, [])

  return (
    <section id="heads" className="container-x pb-32 pt-8">
      <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The arsenal</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            Ten heads. Ten weapons.
            <br />
            <span className="text-muted">Every trend that matters in 2026.</span>
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          AI, ERP and digital marketing — the ten highest-leverage capabilities
          right now, each run by a dedicated head of the Ravan.
        </p>
      </div>

      <div ref={wrapRef} className="flex flex-col gap-8">
        {HEADS.map((h, i) => (
          <article
            key={h.n}
            className="head-card bg-gradient-to-br from-card to-surface"
            style={{ top: `${80 + i * 6}px`, zIndex: i + 1 }}
          >
            {/* watermark numeral */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-4 select-none font-display text-[9rem] font-extrabold leading-none text-cream/[0.045] md:-top-10 md:right-8 md:text-[15rem]"
            >
              {String(h.n).padStart(2, '0')}
            </span>

            <div className="relative grid min-h-[68vh] items-center gap-10 p-8 md:p-14 lg:grid-cols-[1fr_1.05fr]">
              {/* copy */}
              <div>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-ground text-gold">
                    <HeadIcon name={h.icon} className="h-7 w-7" />
                  </span>
                  <span className="font-display text-sm font-extrabold tracking-[0.2em] text-gold">
                    HEAD {String(h.n).padStart(2, '0')} / 10
                  </span>
                </div>

                <motion.h3
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6 }}
                  className="mt-7 text-3xl font-bold leading-[1.08] md:text-5xl"
                >
                  {h.title}
                </motion.h3>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: 0.08 }}
                  className="mt-5 max-w-lg text-[1rem] leading-relaxed text-muted"
                >
                  {h.desc}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: 0.16 }}
                  className="mt-7 flex flex-wrap gap-2"
                >
                  {h.tags.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </motion.div>

                <motion.a
                  href="/contact"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: 0.24 }}
                  className="mt-9 inline-flex items-center gap-2 text-sm font-bold text-cream transition-colors hover:text-gold"
                >
                  Deploy this head <Arrow className="h-4 w-4" />
                </motion.a>
              </div>

              {/* visual */}
              <motion.div
                initial={{ opacity: 0, scale: 1.06, y: 24 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.8 }}
                className="group relative overflow-hidden rounded-2xl border border-line"
              >
                <img
                  src={VISUALS[h.icon]}
                  alt={`${h.title} — interface concept`}
                  loading="lazy"
                  className="block aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute bottom-4 left-4 rounded-xl border border-gold/40 bg-ground/85 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-muted">Key metric</p>
                  <p className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-xl font-extrabold text-transparent md:text-2xl">
                    {h.metric}
                  </p>
                </div>
              </motion.div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
