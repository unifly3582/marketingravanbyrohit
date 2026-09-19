import { useEffect, useRef } from 'react'

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

/* colour + blur of one letter whose wave starts at `s`, at timeline time `t` */
function letterStyle(t, s, final) {
  if (t <= s) return { color: rgba(DIM, DIM[3]), blur: 0 }
  const u1 = (t - s) / FRONT
  if (u1 < 1) {
    const alpha = DIM[3] + (1 - DIM[3]) * u1
    const c = [mix(DIM[0], ACCENT[0], u1), mix(DIM[1], ACCENT[1], u1), mix(DIM[2], ACCENT[2], u1)]
    return { color: rgba(c, alpha), blur: 10 * (1 - u1) }
  }
  const u2 = (t - s - FRONT - HOLD) / TRAIL
  if (u2 < 0) return { color: rgba(ACCENT), blur: 0 }
  if (u2 >= 1) return { color: final, blur: 0 }
  const f = RGB[final]
  return { color: rgba([mix(ACCENT[0], f[0], u2), mix(ACCENT[1], f[1], u2), mix(ACCENT[2], f[2], u2)]), blur: 0 }
}

export default function Statement({ trigger } = {}) {
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

    // each group's letters are staggered so both waves span the same length
    const span = Math.max(...groups.map((g) => g.length))
    const letters = []
    for (const group of groups) {
      const stagger = span / group.length
      group.forEach((el, i) => letters.push({ el, s: i * stagger, final: el.dataset.final, last: '' }))
    }
    const total = span - 1 + FRONT + HOLD + TRAIL

    const el = trigger?.current ?? root
    let frame = 0
    const paint = () => {
      frame = 0
      const vh = window.innerHeight
      const top = el.getBoundingClientRect().top
      // the wave runs while the trigger's top travels from 85% to 20% of the viewport
      const t = clamp01((vh * 0.85 - top) / (vh * 0.65)) * total
      for (const l of letters) {
        const { color, blur } = letterStyle(t, l.s, l.final)
        const key = color + blur
        if (key === l.last) continue
        l.last = key
        l.el.style.color = color
        l.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none'
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
      <h2 className="mx-auto max-w-5xl text-[2.4rem] font-bold leading-[1.05] md:text-7xl">
        <span className="sr-only">
          {LINE_A} {LINE_A2} {LINE_B}
        </span>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: HEADING_HTML }} />
      </h2>
      {/* the paragraph rides the same scrubbed wave, after the headline */}
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed md:mt-8 md:text-xl">
        <span className="sr-only">{PARA}</span>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: PARA_HTML }} />
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
