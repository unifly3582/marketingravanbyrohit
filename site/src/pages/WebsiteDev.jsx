import { memo, useCallback, useEffect, useRef } from 'react'
import { useScrub, seg, lerp, easeOut, easeIn, easeInOut, backOut } from '../lib/scrub.js'
import { openRavan } from '../lib/ravan.js'
import './website-dev.css'

/*
 * Website Development: a scrolled story, one scene after another, each a
 * tall section with a sticky stage. The beats follow a kinetic-type reel
 * (word reveal on a gradient → a wall of work sliding in by rows → a stack
 * of stickers slapping down → giant letters "to the next level" → a
 * typewriter, a blinking eye, a photo growing behind "in every detail" →
 * "We are open to bold ideas" → the wordmark). Every scene is scrubbed by
 * scroll, so it plays forwards, backwards and at the reader's pace.
 */

/* the pictures: nano banana renders, see scripts/gen-webdev.mjs */
const PICS = import.meta.glob('../assets/webdev/*.webp', { eager: true, import: 'default' })
const pic = (name) => PICS[`../assets/webdev/${name}.webp`]

const WALL = [
  ['ev', 'Volt electric scooters'],
  ['fintech', 'Paisa fintech app'],
  ['villa', 'Meridian residences'],
  ['skincare', 'Aura skincare'],
  ['saas', 'Signal analytics'],
  ['restaurant', 'Ember & Oak restaurant'],
  ['fashion', 'Roadhouse streetwear'],
  ['travel', 'Northbound travel'],
  ['clinic', 'Bright Dental clinic'],
  ['coaching', 'Ascend coaching'],
  ['jewellery', 'Aarna jewellery'],
  ['architecture', 'Studio Bhoomi architects'],
]
const ROWS = 4
const PER_ROW = 9

const STICKERS = [
  { img: 'window', title: 'Landing pages that convert', line: 'Every scroll leads to one button.', tone: 'cream' },
  { img: 'bag', title: 'Stores that sell while you sleep', line: 'Catalogue, checkout, WhatsApp order alerts.', tone: 'dark' },
  { img: 'speed', title: 'Loads in under a second', line: 'Speed is a feature. Google agrees.', tone: 'gold' },
  { img: 'orb', title: 'Ravan built in', line: 'An AI agent that answers on your site, in your voice.', tone: 'dark' },
  { img: 'crown', title: 'A brand worth remembering', line: 'A look that is yours. Not a template.', tone: 'cream' },
]
const STICKER_ROT = [-7, 9, -4, 12, -9]

const HERO_WORDS = ["Don't", 'settle', 'for', 'an', 'ordinary', 'website.']
const WALL_WORDS = ['Unleash', 'your', "brand's", 'power.']
const TYPE_A = 'Outstanding style and exceptional'
const TYPE_B = 'in every detail'
const OPEN_WORDS = ['open', 'to', 'bold', 'ideas']

const px = (n) => `${n.toFixed(2)}px`
const setOpacity = (el, v) => {
  el.style.opacity = v.toFixed(3)
}

/* a scalloped squircle for the stickers, sampled once as a clip-path polygon */
const SEAL = (() => {
  const pts = []
  const N = 120
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    const squircle = 1 / Math.pow(Math.abs(c) ** 4 + Math.abs(s) ** 4, 1 / 4)
    const r = 0.47 * squircle * (1 + 0.045 * Math.cos(12 * a))
    pts.push(`${(50 + r * c * 100).toFixed(2)}% ${(50 + r * s * 100).toFixed(2)}%`)
  }
  return `polygon(${pts.join(',')})`
})()

const Sparkle = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M12 1.5c.6 5.3 2.7 8.9 10.5 10.5C14.7 13.6 12.6 17.2 12 22.5 11.4 17.2 9.3 13.6 1.5 12 9.3 10.4 11.4 6.8 12 1.5Z" />
  </svg>
)

