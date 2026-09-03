import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Arrow } from './icons.jsx'
import robotImg from '../assets/robot-dashanan.jpg'

/* The beew-style rail cards, now a row under the full-width hero. */
export default function HeroCards() {
  return (
    <section className="container-x grid gap-4 pb-6 pt-4 md:grid-cols-2">
      <motion.a
        href="#heads"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7 }}
        className="group relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(120%_120%_at_80%_0%,#3A1508_0%,#1A0E08_60%)] p-7"
      >
        <span className="chip border-gold/40 text-gold">DASHANAN OS*</span>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight">
          Ten disciplines.
          <br />
          One war room.
        </h3>
        <p className="mt-2 text-sm text-muted">
          AI, ERP & marketing run as a single autonomous system.
        </p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold">
          Explore the arsenal
          <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-6 font-deva text-[7rem] leading-none text-ember/15"
        >
          रावण
        </span>
      </motion.a>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <Link
          to="/case/aurora-robotics"
          className="group relative block h-full overflow-hidden rounded-3xl border border-line"
        >
          <img
            src={robotImg}
            alt="Aurora Robotics concept landing page hero"
            className="block h-full min-h-52 w-full object-cover object-[center_22%] transition-transform duration-700 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-gold">
                Latest concept case
              </p>
              <p className="mt-1 font-display text-xl font-extrabold">
                Aurora Robotics — a landing page with a living machine
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-gold/40 bg-black/50 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-gold">
              View case
            </span>
          </div>
        </Link>
      </motion.div>
    </section>
  )
}
