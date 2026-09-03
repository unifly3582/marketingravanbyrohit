import { motion } from 'motion/react'
import { Arrow } from './icons.jsx'
import sdr from '../assets/work-sdr.jpg'
import erp from '../assets/work-erp.jpg'
import bi from '../assets/work-bi.jpg'
import geo from '../assets/work-geo.jpg'
import mobile from '../assets/work-mobile.jpg'

/*
 * Concept demos of the heads in action — clearly labeled as concepts, not
 * client work, until real case studies replace them.
 */
const DEMOS = [
  {
    img: sdr,
    client: 'HEAD 02 · CONCEPT DEMO',
    cat: 'SALES / WHATSAPP',
    title: 'An SDR that never sleeps',
    desc: 'AI agent qualifies inbound WhatsApp leads, updates the pipeline and books meetings — end to end, no human in the loop.',
    tags: ['AI SDR', 'WHATSAPP FLOW', 'PIPELINE SYNC'],
    metric: '3x Conversion Rate',
  },
  {
    img: erp,
    client: 'HEAD 05 · CONCEPT DEMO',
    cat: 'ERP / OPERATIONS',
    title: 'Paper invoice to ERP in seconds',
    desc: 'OCR reads the photo, AI validates the fields, and the entry lands in finance and inventory — accurate to the paisa.',
    tags: ['AI / OCR', 'SMART ERP', 'AUTO-RECONCILE'],
    metric: '99.9% Data Accuracy',
  },
  {
    img: bi,
    client: 'HEAD 07 · CONCEPT DEMO',
    cat: 'ANALYTICS / ML',
    title: 'See next quarter today',
    desc: 'Forecast bands, churn flags and price recommendations on a live dashboard your leadership actually opens.',
    tags: ['FORECASTING', 'CHURN RADAR', 'DYNAMIC PRICING'],
    metric: 'Real-Time Forecasting',
  },
  {
    img: geo,
    client: 'HEAD 04 · CONCEPT DEMO',
    cat: 'SEARCH / AI ENGINES',
    title: 'Get cited by the machines',
    desc: 'Track how often AI engines recommend your brand, and mass-produce the programmatic pages that earn those citations.',
    tags: ['GEO', 'CITATION SHARE', 'PAGE FACTORY'],
    metric: '#1 AI Search Visibility',
  },
]

export default function Works() {
  return (
    <section id="work" className="container-x py-28">
      <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Deployments</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            The heads in action.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          Concept builds from our lab — the exact systems we deploy on client
          funnels, ops and dashboards.
        </p>
      </div>

      <div className="flex flex-col gap-20">
        {DEMOS.map((d, i) => (
          <motion.article
            key={d.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}
          >
            <div className="group overflow-hidden rounded-3xl border border-line">
              <img
                src={d.img}
                alt={`${d.title} — interface concept`}
                loading="lazy"
                className="block aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            </div>
            <div className={i % 2 ? 'lg:pr-8' : 'lg:pl-8'}>
              <div className="flex flex-wrap items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.18em]">
                <span className="text-gold">{d.client}</span>
                <span className="text-muted">{d.cat}</span>
              </div>
              <h3 className="mt-4 text-2xl font-bold md:text-4xl">{d.title}</h3>
              <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">{d.desc}</p>
              <span className="mt-5 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-bold tracking-wide text-gold">
                {d.metric}
              </span>
              <div className="mt-6 flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
              <a href="/contact" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cream transition-colors hover:text-gold">
                Deploy this on my business <Arrow className="h-4 w-4" />
              </a>
            </div>
          </motion.article>
        ))}

        {/* wide mobile trio */}
        <motion.article
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="group relative overflow-hidden rounded-3xl border border-line"
        >
          <img
            src={mobile}
            alt="Voice AI call screen, WhatsApp agent and ad variants on mobile — interface concept"
            loading="lazy"
            className="block w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-ground via-ground/70 to-transparent p-8 pt-24">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gold">
                Heads 03 + 06 · Concept demo
              </p>
              <h3 className="mt-2 text-2xl font-bold md:text-3xl">Voice + ads, in your customer's pocket.</h3>
            </div>
            <span className="rounded-full border border-gold/40 bg-ground/80 px-4 py-1.5 text-xs font-bold text-gold">
              &lt;1s Response · +250% ROAS
            </span>
          </div>
        </motion.article>
      </div>
    </section>
  )
}
