/*
 * Motion engine for the head stack. Framework-free: it owns the timing and
 * hands a frame state to whoever renders it.
 *
 * Slots, not cards, own the look. Slot r is relative to the middle:
 *   -1 top    tilted left, tucked behind
 *    0 middle tilted right, always on top
 *   +1 bottom tilted left, its right corner tucked behind
 * Cards rotate from one slot's tilt to the next as they travel.
 *
 * Keyframes were traced from the reference recording at 30fps (whole-stack
 * position in px over a 192px step) and are stored as fractions of a step, so
 * the motion scales with the card size:
 *   SINK  0.30s  stack settles DOWN 13% of a step
 *   SLIDE 0.63s  bell-shaped velocity, lands 5% PAST the target
 *   DRIFT 0.40s  creeps back to rest
 *   REST         still until the next tick; one tick every 1.53s
 * The backdrop text counter-moves 1.4x during the sink, then travels one row
 * the other way with a ~19px overshoot that decays with the drift.
 * The arriving card takes the middle slot (top z) the instant the slide starts.
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

const STEP_PX = 192
const SINK_K = [0, 1, 3, 7, 11, 16, 20, 23, 25, 25].map((v) => v / STEP_PX)
const SLIDE_K = [0, -2, -7, -16, -29, -47, -71, -97, -123, -146, -166, -182, -195, -205, -213, -219, -223, -226, -227, -227].map(
  (v) => v / STEP_PX,
)
const DRIFT_K = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10].map((v) => v / STEP_PX)
const SINK_MAX = SINK_K[SINK_K.length - 1]
const FPS = 30
export const PERIOD = 1.53
const OVER = 19

function sample(K, t) {
  const f = Math.max(0, Math.min(K.length - 1, t * FPS))
  const i = Math.floor(f)
  if (i >= K.length - 1) return K[K.length - 1]
  return K[i] + (K[i + 1] - K[i]) * (f - i)
}
const dur = (K) => (K.length - 1) / FPS
const easeOutCubic = (u) => 1 - (1 - u) ** 3

/**
 * @param {object} o
 * @param {number} o.count      number of cards
 * @param {(s: FrameState) => void} o.onFrame   called every animation frame
 * @param {(front: number) => void} [o.onFront] called when the middle card changes
 * @param {boolean} [o.reduced] prefers-reduced-motion: step without animating
 */
export function createStackMotion({ count, onFrame, onFront, reduced = false }) {
  const N = count
  let pitch = 200 // px per step, set by setGeometry
  let row = 80 // backdrop row height, px

  let active = 0 // card the layout is centred on
  let front = 0 // card holding the middle slot (top z)
  let dir = 1
  let phase = 'rest' // rest | sink | slide | drift
  let progress = 0 // in steps; +1 = one card up
  let colRot = 0
  let bgY = 0
  let bgBase = 0
  let sinkEnd = 0
  let landed = 0
  let t0 = 0
  let tick0 = 0
  let paused = false
  let auto = true
  let raf = 0
  let running = false

  const wrap = (i) => ((i % N) + N) % N

  function emit() {
    onFrame({ active, front, progress, colRot, bgY: bgBase + bgY, phase })
  }

  function setFront(i) {
    front = i
    onFront?.(front)
  }

  function begin(d) {
    if (phase !== 'rest') return
    dir = d
    tick0 = performance.now()
    if (reduced) {
      active = wrap(active + d)
      setFront(active)
      emit()
      return
    }
    phase = 'sink'
    t0 = performance.now()
  }

  function frame(now) {
    if (!running) return
    const el = (now - t0) / 1000
    if (phase === 'rest') {
      progress = 0
      colRot = 0
      bgY = 0
      if (auto && !paused && (now - tick0) / 1000 >= PERIOD) begin(1)
    } else if (phase === 'sink') {
      const k = sample(SINK_K, el)
      progress = -dir * k
      colRot = dir * 3 * (k / SINK_MAX)
      bgY = -dir * 1.4 * k * pitch
      if (el >= dur(SINK_K)) {
        phase = 'slide'
        t0 = now
        sinkEnd = progress
        setFront(wrap(active + dir))
      }
    } else if (phase === 'slide') {
      const k = sample(SLIDE_K, el)
      const u = Math.min(1, el / dur(SLIDE_K))
      progress = sinkEnd - dir * k
      colRot = dir * 3 * (1 - u)
      const bFrom = -dir * 1.4 * SINK_MAX * pitch
      const bTo = dir * (row + OVER)
      bgY = bFrom + (bTo - bFrom) * Math.min(1, -k / 1.05)
      if (el >= dur(SLIDE_K)) {
        active = wrap(active + dir)
        progress -= dir
        bgBase += dir * row
        if (Math.abs(bgBase) >= row * 2) bgBase -= Math.sign(bgBase) * row * 2
        landed = progress
        bgY = dir * OVER
        phase = 'drift'
        t0 = now
      }
    } else if (phase === 'drift') {
      const k = sample(DRIFT_K, el)
      progress = landed - dir * k
      colRot = 0
      bgY = dir * OVER * (1 - easeOutCubic(Math.min(1, el / dur(DRIFT_K))))
      if (el >= dur(DRIFT_K)) {
        phase = 'rest'
        progress = 0
        bgY = 0
        t0 = now
      }
    }
    emit()
    raf = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      t0 = tick0 = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    begin,
    /** hold the auto timer (finger down, section off screen) */
    setPaused(v) {
      paused = v
      if (!v) tick0 = performance.now()
    },
    setAuto(v) {
      auto = v
      tick0 = performance.now()
    },
    setGeometry({ pitch: p, row: r }) {
      if (p) pitch = p
      if (r) row = r
    },
    /** call after the tab was hidden so the timer does not fire a burst */
    resetClock() {
      t0 = tick0 = performance.now()
    },
    get front() {
      return front
    },
  }
}

/**
 * @typedef {object} FrameState
 * @property {number} active   card the layout is centred on
 * @property {number} front    card in the middle slot (top z)
 * @property {number} progress travel in steps from `active`
 * @property {number} colRot   extra lean applied to every card, degrees
 * @property {number} bgY      backdrop translateY, px
 * @property {string} phase
 */
