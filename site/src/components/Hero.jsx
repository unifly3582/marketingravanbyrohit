import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import ShaderGrain from './ShaderGrain.jsx'

/*
 * The hero: RAVAN IN THE MIDDLE. A giant MARKETING RAVAN wordmark runs along
 * the foot of the panel; one of the ten heads (a Pixar-style Ravan cut out of
 * his background, props matching the work he does) stands in front of it,
 * anchored to the bottom edge like a mascot leaning into frame. The copy above
 * says what we do, with the rotating "We run your <thing>" line. A small glass
 * label at his shoulder names the head on stage; every few seconds he drops
 * away and the next one rises. Tap or click him to advance.
 */

/* the portraits, keyed by heads.js icon. One personality take per head; the
 * alternates (`*-2`) are generated alongside and can be swapped in here. */
const PORTRAITS = import.meta.glob('../assets/agents/*.webp', { eager: true, import: 'default' })
const PICK = {
  agent: 'agent-1',
  sdr: 'sdr-2',
  voice: 'voice-1',
  geo: 'geo-1',
  erp: 'erp-1',
  ads: 'ads-1',
  bi: 'bi-1',
  uiux: 'uiux-1',
  api: 'api-1',
  shield: 'shield-1',
}
const portraitFor = (icon) => PORTRAITS[`../assets/agents/${PICK[icon] ?? icon + '-1'}.webp`]

/* the persona each head plays on its card */
const PERSONA = {
  agent: 'The Operator',
  sdr: 'The Closer',
  voice: 'The Orator',
  geo: 'The Sage',
  erp: 'The Quartermaster',
  ads: 'The Showman',
  bi: 'The Oracle',
  uiux: 'The Artisan',
  api: 'The Engineer',
  shield: 'The Guardian',
}

/* the order heads take the front of the deck: marketing first, then web,
 * sales, ops. Drives the card and the rotating headline word together. */
const STAGE_ORDER = ['ads', 'geo', 'uiux', 'sdr', 'voice', 'agent', 'erp', 'api', 'bi', 'shield']
const STAGE = STAGE_ORDER.map((icon) => HEADS.find((h) => h.icon === icon)).filter(Boolean)
const DECK_MS = 4200 // a new head steps up every DECK_MS

/* the rotating word in the headline. Runs on its own clock, independent of
 * which head is on the deck, so the breadth reads quickly. Marketing first. */
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

/* the swap: the outgoing head sinks back into the panel edge while the next
 * one rises up through it */
const ENTER = { y: 90, opacity: 0, scale: 0.94 }
const STAND = { y: 0, opacity: 1, scale: 1 }
const EXIT = { y: 70, opacity: 0, scale: 0.96 }
const SPRING = { type: 'spring', stiffness: 150, damping: 20, mass: 0.9 }
const LABEL_SPRING = { type: 'spring', stiffness: 220, damping: 24, delay: 0.12 }

