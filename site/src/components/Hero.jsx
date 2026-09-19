import { useEffect, useRef, useState } from 'react'
import { HEADS } from '../data/heads.js'
import { HeadIcon } from './icons.jsx'
import ShaderGrain from './ShaderGrain.jsx'
import { PERSONA, portraitFor } from '../lib/portraits.js'

/*
 * The hero: RAVAN IN THE MIDDLE, TEN FACES. A giant MARKETING RAVAN wordmark
 * runs along the foot of the panel; a Pixar-style Ravan cut out of his
 * background stands in front of it, anchored to the bottom edge like a
 * mascot leaning into frame. He has ten heads and they never stop turning:
 * the face flickers through all ten on a fast clock (hard cuts, no fade),
 * while the text beside him moves on a slow clock, naming one head and what
 * it does for a few seconds at a time. The copy above says what we do in the
 * site's two words, grow and automate. Tap or click him to move the text on
 * to the next head right away.
 */

/* the order heads take the stage: the site order from heads.js */
const STAGE_ORDER = HEADS.map((h) => h.icon)
const STAGE = STAGE_ORDER.map((icon) => HEADS.find((h) => h.icon === icon)).filter(Boolean)

const FACE_MS = 400 // the face flickers to the next head every FACE_MS (fast)
const TEXT_MS = 3000 // the text moves to the next head every TEXT_MS (slow)

/*
 * THE TEN-HEAD RAVAN MESSAGE. One line per head, keyed by the heads.js icon:
 * what that head does, shown beside him for the beat his face is up. Edit
 * the text here. A head without a line falls back to its title from heads.js.
 */
export const RAVAN_MESSAGE = {
  uiux: 'Builds the website people trust.',
  ads: 'Runs Meta ads that bring enquiries.',
  sdr: 'Answers WhatsApp in seconds, 24/7.',
  voice: 'Picks up every call, in Indian languages.',
  social: 'Posts on your social pages every day.',
  campaign: 'Runs Google, YouTube and email as one funnel.',
  ecom: 'Runs and grows your online store.',
  erp: 'Runs your ERP and keeps the data clean.',
  agent: 'Automates the daily busywork.',
  geo: 'Gets you found on Google and in AI answers.',
}
const sayFor = (head) => RAVAN_MESSAGE[head.icon] ?? head.title

const mod = (i, n) => ((i % n) + n) % n