/* ---------- scene 1: don't settle ---------- */
function HeroScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el, vh }) => {
    const words = el.querySelectorAll('.wd-hero-w')
    words.forEach((w, i) => {
      const a = easeOut(seg(p, 0.06 + i * 0.065, 0.15 + i * 0.065))
      // the line drops out of the frame, the words a beat apart
      const out = easeIn(seg(p, 0.72 + i * 0.015, 0.92 + i * 0.015))
      setOpacity(w, a)
      w.style.filter = a < 0.98 ? `blur(${(8 * (1 - a)).toFixed(1)}px)` : ''
      w.style.transform = `translateY(${((1 - a) * 0.4).toFixed(3)}em) translateY(${px(out * vh * 1.2)}) rotate(${(out * (i % 2 ? 4 : -4)).toFixed(2)}deg)`
    })
    const sp = el.querySelector('.wd-hero-sparkle')
    const s = seg(p, 0.42, 0.5) * (1 - seg(p, 0.66, 0.72))
    sp.style.transform = `scale(${backOut(s).toFixed(3)}) rotate(${((1 - s) * 120).toFixed(1)}deg)`
    setOpacity(sp, s)
    setOpacity(el.querySelector('.wd-grad'), 1 - seg(p, 0.84, 1))
    setOpacity(el.querySelector('.wd-hero-hint'), 1 - seg(p, 0, 0.08))
    setOpacity(el.querySelector('.wd-hero-eyebrow'), 1 - seg(p, 0.7, 0.8))
  }, [])
  useScrub(ref, paint)
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 2.6 }}>
      <div className="wd-stage">
        <div className="wd-grad" />
        <p className="wd-hero-eyebrow eyebrow">Head 01 · Website development</p>
        <h1 className="wd-hero-line">
          <span className="sr-only">{HERO_WORDS.join(' ')}</span>
          <span aria-hidden="true" className="wd-hero-words">
            {HERO_WORDS.map((w, i) => (
              <span key={i} className="wd-hero-w" style={{ opacity: 0 }}>
                {w}
              </span>
            ))}
            <Sparkle className="wd-hero-sparkle" />
          </span>
        </h1>
        <p className="wd-hero-hint">
          <span>scroll</span>
          <i />
        </p>
      </div>
    </section>
  )
}

/* ---------- scene 2: the wall of work ---------- */
function WallScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el }) => {
    const rows = el.querySelectorAll('.wd-row')
    rows.forEach((row, r) => {
      const dir = r % 2 ? 1 : -1
      const a = easeOut(seg(p, 0.02 + r * 0.06, 0.34 + r * 0.06))
      const out = easeIn(seg(p, 0.7 + r * 0.05, 0.94 + r * 0.05))
      row.style.transform = `translateX(${(dir * (-(1 - a) * 108 + out * 108)).toFixed(2)}%)`
    })
    const words = el.querySelectorAll('.wd-wall-w')
    const fade = 1 - seg(p, 0.88, 0.96)
    words.forEach((w, i) => {
      const a = easeOut(seg(p, 0.36 + i * 0.035, 0.44 + i * 0.035))
      setOpacity(w, a * fade)
      w.style.transform = `translateY(${((1 - a) * 0.5).toFixed(3)}em)`
      w.style.filter = a < 0.98 ? `blur(${(6 * (1 - a)).toFixed(1)}px)` : ''
    })
  }, [])
  useScrub(ref, paint)
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 3.4 }}>
      <div className="wd-stage wd-stage-dark">
        <div className="wd-wall" aria-label="Website concepts we have designed">
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} className={`wd-row${r === 1 ? ' wd-row-gap' : ''}`} style={{ transform: `translateX(${r % 2 ? 108 : -108}%)` }}>
              {Array.from({ length: PER_ROW }, (_, i) => {
                const [key, name] = WALL[(r * 3 + i) % WALL.length]
                return (
                  <figure key={i} className="wd-shot">
                    <img src={pic(`wall-${key}`)} alt={i < 3 ? `${name} website concept` : ''} width="480" height="853" loading="lazy" decoding="async" draggable="false" />
                  </figure>
                )
              })}
            </div>
          ))}
        </div>
        <h2 className="wd-wall-line">
          <span className="sr-only">{WALL_WORDS.join(' ')}</span>
          <span aria-hidden="true">
            {WALL_WORDS.map((w, i) => (
              <span key={i} className="wd-wall-w" style={{ opacity: 0 }}>
                {w}
              </span>
            ))}
          </span>
        </h2>
      </div>
    </section>
  )
}

