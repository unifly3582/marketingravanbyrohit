import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import Works from '../components/Works.jsx'
import Contact from '../components/Contact.jsx'
import { Arrow } from '../components/icons.jsx'
import novaHero from '../assets/nova-hero.jpg'

export default function WorksPage() {
  return (
    <>
      <section className="container-x pt-36 pb-6">
        <p className="eyebrow">Works</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold md:text-6xl">
          Work that moves revenue.
        </h1>
        <p className="mt-5 max-w-lg text-muted">
          Concept builds and case studies from the ten heads — every system
          here is one we deploy on client funnels, ops and brands.
        </p>
      </section>

      {/* featured case */}
      <section className="container-x py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
        >
          <Link to="/case/aurora-robotics" className="group relative block overflow-hidden rounded-3xl border border-line">
            <img
              src={novaHero}
              alt="Aurora Robotics landing page concept"
              className="block aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-8">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-sm font-extrabold tracking-[0.15em]">AURORA ROBOTICS</span>
                  <span className="chip border-gold/40 text-gold">CONCEPT CASE</span>
                </div>
                <h2 className="mt-3 text-2xl font-bold md:text-4xl">
                  A landing page with a living machine.
                </h2>
              </div>
              <span className="btn-primary">View Case <Arrow className="h-4 w-4" /></span>
            </div>
          </Link>
        </motion.div>
      </section>

      <Works />
      <Contact />
    </>
  )
}
