import { useEffect, useRef } from 'react'
import { HEADS } from '../data/heads.js'
import { openRavan } from '../lib/ravan.js'
import logo from '../assets/logo-mark.webp'
import crowd from '../assets/ads-story/crowd.webp'
import dice from '../assets/ads-story/dice.webp'
import megaphone from '../assets/ads-story/megaphone.webp'
import phone from '../assets/ads-story/phone.webp'
import skyline from '../assets/ads-story/skyline.webp'
import lens from '../assets/ads-story/lens.webp'
import chess from '../assets/ads-story/chess.webp'
import bulb from '../assets/ads-story/bulb.webp'
import computer from '../assets/ads-story/computer.webp'
import handshake from '../assets/ads-story/handshake.webp'
import walking from '../assets/ads-story/walking.webp'
import './ads-story.css'

/*
 * The Meta Ads story: one screen of scroll per beat, told the way a
 * monochrome agency reel tells it — a line of type, one object, a blur cut
 * to the next. The stage is sticky; scrolling only moves a progress number
 * (--p, 0→1) on each scene and the CSS does every reveal from it, so nothing
 * re-renders while you scroll. Pictures: scripts/gen-ads-story.mjs.
 */
const HEAD = HEADS.find((h) => h.icon === 'ads')

/* a line of words: s = small lead-in, b = the big word (wipes in), m = medium */
const s = (t) => ({ t, w: 's' })
const b = (t) => ({ t, w: 'b' })
const m = (t) => ({ t, w: 'm' })

const SCENES = [
  { key: 'crowd', kind: 'cover', img: crowd, top: [[s('We don’t run ads')], [b('for everyone.')]] },
  { key: 'intent', top: [[s('And that’s')], [b('intentional.')]] },
  { key: 'dice', img: dice, top: [[s('Not every')], [b('business')]], bottom: [[s('wants the')], [b('same thing.')]] },
  { key: 'mega', img: megaphone, top: [[s('Some want'), m('quick')], [b('campaigns.')]] },
  { key: 'viral', img: phone, tone: 'grey', top: [[s('Some want')], [m('viral')], [b('reels.')]] },
  { key: 'wa', kind: 'chat', text: 'Some want ads to magically fix everything' },
  { key: 'circle', kind: 'circle', top: [[s('That’s not')], [b('the work')], [m('we do.')]] },
  { key: 'city', kind: 'cover', img: skyline, top: [[s('We work with')], [b('businesses')]] },
  { key: 'lens', img: lens, top: [[s('that want to')], [b('understand')], [m('the problem first.')]] },
  { key: 'chess', img: chess, top: [[s('where')], [b('growth')]], bottom: [[s('is getting')], [b('stuck.')]] },
  { key: 'bulb', img: bulb, top: [[s('and what')], [m('needs to')], [b('change.')]] },
  { key: 'search', kind: 'search', img: computer, text: 'why did my cost per lead go up' },
  { key: 'band', kind: 'band', img: handshake },
  { key: 'walk', kind: 'cover', img: walking, top: [[s('And not every')], [b('business is.')]] },
  { key: 'outro', kind: 'outro', tone: 'dark' },
]

