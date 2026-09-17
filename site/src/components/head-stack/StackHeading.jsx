import { useEffect, useRef } from 'react'
import { INTRO_VH, STEP_VH } from './CardStack.jsx'
import './stack-heading.css'

/*
 * The pile's heading, in three beats: "Ten heads." "Ten jobs." "One Ravan."
 * It rides the same scroll as the pile. As the statement lifts away (the
 * back half of the intro) the beats rise in one after another, sharpening
 * out of a blur; they hold while the first card settles; then, as the pile
 * steps to the second card, they blur and drift up out of the way. Nothing
 * runs on a clock: the visitor's thumb drives it, like the rest of the pile.
 */
const BEATS = ['Ten heads.', 'Ten jobs.', 'One Ravan.']
const LABEL = BEATS.join(' ')

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smooth = (v) => {
  const u = clamp01(v)
  return u * u * (3 - 2 * u)
}

export default function StackHeading({ wrapRef }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const wrap = wrapRef?.current
    if (!el || !wrap) return
    const beats = el.querySelectorAll('.hs-heading-beat')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    const paint = () => {
      frame = 0
      const vh = window.innerHeight
      const y = Math.max(0, -wrap.getBoundingClientRect().top)
      const introPx = (INTRO_VH / 100) * vh
      const stepPx = (STEP_VH / 100) * vh
      const intro = y / introPx // 0..1 while the statement lifts and the pile rises
      const p = (y - introPx) / stepPx // 0 = first card settled, 1 = second card
      beats.forEach((b, i) => {
        const enter = smooth((intro - 0.55 - i * 0.12) / 0.3)
        const leave = smooth((p - 0.2 - i * 0.1) / 0.45)
        const o = enter * (1 - leave)
        if (reduced) {
          b.style.opacity = o > 0.5 ? '1' : '0'
          return
        }
        const dy = (1 - enter) * 28 - leave * 26
        const blur = (1 - enter) * 10 + leave * 8
        b.style.opacity = o.toFixed(3)
        b.style.transform = `translateY(${dy.toFixed(1)}px)`
        b.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none'
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    paint()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [wrapRef])

  return (
    <h2 ref={ref} className="hs-heading" aria-label={LABEL}>
      {BEATS.map((beat, i) => (
        <span key={beat} className={`hs-heading-beat${i === BEATS.length - 1 ? ' is-gold' : ''}`} aria-hidden="true">
          {beat}
        </span>
      ))}
    </h2>
  )
}