/* ---------- scene 3: the sticker stack ---------- */
function StackScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el }) => {
    const cards = el.querySelectorAll('.wd-sticker')
    let landed = 0
    cards.forEach((c, i) => {
      const t0 = 0.06 + i * 0.15
      const a = seg(p, t0, t0 + 0.11)
      const e = easeOut(a)
      if (a > 0.5) landed = i + 1
      const rot = STICKER_ROT[i]
      c.style.transform = `rotate(${(rot - 38 * (1 - e)).toFixed(2)}deg) scale(${lerp(1.7, 1, e).toFixed(3)}) translateY(${((1 - e) * -14).toFixed(2)}%)`
      setOpacity(c, Math.min(1, a * 3))
    })
    const stack = el.querySelector('.wd-stack')
    const out = easeIn(seg(p, 0.88, 1))
    stack.style.transform = `scale(${lerp(1, 0.6, out).toFixed(3)})`
    setOpacity(stack, 1 - out)
    const count = el.querySelector('.wd-stack-count b')
    const n = String(Math.max(1, landed)).padStart(2, '0')
    if (count.textContent !== n) count.textContent = n
    setOpacity(el.querySelector('.wd-stack-head'), seg(p, 0, 0.06) * (1 - seg(p, 0.86, 0.94)))
  }, [])
  useScrub(ref, paint)
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 3 }}>
      <div className="wd-stage wd-stage-dark">
        <div className="wd-stack-head">
          <p className="eyebrow">What every Ravan site ships with</p>
          <p className="wd-stack-count">
            <b>01</b>
            <span>/ {String(STICKERS.length).padStart(2, '0')}</span>
          </p>
        </div>
        <div className="wd-stack" style={{ '--seal': SEAL }}>
          {STICKERS.map((s, i) => (
            <article key={s.img} className={`wd-sticker is-${s.tone}`} style={{ opacity: 0, zIndex: i + 1 }}>
              <img src={pic(`card-${s.img}`)} alt="" width="512" height="512" loading="lazy" decoding="async" draggable="false" />
              <h3>{s.title}</h3>
              <p>{s.line}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- scene 4: to the next level ---------- */
function KineticScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el, vw }) => {
    setOpacity(el.querySelector('.wd-grad'), seg(p, 0, 0.08) * (1 - seg(p, 0.6, 0.68)))
    const tothe = el.querySelector('.wd-k-tothe')
    const a = easeOut(seg(p, 0.02, 0.32))
    const gone = easeInOut(seg(p, 0.38, 0.5))
    tothe.style.transform = `translateY(${(-gone * 120).toFixed(1)}%) scale(${lerp(4.2, 1, a).toFixed(3)})`
    tothe.style.letterSpacing = `${lerp(0.32, -0.03, a).toFixed(3)}em`
    setOpacity(tothe, seg(p, 0.02, 0.1) * (1 - gone))
    const next = el.querySelector('.wd-k-next')
    const c = easeOut(seg(p, 0.42, 0.58))
    setOpacity(next, seg(p, 0.42, 0.48) * (1 - seg(p, 0.6, 0.66)))
    next.querySelectorAll('span').forEach((l, i) => {
      l.style.transform = `translateX(${((i - 1.5) * lerp(0.9, 0, c)).toFixed(3)}em)`
    })
    const level = el.querySelector('.wd-k-level')
    setOpacity(level, seg(p, 0.64, 0.7) * (1 - seg(p, 0.86, 0.9)))
    const d = easeInOut(seg(p, 0.7, 0.88))
    const grow = easeIn(seg(p, 0.9, 1))
    const R = el.querySelector('.wd-k-circle-r')
    const L = el.querySelector('.wd-k-circle-l')
    const size = L.offsetWidth || 1
    const off = vw / 2 + size // fully off-screen
    const s = lerp(1, (Math.max(vw, window.innerHeight) * 2.2) / size, grow)
    L.style.transform = `translate(${px(lerp(-off, 0, d))}, ${px(lerp(0, -size * 0.32, d) * (1 - grow))}) scale(${s.toFixed(3)})`
    R.style.transform = `translate(${px(lerp(off, 0, d))}, ${px(lerp(0, size * 0.32, d) * (1 - grow))}) scale(${s.toFixed(3)})`
  }, [])
  useScrub(ref, paint)
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 3.4 }}>
      <div className="wd-stage wd-stage-dark">
        <div className="wd-grad" style={{ opacity: 0 }} />
        <h2 className="sr-only">Take your brand to the next level</h2>
        <div className="wd-k" aria-hidden="true">
          <div className="wd-k-tothe" style={{ opacity: 0 }}>to the</div>
          <div className="wd-k-next" style={{ opacity: 0 }}>
            {['n', 'e', 'x', 't'].map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div className="wd-k-level" style={{ opacity: 0 }}>level</div>
          <i className="wd-k-circle wd-k-circle-l" />
          <i className="wd-k-circle wd-k-circle-r" />
        </div>
      </div>
    </section>
  )
}