/* reveal order: every word gets the progress at which it comes in */
function Words({ lines, from = 0.08, step = 0.07, className = '' }) {
  let i = 0
  return (
    <div className={`as-words ${className}`}>
      {lines.map((line, li) => (
        <div className="as-line" key={li}>
          {line.map((w, wi) => (
            <span className={`as-w as-${w.w}`} style={{ '--in': from + step * i++ }} key={wi}>
              {w.t}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/* text that types itself out, one character per slice of progress */
function Typed({ text, from = 0.14, to = 0.62, className = '' }) {
  const step = (to - from) / text.length
  return (
    <span className={`as-typed ${className}`} aria-label={text}>
      {[...text].map((c, i) => (
        <span className="as-ch" style={{ '--in': from + step * i }} key={i} aria-hidden="true">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  )
}

function Leaves() {
  /* five long leaves fanned out of one corner point */
  const leaf = 'M0 0 C 26 -18, 70 -40, 128 -30 C 150 -26, 154 -14, 132 -8 C 84 4, 36 6, 0 0 Z'
  const angles = [-4, 22, 48, 74, 100]
  return (
    <svg className="as-leaves" viewBox="-160 -160 320 320" aria-hidden="true">
      {angles.map((a) => (
        <path d={leaf} transform={`rotate(${a}) translate(8 0)`} key={a} />
      ))}
    </svg>
  )
}

function Grid() {
  return (
    <svg className="as-grid" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
      {[25, 50, 75].map((x) => (
        <line x1={x} y1="0" x2={x} y2="100" key={`x${x}`} />
      ))}
      {[33.3, 66.6].map((y) => (
        <line x1="0" y1={y} x2="100" y2={y} key={`y${y}`} />
      ))}
    </svg>
  )
}

function Scene({ sc }) {
  const kind = sc.kind ?? 'object'
  return (
    <div className={`as-scene as-k-${kind}`} data-tone={sc.tone ?? 'paper'} data-key={sc.key}>
      {kind === 'cover' && <img className="as-cover" src={sc.img} alt="" draggable="false" />}

      {(kind === 'object' || kind === 'cover') && (
        <>
          {sc.top && <Words lines={sc.top} />}
          {kind === 'object' && sc.img && (
            <div className="as-obj-wrap">
              <img className="as-obj" src={sc.img} alt="" draggable="false" />
            </div>
          )}
          {sc.bottom && <Words lines={sc.bottom} from={0.3} className="as-bottom" />}
        </>
      )}

      {kind === 'chat' && (
        <div className="as-chat">
          <div className="as-bubble">
            <Typed text={sc.text} />
            <span className="as-time">9:41</span>
            <span className="as-tail" aria-hidden="true" />
          </div>
          <div className="as-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}

      {kind === 'circle' && (
        <div className="as-circle-wrap">
          <Words lines={sc.top} />
          <svg className="as-ring" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 60 40 C 150 5, 380 10, 385 95 C 390 175, 160 195, 60 170 C -10 152, 5 60, 110 32" pathLength="1" />
          </svg>
        </div>
      )}

      {kind === 'search' && (
        <>
          <Words lines={[[s('And they usually start')], [m('with a question.')]]} from={0.06} step={0.06} />
          <div className="as-obj-wrap">
            <div className="as-crt">
              <img className="as-obj" src={sc.img} alt="" draggable="false" />
              <div className="as-screen">
                <span className="as-search-logo">Search</span>
                <div className="as-search-bar">
                  <Typed text={sc.text} from={0.28} to={0.7} />
                  <i className="as-caret" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {kind === 'band' && (
        <div className="as-band">
          <Words lines={[[s('When the')], [b('business')]]} className="as-band-top" />
          <img className="as-band-img" src={sc.img} alt="" draggable="false" />
          <Words lines={[[s('behind it is')], [b('ready.')]]} from={0.28} className="as-band-bottom" />
        </div>
      )}

      {kind === 'outro' && (
        <div className="as-outro">
          <img className="as-outro-logo" src={logo} alt="" width="96" height="96" />
          <div className="as-outro-mark">MARKETING RAVAN</div>
          <div className="as-outro-line">Ten heads. Ten jobs. One Ravan.</div>
          <div className="as-outro-cta">
            <button type="button" className="btn-primary" onClick={openRavan}>
              Talk to the Ads head
            </button>
            <a className="btn-ghost" href="/#heads">
              See all ten heads
            </a>
          </div>
          <div className="as-outro-url">marketingravan.com</div>
        </div>
      )}
    </div>
  )
}

const LEAD = 0.35 // the first scene is already this far in when the page opens
const TAIL = 0.5 // extra screens of scroll to sit on the outro

export default function AdsStory() {
  const wrapRef = useRef(null)

  /* the whole page goes paper-light: nav and footer read the flipped tokens */
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-light', 'theme-ads')
    return () => root.classList.remove('theme-light', 'theme-ads')
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const scenes = [...wrap.querySelectorAll('.as-scene')]
    const n = scenes.length
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wrap.classList.add('is-static')
      scenes.forEach((el) => el.style.setProperty('--p', '0.6'))
      return
    }
    let raf = 0
    const live = new Array(n).fill(null)
    const tick = () => {
      raf = 0
      const unit = window.innerHeight
      const y = -wrap.getBoundingClientRect().top + LEAD * unit
      for (let i = 0; i < n; i++) {
        let p = (y - i * unit) / unit
        p = p < 0 ? 0 : p > 1 ? 1 : p
        if (i === n - 1 && p > 0.6) p = 0.6 // the outro never blurs out
        const on = p > 0 && p < 1
        const el = scenes[i]
        if (live[i] !== on) {
          el.classList.toggle('is-live', on)
          live[i] = on
        }
        if (on) el.style.setProperty('--p', p.toFixed(4))
      }
      const total = wrap.offsetHeight - unit
      wrap.style.setProperty('--s', Math.max(0, Math.min(1, (y - LEAD * unit) / total)).toFixed(4))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div className="as-wrap" ref={wrapRef} style={{ '--n': SCENES.length - LEAD + TAIL }}>
        <div className="as-stage">
          <Grid />
          <div className="as-corner as-tl">
            <Leaves />
          </div>
          <div className="as-corner as-tr">
            <Leaves />
          </div>
          <div className="as-corner as-bl">
            <Leaves />
          </div>
          <div className="as-corner as-br">
            <Leaves />
          </div>
          <div className="as-head">
            <span className="as-head-n">Head 02 / 10</span>
            <span className="as-head-t">Meta Ads</span>
          </div>
          {SCENES.map((sc) => (
            <Scene sc={sc} key={sc.key} />
          ))}
        </div>
      </div>

      <section className="as-after">
        <div className="container-x as-after-in">
          <p className="eyebrow">What the Ads head actually does</p>
          <h2 className="as-after-h">{HEAD.title}</h2>
          <p className="as-after-p">{HEAD.desc}</p>
          <ul className="as-after-tags">
            {HEAD.tags.map((t) => (
              <li className="chip" key={t}>
                {t}
              </li>
            ))}
          </ul>
          <div className="as-after-cta">
            <button type="button" className="btn-primary" onClick={openRavan}>
              Tell Ravan about your business
            </button>
            <span className="as-after-note">
              Two minutes. Ravan asks, you answer, and we tell you honestly whether ads are the right head for you.
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
