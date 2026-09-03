import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Arrow } from './icons.jsx'
import novaHero from '../assets/nova-hero.jpg'

/*
 * beew-style highlighted-case block: teases the Aurora Robotics concept case
 * (the page we designed for a fictional robotics company).
 */
export default function CaseTeaser() {
  return (
    <section className="container-x py-28">
      <div className="mb-12">
        <p className="eyebrow">Highlighted work</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
          Pages that feel alive.
        </h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7 }}
        className="grid items-center gap-10 lg:grid-cols-2"
      >
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-sm font-extrabold tracking-[0.15em]">AURORA ROBOTICS</span>
            <span className="chip">ROBOTICS / AI</span>
            <span className="chip border-gold/40 text-gold">CONCEPT CASE</span>
          </div>
          <h3 className="mt-5 text-2xl font-bold leading-tight md:text-4xl">
            A landing page with a living machine.
          </h3>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
            We designed a launch page for a humanoid-robotics brand where the
            hero robot literally watches the visitor — a real-time 3D machine
            that follows the cursor. Built with AI-generated design, 3D
            reconstruction and Blender assembly, in one sprint.
          </p>
          <span className="mt-5 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-bold tracking-wide text-gold">
            INTERACTIVE 3D ROBOT INSIDE
          </span>
          <div className="mt-7 flex flex-wrap gap-2">
            {['UI/UX DESIGN', 'LANDING PAGE', '3D INTERACTION', 'MOTION'].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
          <Link to="/case/aurora-robotics" className="btn-primary mt-9 inline-flex">
            View Case <Arrow className="h-4 w-4" />
          </Link>
        </div>

        <Link to="/case/aurora-robotics" className="group block overflow-hidden rounded-3xl border border-line">
          <img
            src={novaHero}
            alt="Aurora Robotics landing page concept, hero screen"
            loading="lazy"
            className="block aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </Link>
      </motion.div>
    </section>
  )
}