function Lineup({ k, onAdvance, reduced }) {
  const n = STAGE.length
  const head = STAGE[k % n]
  const swap = reduced ? { duration: 0.25 } : SPRING

  return (
    <div
      className="relative h-full w-full cursor-pointer select-none"
      onClick={onAdvance}
      role="button"
      tabIndex={0}
      aria-label={`Head ${head.n}: ${head.title}. Show the next head`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdvance()
        }
      }}
    >
      <div className="lineup-glow" aria-hidden="true" />

      {/* the head */}
      <div className="lineup-float absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={k}
            className="lineup-head"
            initial={reduced ? { opacity: 0 } : ENTER}
            animate={STAND}
            exit={reduced ? { opacity: 0 } : EXIT}
            transition={swap}
          >
            <img
              src={portraitFor(head.icon)}
              alt={`${PERSONA[head.icon]} — ${head.title}`}
              draggable="false"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the label. Wide screens: a glass card beside his shoulder. Phones:
          a slim one-line pill along the foot of the panel, over his chest,
          so it never covers his face. */}
      <div className="absolute right-[1%] top-[30%] z-10 hidden w-[30%] max-w-[300px] md:block">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } }}
            transition={reduced ? { duration: 0.2 } : LABEL_SPRING}
            className="rounded-2xl border border-gold/30 bg-ground/70 p-4 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-card text-gold">
                <HeadIcon name={head.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="font-display text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gold">
                Head {String(head.n).padStart(2, '0')} · {PERSONA[head.icon]}
              </span>
            </div>
            <p className="mt-2 font-display text-[0.95rem] font-bold leading-snug">{head.title}</p>
            <p className="mt-0.5 text-[0.7rem] font-extrabold tracking-wide">
              <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">
                {head.metric}
              </span>
            </p>
            {/* which head is up */}
            <div className="mt-2.5 flex items-center gap-1" aria-hidden="true">
              {STAGE.map((h) => (
                <span
                  key={h.n}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    h.n === head.n ? 'w-4 bg-gradient-to-r from-gold to-ember' : 'w-1 bg-cream/25'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute bottom-2 left-1/2 z-10 w-[56%] -translate-x-1/2 md:hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            transition={reduced ? { duration: 0.2 } : LABEL_SPRING}
            className="flex items-center gap-2 rounded-full border border-gold/30 bg-ground/75 py-1.5 pl-1.5 pr-3 backdrop-blur-md"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-card text-gold">
              <HeadIcon name={head.icon} className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-[0.58rem] font-extrabold uppercase leading-none tracking-[0.14em] text-gold">
              {String(head.n).padStart(2, '0')} · {PERSONA[head.icon]}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Hero() {
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [word, setWord] = useState(0) // index into WORDS
  const [k, setK] = useState(0) // absolute index of the head at the front
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), WORD_MS)
    return () => clearInterval(id)
  }, [reduced])

  // the lineup auto-plays; a manual advance restarts the timer so the head
  // the visitor asked for gets its full hold
  useEffect(() => {
    if (reduced || paused) return
    const id = setInterval(() => setK((v) => v + 1), DECK_MS)
    return () => clearInterval(id)
  }, [reduced, paused, k])

  // pause while the tab is hidden so heads do not pile up on return
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const advance = () => setK((v) => v + 1)

  return (
    <section id="top" className="container-x pt-[5.5rem] pb-0 max-md:!px-0 md:pt-24 md:pb-2">
      {/* full-width hero panel */}
      <div className="theme-light relative flex min-h-[660px] flex-col overflow-hidden rounded-3xl border border-line max-md:rounded-none max-md:border-x-0 md:min-h-[580px] lg:min-h-[min(78vh,780px)]">
        <ShaderGrain className="absolute inset-0 z-0 h-full w-full" />

        {/* the wordmark along the foot of the panel, behind Ravan */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[0.2em] left-[0.5%] z-[1] hidden select-none whitespace-nowrap font-display text-[clamp(2rem,8.2vw,10rem)] font-extrabold leading-none tracking-[-0.045em] md:block"
        >
          <span className="bg-gradient-to-b from-gold/60 to-ember/25 bg-clip-text text-transparent">MARKETING</span>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[0.2em] right-[7%] z-[1] hidden select-none whitespace-nowrap font-display text-[clamp(2rem,8.2vw,10rem)] font-extrabold leading-none tracking-[-0.045em] md:block"
        >
          <span className="bg-gradient-to-b from-gold/60 to-ember/25 bg-clip-text text-transparent">RAVAN</span>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[2%] left-[1.5%] z-[6] select-none font-display text-[13vw] font-extrabold leading-none tracking-[-0.04em] md:hidden"
        >
          <span className="block text-gold/60 [writing-mode:vertical-rl]">MARKETING</span>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[2%] right-[1.5%] z-[6] select-none font-display text-[13vw] font-extrabold leading-none tracking-[-0.04em] md:hidden"
        >
          <span className="block text-gold/60 [writing-mode:vertical-rl]">RAVAN</span>
        </div>

        {/* what we do */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-4 text-center md:px-12 md:pt-9">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow !justify-center whitespace-nowrap !text-[0.56rem] !tracking-[0.14em] md:!text-[0.7rem] md:!tracking-[0.18em]"
          >
            Your complete digital growth team
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-2 max-w-4xl text-[1.9rem] font-bold leading-[1.1] md:mt-4 md:text-[3.3rem] md:leading-[1.05]"
          >
            We run your{' '}
            <br className="md:hidden" />
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
            className="mt-3 max-w-lg text-[0.82rem] leading-relaxed text-muted md:mt-4 md:max-w-none md:whitespace-nowrap md:text-[0.95rem]"
          >
            Ads. SEO. Websites. AI agents. Voice. ERP. Ten expert heads, one
            monthly retainer.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-4 flex w-full max-w-[760px] justify-between gap-3 md:mt-4"
          >
            <a href="/contact" className="btn-primary">
              Book a call <Arrow className="h-4 w-4" />
            </a>
            <a href="#heads" className="btn-ghost">
              <span className="md:hidden">What we do</span>
              <span className="hidden md:inline">See everything we do</span>
            </a>
          </motion.div>
        </div>

        {/* Ravan, in the middle, taking whatever height is left */}
        <div className="relative z-[5] mt-1 min-h-[280px] flex-1 md:mt-2">
          <div className="absolute bottom-0 left-1/2 h-[115%] w-[min(100%,140vh)] max-w-[1100px] -translate-x-1/2 md:h-[125%] md:max-w-[1375px]">
            <Lineup k={k} onAdvance={advance} reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  )
}