/* ---------- scene 5: style, the eye, quality, every detail ---------- */
function DetailScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el }) => {
    setOpacity(el.querySelector('.wd-grad'), 1 - seg(p, 0.3, 0.36))

    // the star, then the first line typed with a bracket cursor
    const star = el.querySelector('.wd-d-star')
    const s = seg(p, 0.02, 0.08) * (1 - seg(p, 0.27, 0.3))
    star.style.transform = `scale(${backOut(s).toFixed(3)}) rotate(${((1 - s) * 90).toFixed(1)}deg)`
    setOpacity(star, s)
    const typeA = el.querySelector('.wd-d-type-a')
    const charsA = typeA.querySelectorAll('.wd-ch')
    const nA = Math.floor(seg(p, 0.06, 0.26) * charsA.length + 1e-6)
    charsA.forEach((c, i) => {
      c.style.visibility = i < nA ? '' : 'hidden'
    })
    setOpacity(typeA, seg(p, 0.05, 0.07) * (1 - seg(p, 0.28, 0.33)))
    const curA = typeA.querySelector('.wd-cursor')
    const lastA = charsA[Math.max(0, nA - 1)]
    curA.style.transform = `translate(${px(nA ? lastA.offsetLeft + lastA.offsetWidth : charsA[0].offsetLeft)}, ${px(lastA.offsetTop)})`

    // the eye: looks left, looks right, blinks shut, opens as a pill that says quality
    const eye = el.querySelector('.wd-d-eye')
    const eyeIn = seg(p, 0.36, 0.39) * (1 - seg(p, 0.64, 0.67))
    setOpacity(eye, eyeIn)
    const look = -0.3 * easeInOut(seg(p, 0.4, 0.44)) + 0.65 * easeInOut(seg(p, 0.45, 0.49)) - 0.35 * easeInOut(seg(p, 0.5, 0.53))
    eye.querySelector('.wd-d-pupil').style.transform = `translateX(${(look * 100).toFixed(1)}px)`
    const shut = easeInOut(seg(p, 0.53, 0.56))
    const open = easeOut(seg(p, 0.565, 0.61))
    const lid = el.querySelector('.wd-d-lid')
    lid.style.transform = `scaleY(${lerp(1, 0.03, shut).toFixed(3)})`
    setOpacity(lid, 1 - seg(p, 0.565, 0.58))
    const pill = el.querySelector('.wd-d-pill')
    pill.style.transform = `scaleY(${lerp(0.03, 1, open).toFixed(3)})`
    setOpacity(pill, seg(p, 0.565, 0.58))
    setOpacity(pill.querySelector('span'), seg(p, 0.6, 0.63))

    // "in every detail" typed, a photo growing up behind it
    const typeB = el.querySelector('.wd-d-type-b')
    const charsB = typeB.querySelectorAll('.wd-ch')
    const nB = Math.floor(seg(p, 0.7, 0.79) * charsB.length + 1e-6)
    charsB.forEach((c, i) => {
      c.style.visibility = i < nB ? '' : 'hidden'
    })
    setOpacity(typeB, seg(p, 0.69, 0.71))
    const curB = typeB.querySelector('.wd-cursor')
    const lastB = charsB[Math.max(0, nB - 1)]
    curB.style.transform = `translate(${px(nB ? lastB.offsetLeft + lastB.offsetWidth : charsB[0].offsetLeft)}, ${px(lastB.offsetTop)})`
    setOpacity(curB, 1 - seg(p, 0.84, 0.86))
    const photo = el.querySelector('.wd-d-photo')
    const f = easeOut(seg(p, 0.82, 1))
    photo.style.transform = `scale(${lerp(0.22, 1, f).toFixed(3)})`
    setOpacity(photo, seg(p, 0.82, 0.88))
  }, [])
  useScrub(ref, paint)
  const chars = (text) =>
    [...text].map((ch, i) => (
      <span key={i} className="wd-ch" style={{ visibility: 'hidden' }}>
        {ch === ' ' ? ' ' : ch}
      </span>
    ))
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 4.8 }}>
      <div className="wd-stage wd-stage-dark">
        <div className="wd-grad" />
        <h2 className="sr-only">Outstanding style and exceptional quality in every detail</h2>
        <div className="wd-d" aria-hidden="true">
          <Sparkle className="wd-d-star" />
          <p className="wd-d-type wd-d-type-a" style={{ opacity: 0 }}>
            {chars(TYPE_A)}
            <i className="wd-cursor wd-cursor-bracket" />
          </p>
          <div className="wd-d-eye" style={{ opacity: 0 }}>
            <svg viewBox="0 0 320 130" className="wd-d-lid">
              <ellipse cx="160" cy="65" rx="150" ry="55" fill="none" stroke="currentColor" strokeWidth="5" />
              <circle className="wd-d-pupil" cx="160" cy="65" r="32" fill="currentColor" />
              <circle className="wd-d-glint" cx="176" cy="52" r="7" />
            </svg>
            <div className="wd-d-pill" style={{ opacity: 0 }}>
              <span style={{ opacity: 0 }}>quality</span>
            </div>
          </div>
          <div className="wd-d-photo" style={{ opacity: 0 }}>
            <img src={pic('detail-hand')} alt="" width="720" height="960" loading="lazy" decoding="async" draggable="false" />
          </div>
          <p className="wd-d-type wd-d-type-b" style={{ opacity: 0 }}>
            {chars(TYPE_B)}
            <i className="wd-cursor wd-cursor-block" />
          </p>
        </div>
      </div>
    </section>
  )
}