function Lineup({ k, warm, headRef, wordRef, onAdvance }) {
  const n = STAGE.length
  const head = STAGE[mod(k, n)] // the head the text is about (slow clock)
  // The face on screen is written straight to the DOM by Hero (showFace):
  // data-on on the images and the readout's text. React renders them once,
  // for the first face, and never touches those attributes again because
  // their props never change between renders.

  return (
    <div className="relative h-full w-full cursor-pointer select-none" onClick={onAdvance}>
      {/* keyboard and screen-reader users get a real button; pointer users
          can tap anywhere on him */}
      <button
        type="button"
        className="sr-only"
        onClick={(e) => {
          e.stopPropagation()
          onAdvance()
        }}
      >
        Head {head.n}: {head.title}. Show the next head
      </button>
      <div className="lineup-glow" aria-hidden="true" />

      {/* the ten faces, all in the DOM and decoded so a swap is a single
          frame: only the one with data-on is visible, no transition. The
          first face is preloaded from index.html and fetched at high
          priority; the other nine get their src only once it has painted
          (`warm`), so they never compete with it for bandwidth. */}
      <div className="lineup-float absolute inset-0">
        <div className="lineup-head" ref={headRef}>
          {STAGE.map((h, i) => (
            <img
              key={h.icon}
              src={i === 0 || warm ? portraitFor(h.icon) : undefined}
              width="720"
              height="720"
              alt={`${PERSONA[h.icon]} — ${h.title}`} /* hidden faces are visibility:hidden: out of the accessibility tree */
              data-on={i === 0 ? '' : undefined}
              draggable="false"
              fetchPriority={i === 0 ? 'high' : undefined}
              /* the first face paints in the first frame; the others decode
                 off the frame's path, and are all decoded (Image.decode)
                 before the flicker is allowed to show them */
              decoding={i === 0 ? 'sync' : 'async'}
            />
          ))}
        </div>
      </div>

      {/* what this head does: a speech bubble at his left shoulder on wide
          screens, on the slow clock */}
      <div className="absolute left-[1%] top-[24%] z-10 hidden w-[30%] max-w-[320px] md:block">
        <div className="relative rounded-2xl border border-gold/30 bg-ground/70 p-4 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md">
          <span
            aria-hidden="true"
            className="absolute -right-2 top-[42%] h-4 w-4 rotate-45 border-r border-t border-gold/30 bg-ground/70"
          />
          <p className="font-display text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gold">
            Head {String(head.n).padStart(2, '0')} · {PERSONA[head.icon]}
          </p>
          <p className="mt-1.5 font-display text-[1.15rem] font-extrabold uppercase leading-tight tracking-wide">{head.short}</p>
          <p className="mt-1 text-[0.85rem] font-semibold leading-snug text-muted">{sayFor(head)}</p>
        </div>
      </div>

      {/* the promise: a glass card beside his right shoulder */}
      <div className="absolute right-[1%] top-[30%] z-10 hidden w-[30%] max-w-[300px] md:block">
        <div className="rounded-2xl border border-gold/30 bg-ground/70 p-4 shadow-[0_18px_50px_rgba(28,17,9,0.18)] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-card text-gold">
              <HeadIcon name={head.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gold">
              {head.short}
            </span>
          </div>
          <p className="mt-2 font-display text-[0.95rem] font-bold leading-snug">{head.title}</p>
          <p className="mt-0.5 text-[0.7rem] font-extrabold tracking-wide">
            <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">{head.metric}</span>
          </p>
        </div>
      </div>

      {/* the ten-head counter follows the text, not the flicker */}
      <div className="absolute bottom-[3%] right-[3%] z-10 hidden items-center gap-1 md:flex" aria-hidden="true">
        {STAGE.map((h, i) => (
          <span
            key={h.n}
            className={`h-1 rounded-full ${
              h.n === head.n ? 'w-4 bg-gradient-to-r from-gold to-ember' : 'w-1 bg-ground/30'
            }`}
          />
        ))}
      </div>

      {/* phones: the readout along the foot of the panel, over his chest,
          naming the face on screen in the same beat as the flicker. It sits
          just above the panel's bottom fade (--section-overlap) so the blend
          into the next section never washes it out. */}
      <div className="absolute bottom-[calc(var(--section-overlap,0px)+0.5rem)] left-1/2 z-10 w-[84vw] max-w-[360px] -translate-x-1/2 md:hidden">
        <div className="lineup-alien">
          <p className="lineup-alien-word" aria-hidden="true" ref={wordRef}>{STAGE[0].short}</p>
          <p className="sr-only">
            Ten heads: {STAGE.map((h) => h.short.toLowerCase()).join(', ')}.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  const heroRef = useRef(null)
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [k, setK] = useState(0) // absolute index of the head the text is about
  const faceRef = useRef(0) // index of the face on screen (fast clock), kept off React
  const headRef = useRef(null) // the .lineup-head element (the ten images)
  const wordRef = useRef(null) // the phone readout
  const [paused, setPaused] = useState(() => document.hidden) // a tab opened in the background waits
  const [painted, setPainted] = useState(false) // the first face has been presented
  const [warm, setWarm] = useState(false) // ...and the browser had a quiet moment: the other nine may load
  const [ready, setReady] = useState(false) // all ten faces decoded
  const [hold, setHold] = useState(false) // the first face has been on screen a beat: the flicker may run

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
    schedule() // through a frame: reading layout right here would force one mid-commit
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

  // The first face first: two animation frames after mount it has been
  // presented (the largest paint of the page, fetched from index.html's
  // preload). Only then, in a quiet moment, do the other nine load, so
  // nothing competes with that first frame; then all ten are decoded so no
  // beat of the flicker ever shows a blank face.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setPainted(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (!painted) return
    let gone = false
    const go = () => !gone && setWarm(true)
    const id = 'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300)
    return () => {
      gone = true
      ;('cancelIdleCallback' in window ? cancelIdleCallback : clearTimeout)(id)
    }
  }, [painted])
  useEffect(() => {
    if (!warm) return
    let gone = false
    Promise.all(
      STAGE.slice(1).map((h) => {
        const im = new Image()
        im.src = portraitFor(h.icon)
        return im.decode().catch(() => {})
      }),
    ).then(() => !gone && setReady(true))
    return () => { gone = true }
  }, [warm])
  // the first face holds the stage for a beat before the flicker takes over
  useEffect(() => {
    if (!painted) return
    const timer = setTimeout(() => setHold(true), 1600)
    return () => clearTimeout(timer)
  }, [painted])

  // put face i on screen: data-on on the images, the readout's word
  const showFace = (i) => {
    const host = headRef.current
    if (!host) return
    const imgs = host.children
    for (let j = 0; j < imgs.length; j++) {
      if (j === i) imgs[j].setAttribute('data-on', '')
      else imgs[j].removeAttribute('data-on')
    }
    if (wordRef.current) wordRef.current.textContent = STAGE[i].short
    faceRef.current = i
  }

  // the faces never stop: a fast flicker through all ten. Reduced motion
  // drops the flicker and shows the face the text is about instead.
  useEffect(() => {
    if (paused || reduced || !ready || !hold) return
    const id = setInterval(() => showFace(mod(faceRef.current + 1, STAGE.length)), FACE_MS)
    return () => clearInterval(id)
  }, [paused, reduced, ready, hold])
  useEffect(() => {
    if (reduced) showFace(mod(k, STAGE.length))
  }, [reduced, k])

  // the text moves on its own slow clock. A manual advance restarts it so the
  // head the visitor asked for gets its full time.
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setK((v) => v + 1), TEXT_MS)
    return () => clearInterval(id)
  }, [k, paused])

  // pause while the tab is hidden so heads do not pile up on return
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const advance = () => setK((v) => v + 1)

  return (
    <section ref={heroRef} id="top" className="hero-connected container-x pt-10 pb-0 max-md:!px-0 md:pt-24 md:pb-2">
      {/* full-width hero panel. Phones: exactly one screen (the small
          viewport, so browser chrome never hides the foot) minus the header
          padding, so copy, head and readout all sit above the fold. */}
      <div className="hero-connected-panel theme-light relative flex min-h-[660px] flex-col overflow-hidden rounded-3xl border border-line max-md:min-h-0 max-md:rounded-none max-md:border-x-0 md:min-h-[580px] lg:min-h-[min(78vh,780px)]">
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
          <p className="hero-rise eyebrow !justify-center whitespace-nowrap !text-[0.56rem] !tracking-[0.14em] md:!text-[0.7rem] md:!tracking-[0.18em]">
            Your complete digital growth team
          </p>
          <h1 className="hero-rise hero-rise-2 mt-2 max-w-4xl text-[1.9rem] font-bold leading-[1.1] md:mt-4 md:text-[3.3rem] md:leading-[1.05]">
            We grow your business
            <br />
            <span className="bg-gradient-to-r from-gold to-ember bg-clip-text text-transparent">
              and let AI do the daily work.
            </span>
          </h1>
          <p className="hero-rise hero-rise-3 mt-3 max-w-lg text-[0.82rem] leading-relaxed text-muted md:mt-4 md:max-w-none md:whitespace-nowrap md:text-[0.95rem]">
            <span className="md:hidden">
              Five heads to get you seen. Five AI agents to run the work. One monthly retainer.
            </span>
            <span className="hidden md:inline">
              Website, ads, social, campaigns and search to get you seen.
              WhatsApp, call, store, ERP and automation agents to run the work.
              <br />
              Ten heads, one monthly retainer.
            </span>
          </p>
        </div>

        {/* Ravan, in the middle, taking whatever height is left (the copy
            block ends at the subline: no buttons, the header carries the CTA) */}
        <div className="hero-connected-mascot relative z-[5] mt-0 min-h-[300px] flex-1 md:mt-2">
          {/* phones: the box is sized by height (square, like the portraits)
              so the head grows into all the room under the copy instead of
              being capped by the screen width; the panel clips the shoulders */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 max-md:aspect-square max-md:h-full max-md:w-auto md:h-[125%] md:w-[min(100%,140vh)] md:max-w-[1375px]">
            <Lineup k={k} warm={warm} headRef={headRef} wordRef={wordRef} onAdvance={advance} />
          </div>
        </div>
      </div>
    </section>
  )
}
