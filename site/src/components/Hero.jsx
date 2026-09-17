import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { HEADS } from '../data/heads.js'
import { HeadIcon, Arrow } from './icons.jsx'
import ShaderGrain from './ShaderGrain.jsx'
import { PERSONA, portraitFor } from '../lib/portraits.js'
import { openRavan } from '../lib/ravan.js'

/*
 * The hero: RAVAN IN THE MIDDLE, TEN FACES. A giant MARKETING RAVAN wordmark
 * runs along the foot of the panel; a Pixar-style Ravan cut out of his
 * background stands in front of it, anchored to the bottom edge like a
 * mascot leaning into frame. He has ten heads and he shuffles them: the
 * faces snap through in a flipbook burst (hard cuts, no fades) and land on
 * the next head, which holds for a beat and says its line in the speech
 * bubble at his shoulder. The copy above says what we do, with the rotating
 * "We run your <thing>" line. Tap or click him to shuffle to the next head.
 */

/* the order heads take the stage: the site order from heads.js */
const STAGE_ORDER = HEADS.map((h) => h.icon)
const STAGE = STAGE_ORDER.map((icon) => HEADS.find((h) => h.icon === icon)).filter(Boolean)

const FLIP_MS = 80 // one face per FLIP_MS during the shuffle, each a hard cut
const HOLD_MS = 2600 // the landed head holds this long before the next shuffle
const TYPE_MS = 18 // per character: the head's line types out once it lands

/*
 * THE TEN-HEAD RAVAN MESSAGE. One line per head, keyed by the heads.js icon.
 * When a head lands it says its line in the bubble; edit the text here. A
 * head without a line falls back to its title from heads.js.
 */
export const RAVAN_MESSAGE = {
  uiux: 'Your website should win their trust in five seconds.',
  ads: 'Your Meta ads should bring enquiries, not just likes.',
  sdr: 'Your WhatsApp should answer in five seconds, day and night.',
  voice: 'Your phone should never ring unanswered.',
  social: 'Your social pages should post every day without you.',
  campaign: 'Google, YouTube and email should work as one funnel.',
  ecom: 'Your online store should sell while you sleep.',
  erp: 'Your ERP should run the business, not just record it.',
  agent: 'Your daily busywork should run itself.',
  geo: 'When people search, and when AI answers, you should show up.',
}
const sayFor = (head) => RAVAN_MESSAGE[head.icon] ?? head.title

/* the rotating word in the headline. Runs on its own clock, independent of
 * which head is on the deck, so the breadth reads quickly. Marketing first. */
const WORDS = [
  'website',
  'Meta ads',
  'social media',
  'Google ads',
  'WhatsApp',
  'customer calls',
  'online store',
  'ERP',
  'daily busywork',
  'SEO',
]
const WORD_MS = 2000

const mod = (i, n) => ((i % n) + n) % n
const LABEL_SPRING = { type: 'spring', stiffness: 260, damping: 24 }
const LABEL_EXIT = { opacity: 0, scale: 0.97, transition: { duration: 0.12 } }

/* types a line out character by character; screen readers get the whole line */
function Typed({ text, instant }) {
  const [n, setN] = useState(instant ? text.length : 0)
  useEffect(() => {
    if (instant) {
      setN(text.length)
      return
    }
    setN(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) clearInterval(id)
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [text, instant])
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {n < text.length && <span className="lineup-caret" />}
      </span>
    </>
  )
}

