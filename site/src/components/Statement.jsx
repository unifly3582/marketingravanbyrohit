import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const LINE_A = 'Think of us as'
const LINE_A2 = 'ten senior teams.'
const LINE_B = 'Without hiring one.'
const PARA =
  'You bring the goals. The ten heads bring the agents, the pipelines, the campaigns and the craft — and they never clock out.'

/*
 * beew-style scrubbed letter reveal. Every letter starts as a blurred ghost;
 * scrolling drives a wave through the text: a ~5-letter blur front that
 * solidifies into the accent color, a short solid-accent hold, then a
 * ~10-letter trail where the accent drains out to the letter's final color.
 */
const ACCENT = '#F0A32F'
const DIM = 'rgba(244, 234, 219, 0.06)'
const FINAL_A = '#F4EADB' // cream
const FINAL_B = '#A3937F' // muted

const FRONT = 5   // wave-front width, in letters
const HOLD = 1    // letters that sit solid-accent
const TRAIL = 10  // accent→final fade width, in letters

export default function Statement() {
  const ref = useRef(null)

  useEffect(() => {
    const letters = ref.current?.querySelectorAll('.ltr')
    if (!letters?.length) return

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      letters.forEach((el) => {
        el.style.color = el.dataset.final
        el.style.filter = 'none'
      })
      return
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ref.current,
        start: 'top 85%',
        end: 'bottom 45%',
        scrub: true,
      },
    })

    // Heading and paragraph reveal together: each group gets its own wave,
    // both starting at 0 and both spanning the same timeline length. The
    // longer group's stagger is scaled down so its wave finishes in step.
    const groups = [
      ref.current.querySelectorAll('.ltr-h'),
      ref.current.querySelectorAll('.ltr-p'),
    ].filter((g) => g.length)
    const span = Math.max(...groups.map((g) => g.length))
    for (const group of groups) {
      const stagger = span / group.length
      tl.fromTo(
        group,
        { color: DIM, filter: 'blur(10px)' },
        { color: ACCENT, filter: 'blur(0px)', duration: FRONT, ease: 'none', stagger },
        0,
      )
      tl.to(
        group,
        { color: (i, el) => el.dataset.final, duration: TRAIL, ease: 'none', stagger },
        FRONT + HOLD,
      )
    }
    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

  // `group` is 'h' (heading) or 'p' (paragraph): each runs its own wave
  const renderLine = (line, final, group = 'h') =>
    line.split(' ').map((w, wi, arr) => (
      <span key={final + wi} className="inline-block whitespace-nowrap">
        {[...w].map((ch, ci) => (
          <span
            key={ci}
            className={`ltr ltr-${group} inline-block`}
            data-final={final}
            style={{ color: DIM, filter: 'blur(10px)', willChange: 'color, filter' }}
          >
            {ch}
          </span>
        ))}
        {wi < arr.length - 1 && ' '}
      </span>
    ))

  return (
    <section ref={ref} className="container-x py-14 text-center md:py-20">
      <h2 className="mx-auto max-w-5xl text-[2.4rem] font-bold leading-[1.05] md:text-7xl">
        <span className="sr-only">
          {LINE_A} {LINE_A2} {LINE_B}
        </span>
        <span aria-hidden="true">
          {renderLine(LINE_A, FINAL_A)}
          <br />
          {renderLine(LINE_A2, FINAL_A)}
          <br />
          {renderLine(LINE_B, FINAL_B)}
        </span>
      </h2>
      {/* the paragraph rides the same scrubbed wave, after the headline */}
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed md:mt-8 md:text-xl">
        <span className="sr-only">{PARA}</span>
        <span aria-hidden="true">{renderLine(PARA, FINAL_B, 'p')}</span>
      </p>
    </section>
  )
}
