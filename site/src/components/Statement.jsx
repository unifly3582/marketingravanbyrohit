import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const LINE_A = 'Think of us as ten senior teams.'
const LINE_B = 'Without hiring one.'

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
        start: 'top 80%',
        end: 'top 25%',
        scrub: true,
      },
    })
    tl.fromTo(
      letters,
      { color: DIM, filter: 'blur(10px)' },
      { color: ACCENT, filter: 'blur(0px)', duration: FRONT, ease: 'none', stagger: 1 },
      0,
    )
    tl.to(
      letters,
      { color: (i, el) => el.dataset.final, duration: TRAIL, ease: 'none', stagger: 1 },
      FRONT + HOLD,
    )
    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

  const renderLine = (line, final) =>
    line.split(' ').map((w, wi, arr) => (
      <span key={final + wi} className="inline-block whitespace-nowrap">
        {[...w].map((ch, ci) => (
          <span
            key={ci}
            className="ltr inline-block"
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
    <section className="container-x py-32 text-center">
      <h2 ref={ref} className="mx-auto max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
        <span className="sr-only">
          {LINE_A} {LINE_B}
        </span>
        <span aria-hidden="true">
          {renderLine(LINE_A, FINAL_A)}
          <br />
          {renderLine(LINE_B, FINAL_B)}
        </span>
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-muted">
        You bring the goals. The ten heads bring the agents, the pipelines,
        the campaigns and the craft — and they never clock out.
      </p>
    </section>
  )
}