function Lineup({ face, landed, onAdvance, reduced }) {
  const n = STAGE.length
  const settled = landed !== null
  const head = STAGE[mod(settled ? landed : face, n)]
  const shown = mod(face, n)

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

      {/* the ten faces, all in the DOM and decoded so a swap is a single
          frame: only the one with data-on is visible, no transition */}
      <div className="lineup-float absolute inset-0">
        <div className="lineup-head" data-shuffling={settled ? undefined : 'true'}>
          {STAGE.map((h, i) => (
            <img
              key={h.icon}
              src={portraitFor(h.icon)}
              alt={i === shown ? `${PERSONA[h.icon]} — ${h.title}` : ''}
              data-on={i === shown || undefined}
              draggable="false"
              decoding="sync" /* the swap must paint in the same frame: no blank while a bitmap re-decodes */
            />
          ))}
        </div>
      </div>

      {/* what this head says: a speech bubble at his left shoulder on wide
          screens. It pops in when a head lands and is gone while he shuffles. */}
      <div className="absolute left-[1%] top-[24%] z-10 hidden w-[30%] max-w-[320px] md:block">
        <AnimatePresence initial={false}>
          {settled && (
            <motion.div
              key={landed}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={LABEL_EXIT}
              transition={reduced ? { duration: 0.2 } : LABEL_SPRING}
              className="relative rounded-2xl border border-gold/30 bg-ground/70 p-4 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md"
            >
              <span
                aria-hidden="true"
                className="absolute -right-2 top-[42%] h-4 w-4 rotate-45 border-r border-t border-gold/30 bg-ground/70"
              />
              <p className="font-display text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gold">
                Ravan says · head {String(head.n).padStart(2, '0')}
              </p>
              <p className="mt-2 font-display text-[1.05rem] font-bold leading-snug">
                <Typed text={sayFor(head)} instant={reduced} />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the label: which head is up. Wide screens: a glass card beside his
          right shoulder. */}
      <div className="absolute right-[1%] top-[30%] z-10 hidden w-[30%] max-w-[300px] md:block">
        <AnimatePresence initial={false}>
          {settled && (
            <motion.div
              key={landed}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={LABEL_EXIT}
              transition={reduced ? { duration: 0.2 } : { ...LABEL_SPRING, delay: 0.08 }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the ten-head counter follows the face on screen, even mid-shuffle,
          so the burst reads as ten heads going past */}
      <div
        className="absolute bottom-[3%] right-[3%] z-10 hidden items-center gap-1 md:flex"
        aria-hidden="true"
      >
        {STAGE.map((h, i) => (
          <span
            key={h.n}
            className={`h-1 rounded-full ${
              i === shown ? 'w-4 bg-gradient-to-r from-gold to-ember' : 'w-1 bg-ground/30'
            }`}
          />
        ))}
      </div>

      {/* phones: one block along the foot of the panel, over his chest, so
          it never covers his face: who is up, and what he says */}
      <div className="absolute bottom-2 left-1/2 z-10 w-[62%] -translate-x-1/2 md:hidden">
        <AnimatePresence initial={false}>
          {settled && (
            <motion.div
              key={landed}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={reduced ? { duration: 0.2 } : LABEL_SPRING}
              className="rounded-2xl border border-gold/30 bg-ground/75 px-3 py-2 backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-card text-gold">
                  <HeadIcon name={head.icon} className="h-2.5 w-2.5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[0.56rem] font-extrabold uppercase leading-none tracking-[0.14em] text-gold">
                  {String(head.n).padStart(2, '0')} · {PERSONA[head.icon]}
                </span>
              </div>
              <p className="mt-1.5 font-display text-[0.7rem] font-bold leading-snug">
                <Typed text={sayFor(head)} instant={reduced} />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Hero() {
  const heroRef = useRef(null)
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [word, setWord] = useState(0) // index into WORDS
  const [k, setK] = useState(0) // absolute index of the head being shuffled to / on hold
  const [face, setFace] = useState(0) // absolute index of the face on screen right now
  const [landed, setLanded] = useState(null) // k once the shuffle ends, null mid-shuffle
  const [ready, setReady] = useState(false) // every portrait decoded
  const [paused, setPaused] = useState(() => document.hidden) // a tab opened in the background waits

  // Fade the light stage into the statement as the visitor leaves the hero.
  // Write to a wrapper so the portrait's own animation keeps its transforms.
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const paint = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, -box.top / Math.max(1, box.height * .78)))
      el.style.setProperty('--bridge-shade', (progress * .96).toFixed(3))
      el.style.setProperty('--bridge-drift', `${media.matches ? 0 : progress * 65}px`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
    paint()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    media.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      media.removeEventListener('change', schedule)
    }
  }, [])

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), WORD_MS)
    return () => clearInterval(id)
  }, [reduced])

  // wait for all ten portraits so the first shuffle shows every face, not a
  // run of blanks; give up after a moment on a slow network and start anyway
  useEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setReady(true)
    }
    const imgs = STAGE.map((h) => {
      const im = new Image()
      im.src = portraitFor(h.icon)
      return im
    })
    Promise.all(imgs.map((im) => im.decode().catch(() => {}))).then(finish)
    const id = setTimeout(finish, 2500)
    return () => clearTimeout(id)
  }, [])

  // the shuffle: every time k changes, snap through all ten faces (hard cuts,
  // FLIP_MS each) ending on head k, hold for HOLD_MS, then move to k + 1. A
  // manual advance restarts the run so the head the visitor asked for gets
  // its full hold. Reduced motion: no burst, just a longer hold per head.
  useEffect(() => {
    if (!ready || paused) return
    const n = STAGE.length
    let t
    if (reduced) {
      setFace(k)
      setLanded(k)
      t = setTimeout(() => setK((v) => v + 1), HOLD_MS + 1400)
      return () => clearTimeout(t)
    }
    setLanded(null)
    let step = 0
    const tick = () => {
      step += 1
      setFace(k - n + step) // step n lands on k, after every other face went past
      if (step < n) {
        t = setTimeout(tick, FLIP_MS)
      } else {
        setLanded(k)
        t = setTimeout(() => setK((v) => v + 1), HOLD_MS)
      }
    }
    t = setTimeout(tick, FLIP_MS)
    return () => clearTimeout(t)
  }, [k, ready, paused, reduced])

  // pause while the tab is hidden so heads do not pile up on return
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const advance = () => setK((v) => v + 1)

  return (
    <section ref={heroRef} id="top" className="hero-connected container-x pt-10 pb-0 max-md:!px-0 md:pt-24 md:pb-2">
      {/* full-width hero panel */}
      <div className="hero-connected-panel theme-light relative flex min-h-[660px] flex-col overflow-hidden rounded-3xl border border-line max-md:rounded-none max-md:border-x-0 md:min-h-[580px] lg:min-h-[min(78vh,780px)]">
        {/* the grain field glides through a 30s window of shader time every
            16s: visible motion (the default 60-over-50 reads as a still
            image) without the scintillation a faster sweep causes */}
        <ShaderGrain className="absolute inset-0 z-0 h-full w-full" loopSpan={30} loopPeriod={16} speed={0.18} />

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
        {/* phones: the two words stand either side of him. The writing mode
            sits on the positioned box itself, with an explicit width, because
            Safari mis-sizes a shrink-wrapped box around vertical text and
            lost the right-hand word entirely. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[2%] left-[1.5%] z-[6] w-[13vw] select-none whitespace-nowrap font-display text-[13vw] font-extrabold leading-none tracking-[-0.04em] text-gold/60 [writing-mode:vertical-rl] md:hidden"
        >
          MARKETING
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[2%] right-[1.5%] z-[6] w-[13vw] select-none whitespace-nowrap font-display text-[13vw] font-extrabold leading-none tracking-[-0.04em] text-gold/60 [writing-mode:vertical-rl] md:hidden"
        >
          RAVAN
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
            Websites. Meta ads. Social media. WhatsApp and call agents. ERP.
            Ten expert heads, one monthly retainer.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-4 flex w-full max-w-[760px] justify-between gap-3 md:mt-4"
          >
            <button type="button" onClick={openRavan} className="btn-primary">
              Book a call <Arrow className="h-4 w-4" />
            </button>
            <button type="button" onClick={openRavan} className="btn-ghost">
              Talk to Ravan
            </button>
          </motion.div>
        </div>

        {/* Ravan, in the middle, taking whatever height is left */}
        <div className="hero-connected-mascot relative z-[5] mt-1 min-h-[280px] flex-1 md:mt-2">
          <div className="absolute bottom-0 left-1/2 h-[115%] w-[min(100%,140vh)] max-w-[1100px] -translate-x-1/2 md:h-[125%] md:max-w-[1375px]">
            <Lineup face={face} landed={landed} onAdvance={advance} reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  )
}
