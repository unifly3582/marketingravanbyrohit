import { memo, useEffect, useRef } from 'react'

const LINE_A = 'Think of us as'
const LINE_A2 = 'ten senior teams.'
const LINE_B = 'Without hiring one.'
const PARA =
  'You bring the goals. The ten heads bring the agents, the pipelines, the campaigns and the craft — and they never clock out.'

/*
 * beew-style scrubbed letter reveal. Every letter starts as a dim ghost;
 * scrolling drives a wave through the text: a ~5-letter blur front that
 * solidifies into the accent color, a short solid-accent hold, then a
 * ~10-letter trail where the accent drains out to the letter's final color.
 *
 * Hand-rolled (no GSAP): the wave is a pure function of scroll progress, so
 * each scroll frame just recomputes every letter's colour from where the
 * trigger sits in the viewport. The heading and the paragraph run their own
 * waves over the same span so both finish together.
 */
const ACCENT = [240, 163, 47] // #F0A32F
const DIM = [244, 234, 219, 0.06]
const FINAL_A = '#F4EADB' // cream
const FINAL_B = '#A3937F' // muted
const RGB = { [FINAL_A]: [244, 234, 219], [FINAL_B]: [163, 147, 127] }

const FRONT = 5   // wave-front width, in letters
const HOLD = 1    // letters that sit solid-accent
const TRAIL = 10  // accent→final fade width, in letters

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const mix = (a, b, t) => Math.round(a + (b - a) * t)
const rgba = (c, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`

/* colour, blur and lift of one letter whose wave starts at `s`, at timeline
   time `t`: a ghost sits a touch low; the front lifts it, sharpens it and
   lights it accent; the trail drains the accent to the letter's final colour */
const RISE = 0.16 // em a ghost letter sits below its place
function letterStyle(t, s, final) {
  if (t <= s) return { color: rgba(DIM, DIM[3]), blur: 0, rise: RISE }
  const u1 = (t - s) / FRONT
  if (u1 < 1) {
    const e = 1 - (1 - u1) ** 2 // the lift lands early, the colour follows
    const alpha = DIM[3] + (1 - DIM[3]) * u1
    const c = [mix(DIM[0], ACCENT[0], u1), mix(DIM[1], ACCENT[1], u1), mix(DIM[2], ACCENT[2], u1)]
    return { color: rgba(c, alpha), blur: 10 * (1 - u1), rise: RISE * (1 - e) }
  }
  const u2 = (t - s - FRONT - HOLD) / TRAIL
  if (u2 < 0) return { color: rgba(ACCENT), blur: 0, rise: 0 }
  if (u2 >= 1) return { color: final, blur: 0, rise: 0 }
  const f = RGB[final]
  return { color: rgba([mix(ACCENT[0], f[0], u2), mix(ACCENT[1], f[1], u2), mix(ACCENT[2], f[2], u2)]), blur: 0, rise: 0 }
}

function Statement({ trigger } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const groups = [root.querySelectorAll('.ltr-h'), root.querySelectorAll('.ltr-p')].filter((g) => g.length)
    if (!groups.length) return

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      groups.forEach((g) => g.forEach((el) => { el.style.color = el.dataset.final }))
      return
    }

    // Reading order: the headline's wave runs over the first 70% of the
    // span and the paragraph's over the last 60%, so the paragraph starts
    // to glow while the headline's last words are still settling.
    const S = 120
    const WINDOWS = { h: [0, 0.7], p: [0.4, 1] }
    const letters = []
    for (const group of groups) {
      const [from, to] = WINDOWS[group[0].classList.contains('ltr-p') ? 'p' : 'h']
      const stagger = (S * (to - from)) / group.length
      group.forEach((el, i) => letters.push({ el, s: S * from + i * stagger, final: el.dataset.final, last: '' }))
    }
    const total = S + FRONT + HOLD + TRAIL

    const el = trigger?.current ?? root
    let frame = 0
    // The wave is a pure function of where the block sits, so it runs
    // forwards on the way down, drains on the way back up, and a second
    // pass runs it again. It begins as the block's top reaches 90% of the
    // viewport, or from wherever the block sits with the page at rest when
    // a tall screen already shows its head under the hero, so the first
    // scroll always starts from ghost text; it completes with the block's
    // top 30% of the way up, leaving the lit line a moment to be read
    // before the pile lifts it away.
    const paint = () => {
      frame = 0
      const vh = window.innerHeight
      const top = el.getBoundingClientRect().top
      const start = Math.min(vh * 0.9, top + window.scrollY)
      // a wide screen scrolls by wheel notches, so its wave gets a longer run
      const end = Math.min(vh * (window.innerWidth >= 1024 ? 0.22 : 0.3), start - vh * 0.45)
      const t = clamp01((start - top) / (start - end)) * total
      if (!letters[0].el.isConnected) {
        // a re-render rebuilt the letters: pick the live ones up and repaint them all
        const live = root.querySelectorAll('.ltr')
        if (live.length !== letters.length) return
        letters.forEach((l, i) => {
          l.el = live[i]
          l.last = ''
        })
      }
      for (const l of letters) {
        const { color, blur, rise } = letterStyle(t, l.s, l.final)
        const key = color + blur + rise
        if (key === l.last) continue
        l.last = key
        l.el.style.color = color
        l.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none'
        l.el.style.transform = rise > 0.001 ? `translateY(${rise.toFixed(3)}em)` : ''
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
    schedule() // through a frame: reading layout right here would force one mid-commit
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [trigger])

  return (
    <section ref={ref} className="container-x pt-3 pb-2 text-center md:pt-12 md:pb-8">
      <h2 className="mx-auto max-w-5xl text-[2.4rem] font-bold leading-[1.05] md:text-7xl lg:max-w-6xl lg:text-[5.4rem] lg:leading-[0.98] lg:tracking-[-0.025em]">
        <span className="sr-only">
          {LINE_A} {LINE_A2} {LINE_B}
        </span>
        <span aria-hidden="true" dangerouslySetInnerHTML={HEADING_INNER} />
      </h2>
      {/* the paragraph rides the same scrubbed wave, after the headline */}
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed md:mt-8 md:text-xl lg:mt-10 lg:max-w-3xl lg:text-2xl">
        <span className="sr-only">{PARA}</span>
        <span aria-hidden="true" dangerouslySetInnerHTML={PARA_INNER} />
      </p>
    </section>
  )
}

/* The ~170 letter spans are static, so they are one HTML string the browser
   parses natively instead of 170 React elements built on every visit. `group`
   is 'h' (heading) or 'p' (paragraph): each runs its own wave. */
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const lineHtml = (line, final, group = 'h') =>
  line
    .split(' ')
    .map(
      (w) =>
        `<span class="inline-block whitespace-nowrap">${[...w]
          .map((ch) => `<span class="ltr ltr-${group} inline-block" data-final="${final}" style="color:${final}">${escape(ch)}</span>`)
          .join('')}</span>`,
    )
    .join(' ')
const HEADING_HTML = `${lineHtml(LINE_A, FINAL_A)}<br>${lineHtml(LINE_A2, FINAL_A)}<br>${lineHtml(LINE_B, FINAL_B)}`
const PARA_HTML = lineHtml(PARA, FINAL_B, 'p')
/* The same { __html } objects on every render. React 19 writes innerHTML
   again whenever it is handed a new object, which rebuilt the letters (and
   dropped the wave's hold on them) each time a parent re-rendered: the
   text snapped to fully lit and stayed there. The component is memoised for
   the same reason: nothing about it changes after mount. */
const HEADING_INNER = { __html: HEADING_HTML }
const PARA_INNER = { __html: PARA_HTML }

export default memo(Statement)
