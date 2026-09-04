import { useEffect, useRef, useState } from 'react'
import { useInView } from 'motion/react'

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/*
 * Self-playing demo driver shared by every head page.
 * Advances `step` from 0..length while the demo is on screen, holds at the
 * end for `pauseMs`, then loops (`loops` counts the restarts so a demo can
 * vary per pass). Under prefers-reduced-motion it jumps straight to the
 * finished state and stays there.
 */
export function usePlayer(length, { stepMs = 1500, pauseMs = 4000 } = {}) {
  const ref = useRef(null)
  const inView = useInView(ref, { margin: '-80px' })
  const [reduced] = useState(prefersReduced)
  const [step, setStep] = useState(reduced ? length : 0)
  const [loops, setLoops] = useState(0)

  useEffect(() => {
    if (reduced || !inView) return
    const id = setInterval(() => {
      setStep((s) => (s >= length ? s : s + 1))
    }, stepMs)
    return () => clearInterval(id)
  }, [inView, length, stepMs, reduced])

  useEffect(() => {
    if (reduced || step < length) return
    const id = setTimeout(() => {
      setStep(0)
      setLoops((l) => l + 1)
    }, pauseMs)
    return () => clearTimeout(id)
  }, [step, length, pauseMs, reduced])

  return { ref, step, done: step >= length, reduced, loops }
}

/* Counts from 0 to `target` over `ms` while `active`; reads 0 otherwise. */
export function useCountUp(target, active, ms = 1400) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, ms])
  return active ? v : 0
}
