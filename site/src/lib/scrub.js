import { useEffect } from 'react'

/*
 * Scroll-scrubbed scenes, the way Statement.jsx does its letter wave: no
 * animation library, every scroll frame reads where the section sits and
 * hands a 0..1 progress to a paint function that writes styles straight to
 * the DOM. A scene is a tall section with a sticky, viewport-high stage
 * inside it; progress is how far the section has travelled under the stage.
 */
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
/* the 0..1 position of `p` inside the window [a, b] */
export const seg = (p, a, b) => clamp01((p - a) / (b - a))
export const lerp = (a, b, t) => a + (b - a) * t
export const easeOut = (t) => 1 - (1 - t) ** 3
export const easeIn = (t) => t * t * t
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const backOut = (t) => {
  const c = 1.70158
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

/*
 * `paint(p, api)` runs on every scroll frame while the section is near the
 * viewport, and once with its resting value when it is not, so an element
 * scrolled past at speed still ends in its final state. `api.el` is the
 * section, `api.vw`/`api.vh` the viewport. `paint` must be stable (a
 * useCallback or a module-level function): the hook re-subscribes when it
 * changes.
 */
export function useScrub(ref, paint) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    let last = -1
    const api = { el, vw: 0, vh: 0 }
    const run = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      api.vw = window.innerWidth
      api.vh = vh
      const travel = r.height - vh
      const p = travel <= 0 ? 1 : clamp01(-r.top / travel)
      const near = r.bottom > -vh && r.top < vh * 2
      if (!near && (last === p || (p > 0 && p < 1))) return
      if (p === last) return
      last = p
      paint(p, api)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }
    schedule() // through a frame: reading layout right here would force one mid-commit
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ref, paint])
}
