import { useEffect } from 'react'
import { motion } from 'motion/react'

const CELLS = [
  { big: 'AI-first', small: 'From day one.' },
  { big: 'Fast', small: 'By default.' },
  { big: 'Pause', small: 'Or cancel anytime.' },
  { big: '10-in-1', small: 'One invoice.' },
]

export default function WhyUs() {
  // three.js rides along with model-viewer — load it lazily so the main
  // bundle stays light and the hero paints fast.
  useEffect(() => {
    if (!customElements.get('model-viewer')) import('@google/model-viewer')
  }, [])

  return (
    <section id="why" className="border-y border-line bg-surface/60 py-28">
      <div className="container-x">
        <div className="mb-14">
          <p className="eyebrow">Why teams choose the Ravan</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            A better way to run growth.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* 3D bust — spans two rows */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-[#221409] to-ground md:row-span-2"
          >
            <model-viewer
              src="/models/ravan-head-web.glb"
              alt="Ten-headed Ravan bust, 3D"
              auto-rotate
              auto-rotate-delay="0"
              rotation-per-second="18deg"
              camera-controls
              disable-zoom
              shadow-intensity="1"
              exposure="1.15"
              environment-image="neutral"
              style={{ width: '100%', height: '420px', background: 'transparent' }}
            ></model-viewer>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ground via-ground/60 to-transparent p-7 pt-16">
              <h3 className="text-xl font-bold">Ten minds. One will.</h3>
              <p className="mt-1 text-sm text-muted">
                Drag to meet every head. Each one owns a discipline end-to-end.
              </p>
            </div>
          </motion.div>

          {/* copy cell */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="rounded-3xl border border-line bg-card p-8 md:col-span-2"
          >
            <h3 className="text-2xl font-bold">Crafted by humans. Scaled by agents.</h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Strategy, design and copy stay senior and human. Execution runs on
              autonomous agents that never miss a follow-up, a report or a
              reorder point. You get craft at machine speed — not one or the other.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Agentic AI', 'Smart ERP', 'Voice AI', 'GEO', 'Predictive BI', 'DCO Ads', 'API Integration', 'Brand Shield'].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </motion.div>

          {/* stat cells */}
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            {CELLS.map((c, i) => (
              <motion.div
                key={c.big}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.06 }}
                className="rounded-3xl border border-line bg-card p-6"
              >
                <p className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-2xl font-extrabold text-transparent md:text-3xl">
                  {c.big}
                </p>
                <p className="mt-1 text-sm text-muted">{c.small}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
