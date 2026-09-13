/*
 * Scroll physics for the head stack. Framework-free: the owner feeds it the
 * scroll position every frame and it hands back where everything sits.
 *
 * Slots, not cards, own the look. Slot r is relative to the middle:
 *   -1 top    tilted left, tucked behind
 *    0 middle tilted right, always on top
 *   +1 bottom tilted left, its right corner tucked behind
 * Cards rotate from one slot's tilt to the next as they travel.
 *
 * The pile position `p` (in cards) chases the scroll's position `s` through
 * a spring, so it rides with the thumb but carries weight: it lags a touch
 * behind a fast drag, leans into the motion, and settles with a small
 * overshoot when the scroll stops, the same settle traced from the
 * reference recording. The card nearest the middle holds the top z-index.
 * The backdrop wordmark counter-scrolls one row per card.
 */

const SLOT = {
  '-3': { tilt: -11, x: 4 },
  '-2': { tilt: 8, x: -3 },
  '-1': { tilt: -12, x: -5 },
  0: { tilt: 9, x: 0 },
  1: { tilt: -10, x: 6 },
  2: { tilt: 7, x: -4 },
  3: { tilt: -11, x: 3 },
}
const slotAt = (s) => SLOT[String(Math.max(-3, Math.min(3, s)))]

/** Look of a card sitting at fractional slot `s`: blend of the two nearest slots. */
export function lookAt(s) {
  const a = Math.floor(s)
  const t = s - a
  const A = slotAt(a)
  const B = slotAt(a + 1)
  return { tilt: A.tilt + (B.tilt - A.tilt) * t, x: A.x + (B.x - A.x) * t }
}

/* spring: natural frequency ~12 rad/s (a quarter-second response), damping
   ratio 0.7 so it lands about 5% past and comes back, as in the reference */
const STIFFNESS = 150
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.7
const LEAN_PER_CARD_PER_S = 2.2 // degrees of lean per card/s of pile velocity
const LEAN_MAX = 7
const IDLE_MS = 160 // scroll quiet for this long counts as "finger lifted"

/**
 * @param {object} o
 * @param {number} o.count                number of cards
 * @param {() => number} o.readScroll     scroll position in cards (0 .. count-1), called every frame
 * @param {(s: FrameState) => void} o.onFrame
 * @param {(front: number) => void} [o.onFront]  when the card nearest the middle changes
 * @param {boolean} [o.snapWhenIdle]      pull the pile to the nearest card once the scroll is quiet
 *                                        (for pointers without native scroll-snap)
 * @param {boolean} [o.reduced]           prefers-reduced-motion: no spring, no lean
 */
export function createStackMotion({ count, readScroll, onFrame, onFront, snapWhenIdle = false, reduced = false }) {
  const N = count
  let row = 80 // backdrop row height, px

  let p = 0 // pile position, cards
  let v = 0 // cards per second
  let front = 0
  let lastS = 0
  let lastMove = 0
  let last = 0
  let raf = 0
  let running = false

  const clampIdx = (x) => Math.max(0, Math.min(N - 1, x))

  function setFront(i) {
    if (i === front) return
    front = i
    onFront?.(front)
  }

  function frame(now) {
    if (!running) return
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
    last = now

    const s = clampIdx(readScroll())
    if (Math.abs(s - lastS) > 1e-3) lastMove = now
    lastS = s

    // once the finger is up, land on a whole card
    const quiet = now - lastMove > IDLE_MS
    const target = snapWhenIdle && quiet ? Math.round(s) : s

    if (reduced) {
      p = target
      v = 0
    } else {
      const a = STIFFNESS * (target - p) - DAMPING * v
      v += a * dt
      p += v * dt
      if (Math.abs(target - p) < 0.0005 && Math.abs(v) < 0.002) {
        p = target
        v = 0
      }
    }

    setFront(clampIdx(Math.round(p)))
    const lean = reduced ? 0 : Math.max(-LEAN_MAX, Math.min(LEAN_MAX, v * LEAN_PER_CARD_PER_S))
    const bgY = (((p % 2) + 2) % 2) * row // wordmark repeats every two rows

    onFrame({ p, v, front, lean, bgY })
    raf = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    setGeometry({ row: r }) {
      if (r) row = r
    },
    get position() {
      return p
    },
    get velocity() {
      return v
    },
    get front() {
      return front
    },
  }
}

/**
 * @typedef {object} FrameState
 * @property {number} p      pile position in cards; card i sits at slot i - p
 * @property {number} v      pile velocity, cards per second
 * @property {number} front  card nearest the middle (top z)
 * @property {number} lean   extra tilt from velocity, degrees
 * @property {number} bgY    backdrop translateY, px
 */
