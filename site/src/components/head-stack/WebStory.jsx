import { useEffect, useRef, useState } from 'react'
import './web-story.css'

/*
 * The Website Design card's visual: one visitor on one website, told as a
 * story on a 22-second loop that restarts every time the card comes to the
 * front. The theme is the attention lab: we watch where her eyes go (a gaze
 * dot, heat where she lingers) and the page is built for exactly that.
 *
 *   0-0.6s    the site paints
 *   0.6-6s    ATTENTION  her eyes land on the headline, the picture, the button
 *   6-11.5s   TRUST      scroll two: reviews, names, numbers, right where doubt starts
 *   11.5-17s  ACTION     one button, a nudge at the moment of hesitation, booked
 *   17-22s    RESULT     the site dims, the number lands, the catchphrase
 *
 * Plain DOM: the mini site is real markup, so it stays crisp at card size.
 * One rAF loop quantised to 100 ms drives `t`; every element decides from `t`
 * whether it exists, CSS does the entrances. Runs only while the card is at
 * the front; cards behind hold a mid-story frame so the pile never looks empty.
 */
const LOOP = 22
const STAGE_W = 320
const HOLD_T = 2.4 // the frame cards show while they are not at the front
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const BEATS = [
  { at: 0.6, key: 'attention', step: '01 · Attention', line: 'A stranger decides in 3 seconds.', note: 'One promise, one picture, one button. Nothing to decode.' },
  { at: 6.0, key: 'trust', step: '02 · Trust', line: 'Doubt shows up on scroll two. So does proof.', note: 'Real names, real numbers, placed where hesitation starts.' },
  { at: 11.5, key: 'action', step: '03 · Action', line: 'One clear next step. No forms, no friction.', note: 'A nudge at the moment of doubt. The button does the rest.' },
  { at: 17.0, key: 'result', step: 'The result', line: 'Looks good. Reads minds.', em: 'Wins customers.', note: null },
]
const beatOf = (t) => [...BEATS].reverse().find((b) => t >= b.at) ?? null

/* where the page is scrolled to, per beat (doc offset inside the viewport) */
const SCROLL = { attention: 0, trust: -170, action: -252, result: -252 }

/* the camera: pushes in on what she is looking at. (x, y) in window coords, s = zoom */
const CAM = {
  attention: { x: 86, y: 60, s: 1.2 },
  trust: { x: 86, y: 80, s: 1.12 },
  action: { x: 86, y: 95, s: 1.18 },
  result: { x: 86, y: 106, s: 1 },
}
const camera = ({ x, y, s }) => `translate(${(-x * (s - 1)).toFixed(1)}px, ${(-y * (s - 1)).toFixed(1)}px) scale(${s})`

/* where her eyes are (viewport coords, below the browser bar) */
const GAZE = [
  { at: 0.8, x: 62, y: 42 }, // headline
  { at: 2.8, x: 90, y: 132 }, // the picture
  { at: 3.9, x: 46, y: 91 }, // the button
  { at: 5.0, x: 74, y: 46 }, // back to the headline
  { at: 6.4, x: 52, y: 14 }, // the stars
  { at: 7.6, x: 84, y: 66 }, // the testimonial
  { at: 9.4, x: 150, y: 44 }, // the verified badge
  { at: 12.0, x: 86, y: 88 }, // the big button
  { at: 14.0, x: 86, y: 88 },
]
const gazeAt = (t) => [...GAZE].reverse().find((g) => t >= g.at)

/* heat builds where she lingers; drawn inside the document so it scrolls with the page */
const HEAT = [
  { at: 1.0, x: 60, y: 44, w: 110, h: 44, k: 'hot' },
  { at: 3.0, x: 90, y: 134, w: 70, h: 40, k: 'warm' },
  { at: 4.0, x: 46, y: 92, w: 70, h: 30, k: 'mid' },
  { at: 7.8, x: 84, y: 236, w: 120, h: 44, k: 'mid' },
  { at: 12.3, x: 86, y: 340, w: 130, h: 34, k: 'hot' },
]
const CALLOUTS = [
  { from: 1.6, to: 3.6, x: 96, y: 14, text: 'Eyes land here first' },
  { from: 8.2, to: 10.8, x: 72, y: 256, text: 'Proof, where doubt appears' },
  { from: 12.6, to: 13.9, x: 92, y: 314, text: 'One clear next step' },
]
const NUDGE_AT = 12.8
const CLICK_AT = 14.0
const BOOKED_AT = 14.25
const ENQUIRY_AT = 15.0