/* ---------- scene 6: we are open to bold ideas, then the wordmark ---------- */
function OpenScene() {
  const ref = useRef(null)
  const paint = useCallback((p, { el, vw }) => {
    const line = el.querySelector('.wd-o-line')
    const weare = line.querySelector('.wd-o-weare')
    const words = line.querySelectorAll('.wd-o-w')
    const a = easeOut(seg(p, 0.02, 0.12))
    const k = easeInOut(seg(p, 0.18, 0.46))
    const out = easeIn(seg(p, 0.62, 0.7))
    const s = lerp(2.3, 1, k) * lerp(0.94, 1, a)
    const w1 = weare.offsetWidth
    const W = line.offsetWidth
    const centre = w1 / 2 + (W / 2 - w1 / 2) * k
    line.style.transform = `translate(${px(vw / 2 - centre * s)}, ${px(-out * 60)}) scale(${s.toFixed(3)})`
    setOpacity(line, a * (1 - out))
    words.forEach((w, i) => {
      const t = easeOut(seg(p, 0.2 + i * 0.06, 0.27 + i * 0.06))
      setOpacity(w, t)
      w.style.transform = `translateY(${((1 - t) * 0.4).toFixed(3)}em)`
    })
    const brand = el.querySelector('.wd-o-brand')
    const g = easeOut(seg(p, 0.7, 0.82))
    brand.style.transform = `scale(${lerp(0.82, 1, g).toFixed(3)})`
    setOpacity(brand, g)
    setOpacity(el.querySelector('.wd-o-cta'), seg(p, 0.82, 0.92))
  }, [])
  useScrub(ref, paint)
  return (
    <section ref={ref} className="wd-scene" style={{ '--len': 2.8 }}>
      <div className="wd-stage wd-stage-dark">
        <h2 className="sr-only">We are open to bold ideas</h2>
        <div className="wd-o-line" aria-hidden="true" style={{ opacity: 0 }}>
          <span className="wd-o-weare">We are</span>
          {OPEN_WORDS.map((w, i) => (
            <span key={i} className="wd-o-w" style={{ opacity: 0 }}>
              {w}
            </span>
          ))}
        </div>
        <div className="wd-o-end">
          <p className="wd-o-brand" style={{ opacity: 0 }}>
            <span className="wd-o-mark">MARKETING RAVAN</span>
            <span className="wd-o-url">marketingravan.com</span>
          </p>
          <div className="wd-o-cta" style={{ opacity: 0 }}>
            <button type="button" className="btn-primary" onClick={openRavan}>
              Talk to Ravan about your site
            </button>
            <a className="btn-ghost" href="#wd-what">
              What you get
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- the plain part: what you get, and the way in ---------- */
const STEPS = [
  ['Design', 'A look that is yours, drawn for your buyers. Not a template with your logo on it.'],
  ['Build', 'React, instant loads, SEO and analytics wired in, WhatsApp and Ravan on every page.'],
  ['Launch', 'Live in weeks, not months. Domain, hosting and forms handled, nothing left for you to set up.'],
  ['Care', 'New pages, campaign landers and monthly tune-ups, so the site keeps up with the business.'],
]

function Closing() {
  return (
    <section id="wd-what" className="wd-what container-x">
      <p className="eyebrow">What you get</p>
      <h2>One website. Four jobs done.</h2>
      <ol className="wd-steps">
        {STEPS.map(([t, d], i) => (
          <li key={t}>
            <b>0{i + 1}</b>
            <h3>{t}</h3>
            <p>{d}</p>
          </li>
        ))}
      </ol>
      <div className="wd-what-cta">
        <button type="button" className="btn-primary" onClick={openRavan}>
          Talk to Ravan
        </button>
        <a className="btn-ghost" href="/#heads">
          See all ten heads
        </a>
      </div>
    </section>
  )
}

function WebsiteDev() {
  useEffect(() => {
    const title = document.title
    const meta = document.querySelector('meta[name="description"]')
    const desc = meta?.getAttribute('content')
    document.title = 'Website Development — Marketing Ravan'
    meta?.setAttribute('content', 'Premium, fast, conversion-first websites by Marketing Ravan: designed for your buyers, built to load instantly, with an AI agent on every page.')
    window.scrollTo(0, 0)
    return () => {
      document.title = title
      if (desc != null) meta?.setAttribute('content', desc)
    }
  }, [])
  return (
    <div className="wd">
      <HeroScene />
      <WallScene />
      <StackScene />
      <KineticScene />
      <DetailScene />
      <OpenScene />
      <Closing />
    </div>
  )
}

export default memo(WebsiteDev)
