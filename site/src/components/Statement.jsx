import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const LINE_A = 'Think of us as ten senior teams.'
const LINE_B = 'Without hiring one.'

/* beew-style scrubbed word reveal: words light up as you scroll through. */
export default function Statement() {
  const ref = useRef(null)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current?.querySelectorAll('.w').forEach((el) => (el.style.opacity = 1))
      return
    }
    const words = ref.current?.querySelectorAll('.w')
    if (!words?.length) return
    const tween = gsap.fromTo(
      words,
      { opacity: 0.12 },
      {
        opacity: 1,
        stagger: 0.06,
        ease: 'none',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          end: 'top 30%',
          scrub: true,
        },
      },
    )
    return () => tween.scrollTrigger?.kill()
  }, [])

  const render = (line, cls) =>
    line.split(' ').map((w, i) => (
      <span key={cls + i} className={`w inline-block ${cls}`} style={{ opacity: 0.12 }}>
        {w}&nbsp;
      </span>
    ))

  return (
    <section className="container-x py-32 text-center">
      <h2 ref={ref} className="mx-auto max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
        {render(LINE_A, '')}
        <br />
        {render(LINE_B, 'text-muted')}
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-muted">
        You bring the goals. The ten heads bring the agents, the pipelines,
        the campaigns and the craft — and they never clock out.
      </p>
    </section>
  )
}