const Star = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 1.5l1.9 4 4.4.6-3.2 3 .8 4.4L8 11.4l-3.9 2.1.8-4.4-3.2-3 4.4-.6z" fill="currentColor" />
  </svg>
)
const Shield = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 1.5l5 2v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4z" fill="currentColor" />
    <path d="M5.5 8l1.8 1.8L10.8 6" fill="none" stroke="#0b1a12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function WebStory({ active }) {
  const hostRef = useRef(null)
  const [t, setT] = useState(HOLD_T)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fit = () => host.style.setProperty('--s', (host.clientWidth / STAGE_W).toFixed(4))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!active || reduced) return
    let raf = 0
    let t0 = performance.now()
    const tick = (now) => {
      let tt = ((now - t0) / 1000) % LOOP
      if (import.meta.env.DEV && window.__wsHold != null) tt = window.__wsHold
      setT(Math.floor(tt * 10) / 10)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick) // first frame lands at t≈0: the story restarts
    if (import.meta.env.DEV)
      window.__wsSeek = (s) => {
        t0 = performance.now() - s * 1000
      }
    return () => cancelAnimationFrame(raf)
  }, [active])

  const painted = t >= 0.5
  const beat = beatOf(t)
  const key = beat?.key ?? 'attention'
  const gaze = key === 'result' ? null : gazeAt(t)
  const booked = t >= BOOKED_AT
  const clicked = t >= CLICK_AT && t < CLICK_AT + 0.8

  return (
    <div ref={hostRef} className={`ws is-${key}${painted ? ' is-painted' : ''}`} aria-hidden="true">
      <div className="ws-stage">
        {/* ---- the story, told at the left ---- */}
        {beat && (
          <div key={beat.key} className="ws-copy">
            <span className="ws-step">{beat.step}</span>
            <p className="ws-line">
              {beat.line}
              {beat.em && <em> {beat.em}</em>}
            </p>
            {beat.note && <p className="ws-note">{beat.note}</p>}
            {key === 'action' && t >= ENQUIRY_AT && (
              <span className="ws-enquiry">
                <Check /> Enquiry #128 this month
              </span>
            )}
            {key === 'result' && (
              <span className="ws-since">60 days after launch</span>
            )}
          </div>
        )}

        {/* ---- the camera and the browser window ---- */}
        <div className="ws-cam" style={{ transform: camera(CAM[key]) }}>
          <div className="ws-win">
            <div className="ws-bar">
              <i />
              <i />
              <i />
              <span>aangan.in</span>
            </div>
            <div className="ws-screen">
              <div className="ws-doc" style={{ transform: `translateY(${SCROLL[key]}px)` }}>
                {/* the site: Aangan Interiors, dark editorial */}
                <section className="ws-hero">
                  <div className="ws-nav">
                    <b>aangan</b>
                    <span>
                      <i />
                      <i />
                    </span>
                  </div>
                  <h4>
                    Homes that
                    <br />
                    <em>feel like you.</em>
                  </h4>
                  <p>Interiors for Pune homes, handed over in 45 days.</p>
                  <button type="button" className="ws-cta">
                    Book a free visit
                  </button>
                  <div className="ws-pic">
                    <span className="ws-price">₹4.2L · full 2BHK</span>
                  </div>
                </section>

                <section className="ws-trust">
                  <div className="ws-stars">
                    <span>
                      <Star />
                      <Star />
                      <Star />
                      <Star />
                      <Star />
                    </span>
                    <b>4.9</b> · 312 families
                  </div>
                  <div className="ws-logos">
                    <span>Godrej</span>
                    <span>Hettich</span>
                    <span>Asian Paints</span>
                  </div>
                  <figure className="ws-quote">
                    <i>P</i>
                    <div>
                      <p>“They understood our home before we did.”</p>
                      <small>Priya & Aman · Baner</small>
                    </div>
                    <span className="ws-shield">
                      <Shield /> Verified
                    </span>
                  </figure>
                </section>

                <section className="ws-action">
                  <b>Free site visit</b>
                  <small>3 slots left this week</small>
                  <button type="button" className={`ws-big${booked ? ' is-booked' : ''}${clicked ? ' is-click' : ''}`}>
                    {booked ? (
                      <>
                        <Check /> Visit booked · Sat 11 am
                      </>
                    ) : (
                      'Book my visit →'
                    )}
                  </button>
                  <span>No calls until you say yes.</span>
                </section>

                <section className="ws-work">
                  <b>Recent homes</b>
                  <div>
                    <i className="is-a" />
                    <i className="is-b" />
                    <i className="is-c" />
                  </div>
                </section>

                {/* heat and notes ride on the page */}
                {HEAT.map((h) => (
                  <i
                    key={h.at}
                    className={`ws-heat is-${h.k}${t >= h.at ? ' is-on' : ''}`}
                    style={{ left: h.x, top: h.y, width: h.w, height: h.h }}
                  />
                ))}
                {CALLOUTS.filter((c) => t >= c.from && t < c.to).map((c) => (
                  <span key={c.from} className="ws-callout" style={{ left: c.x, top: c.y }}>
                    {c.text}
                  </span>
                ))}
                {!painted && (
                  <div className="ws-skeleton">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>

              {/* her eyes, over the page */}
              {gaze && painted && <i className="ws-gaze" style={{ left: gaze.x, top: gaze.y }} />}
              {key === 'action' && t >= NUDGE_AT && t < CLICK_AT + 0.4 && (
                <div className="ws-nudge">
                  <i>R</i>
                  <span>Rohan from Kharadi booked 4 min ago</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- the number, over the dimmed site ---- */}
        {key === 'result' && (
          <div className="ws-number">
            <b>3.2x</b>
            <span>more enquiries</span>
          </div>
        )}
      </div>
    </div>
  )
}
