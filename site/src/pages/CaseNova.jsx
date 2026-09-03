import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import RobotViewer from '../components/RobotViewer.jsx'
import Contact from '../components/Contact.jsx'
import { Arrow } from '../components/icons.jsx'
import novaHero from '../assets/nova-hero.jpg'
import novaFeatures from '../assets/nova-features.jpg'
import novaMobile from '../assets/nova-mobile.jpg'

/*
 * Concept case study, mindsphere-style: the landing page we designed for a
 * FICTIONAL robotics company. The interactive robot lives here — as client
 * work, not as our mascot.
 */

const META = [
  ['SERVICES', ['UI/UX Design', 'Landing Page', '3D Design', 'Motion & Interaction']],
  ['CATEGORY', ['Robotics', 'AI', 'Deep Tech']],
  ['TECH STACK', ['Nano Banana', 'Meshy', 'Blender', 'Three.js', 'React']],
  ['DURATION', ['1 Sprint (7 days)']],
]

const CHALLENGES = [
  'Humanoid robots photograph beautifully but feel static on a website — the product\'s whole point is that it moves and responds.',
  'Deep-tech landing pages drown visitors in specs before earning any emotional buy-in.',
  'The brand needed to feel precise and safe, not menacing — a machine you\'d let into your warehouse.',
]

const OBJECTIVES = [
  'Put a living machine above the fold: a real-time 3D robot that tracks the visitor\'s cursor, so the first interaction demonstrates responsiveness.',
  'Design an arctic white-and-cyan system — bright, safe and friendly — distinct from spec-sheet robotics sites.',
  'Keep the 3D budget under one megabyte so the page still loads instantly.',
  'Structure the page as story → proof → specs, not specs-first.',
]

const RESULTS = [
  ['A hero you play with', 'The robot answers the cursor in under a frame — the product demo is the landing page itself.'],
  ['0.7 MB of 3D', 'AI-designed parts, Meshy reconstruction and Blender decimation compress a 2.8M-triangle figure into a draco GLB lighter than a hero JPEG.'],
  ['One-sprint pipeline', 'Concept art to interactive production build in seven days, using a generative design-to-3D workflow.'],
  ['A system, not a page', 'The arctic-white/cyan tokens extend to features, telemetry dashboards and the companion app screens.'],
]

const GALLERY = [
  [novaHero, 'HOME PAGE', 'Hero with the live robot on a cyan ring stage'],
  [novaFeatures, 'FEATURES', 'Specs bento: telemetry, safety, hardware'],
  [novaMobile, 'RESPONSIVE MOBILE', 'Companion app: status, telemetry, OTA updates'],
]

export default function CaseNova() {
  // Flip the whole viewport (nav included) to the arctic light theme while
  // this case page is mounted.
  useEffect(() => {
    document.documentElement.classList.add('theme-aurora')
    return () => document.documentElement.classList.remove('theme-aurora')
  }, [])

  return (
    <>
      {/* bright airy hero with the interactive robot */}
      <section
        className="relative overflow-hidden pt-28"
        style={{ background: 'linear-gradient(180deg, #EAF3FB 0%, #F2F7FC 60%, #F2F7FC 100%)' }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[30%] h-[90vh] w-[90vh] -translate-x-1/2 rounded-full opacity-80"
          style={{
            background:
              'radial-gradient(circle, transparent 50%, rgba(46,196,222,0.12) 55%, rgba(30,155,233,0.05) 62%, transparent 70%)',
          }}
        />
        <div className="container-x relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <span className="font-display text-sm font-extrabold tracking-[0.2em] text-cream/90">AURORA ROBOTICS</span>
            <span className="chip border-gold/40 text-gold">CONCEPT CASE — FICTIONAL CLIENT</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl"
          >
            Machines with manners.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-cream/70"
          >
            A launch page for a humanoid-robotics brand where the product
            demonstrates itself: the hero robot watches your cursor and points
            after it. Move it — he's paying attention.
          </motion.p>
        </div>
        <div className="container-x relative h-[64vh] min-h-[420px]">
          <RobotViewer />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ground to-transparent" />
      </section>

      {/* metadata grid */}
      <section className="border-b border-line">
        <div className="container-x grid gap-8 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {META.map(([label, items]) => (
            <div key={label}>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">{label}</p>
              <ul className="mt-3 space-y-1.5">
                {items.map((i) => (
                  <li key={i} className="text-sm text-cream/80">{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* challenges + objectives */}
      <section className="border-b border-line bg-surface">
        <div className="container-x grid gap-14 py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Challenges</p>
            <h2 className="mt-4 text-2xl font-bold md:text-4xl">Robots read as frozen online.</h2>
            <ul className="mt-7 space-y-5">
              {CHALLENGES.map((c, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-display text-sm font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[0.95rem] leading-relaxed text-muted">{c}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Objectives</p>
            <h2 className="mt-4 text-2xl font-bold md:text-4xl">Let the product introduce itself.</h2>
            <ul className="mt-7 space-y-5">
              {OBJECTIVES.map((o, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-display text-sm font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[0.95rem] leading-relaxed text-muted">{o}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* gallery */}
      <section className="container-x py-24">
        <p className="eyebrow">The designed pages</p>
        <div className="mt-10 flex flex-col gap-10">
          {GALLERY.map(([img, label, caption]) => (
            <motion.figure
              key={label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7 }}
              className="overflow-hidden rounded-3xl border border-line bg-card"
            >
              <img src={img} alt={`Aurora Robotics ${label.toLowerCase()} design`} loading="lazy" className="block w-full" />
              <figcaption className="flex items-center justify-between px-6 py-4">
                <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">{label}</span>
                <span className="text-xs text-muted">{caption}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* results */}
      <section className="border-y border-line bg-surface">
        <div className="container-x py-24">
          <p className="eyebrow">Outcomes</p>
          <h2 className="mt-4 max-w-xl text-2xl font-bold md:text-4xl">
            What this concept proves.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {RESULTS.map(([title, body]) => (
              <div key={title} className="rounded-3xl border border-line bg-card p-7">
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-muted">
            Aurora Robotics is a fictional brand created to showcase our design +
            generative-3D pipeline. Want this treatment on a real product? That's Head 08.
          </p>
        </div>
      </section>

      {/* case nav */}
      <section className="container-x flex flex-wrap items-center justify-between gap-4 py-14">
        <Link to="/works" className="btn-ghost">
          <Arrow className="h-4 w-4 rotate-180" /> All Projects
        </Link>
        <Link to="/contact" className="btn-primary">
          Start yours <Arrow className="h-4 w-4" />
        </Link>
      </section>

      <Contact />
    </>
  )
}
