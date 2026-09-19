import { useEffect, useRef } from 'react'
import { createGrainRenderer } from './grainRenderer.js'

/*
 * Animated grain-gradient background (beew.studio style): a WebGL2 turbulence
 * shader that blends a small palette in OKLab and dusts it with film grain.
 * Colors + tuning are props so the same canvas can run silver or ember.
 *
 * The drawing lives in grainRenderer.js. Where the browser allows it the
 * canvas is handed to a worker (grain.worker.js) and the shader compiles and
 * draws off the main thread, so it can never stall the scroll or the hero's
 * face flicker on a slow phone. Elsewhere the same renderer runs here. This
 * component only decides *when* to draw: it pauses off screen and in hidden
 * tabs, renders at a lower pixel ratio on phones, honours reduced motion,
 * and shows a still CSS field until the shader's first frame.
 */

/* a still of the field (public/grain-still.webp, a few KB, captured from the
   shader by scripts/capture-grain-still.mjs): shown until the shader draws,
   and for good when there is no WebGL2 (iOS < 15, GPU-blocklisted or
   hardware-acceleration-off browsers). A gradient underneath covers the
   moment before the still has loaded. */
const FALLBACK = 'url(/grain-still.webp) center / cover no-repeat, radial-gradient(120% 80% at 30% 20%, #ffffff 0%, #e6e6e6 32%, #c4c4c4 62%, #8f8f8f 100%)'

const canWork = () =>
  typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype

export default function ShaderGrain({
  colors = ['#FFFFFF', '#E0E0E0', '#BABABA', '#707070'],
  seed = 2, // chosen so the textured region stays in-frame at the hero's aspect
  speed = 0.1,
  scale = 0.62,
  turbAmp = 1,
  turbFreq = 0.61,
  turbIter = 5,
  waveFreq = 1.3,
  distBias = 0,
  dither = 0.1,
  exposure = 1.1,
  contrast = 1.1,
  saturation = 1,
  // The field looks composed for shader-time 0..~30s, then washes out for long
  // stretches. Glide back and forth through that window on a cosine so the
  // shapes morph forever without ever going flat (or reversing abruptly).
  loopSpan = 60,
  loopPeriod = 50,
  className = '',
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    // phones: half the pixels and every other frame; the grain hides both,
    // and a full-screen turbulence shader at 1.5x is what made low-end
    // phones drop frames on everything else in the hero
    const phone = matchMedia('(max-width: 767px), (pointer: coarse)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1 : 1.5)
    const opts = { colors, seed, speed, scale, turbAmp, turbFreq, turbIter, waveFreq, distBias, dither, exposure, contrast, saturation, loopSpan, loopPeriod, dpr, everyOther: phone }

    canvas.style.background = FALLBACK
    const onReady = (ok) => {
      if (ok) canvas.style.background = ''
      else canvas.style.background = FALLBACK
    }

    // The drawing engine, behind one small interface whichever thread it is on.
    // A canvas can be transferred to a worker only once, and React StrictMode
    // mounts twice in development, so the worker is kept on the element and
    // reused; it is closed only when the canvas has really left the page.
    let engine = null
    let onScreen = true
    let pageVisible = !document.hidden
    const wanted = () => !reduced && onScreen && pageVisible
    const sync = () => engine && (wanted() ? engine.start() : engine.stop())

    const boot = () => {
      if (canWork()) {
        let slot = canvas.__grain
        if (!slot) {
          try {
            const offscreen = canvas.transferControlToOffscreen()
            const worker = new Worker(new URL('./grain.worker.js', import.meta.url), { type: 'module' })
            worker.postMessage({ type: 'init', canvas: offscreen, opts, w: Math.round(canvas.clientWidth * dpr), h: Math.round(canvas.clientHeight * dpr) }, [offscreen])
            slot = canvas.__grain = { worker }
          } catch {
            slot = null
          }
        }
        if (slot) {
          const { worker } = slot
          worker.onmessage = (e) => e.data.type === 'ready' && onReady(e.data.ok)
          worker.onerror = () => onReady(false)
          engine = {
            resize: (w, h) => worker.postMessage({ type: 'resize', w, h }),
            start: () => worker.postMessage({ type: 'start' }),
            stop: () => worker.postMessage({ type: 'stop' }),
            destroy: () => {
              worker.onmessage = null
              // StrictMode remounts on the same, still-connected canvas
              setTimeout(() => {
                if (!canvas.isConnected) {
                  worker.postMessage({ type: 'destroy' })
                  delete canvas.__grain
                }
              }, 0)
            },
          }
        }
      }
      if (!engine) {
        const r = createGrainRenderer(canvas, { ...opts, onReady })
        r.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr))
        engine = r
      }
      sync()
    }

    const ro = new ResizeObserver(() => {
      engine?.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr))
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      sync()
    })
    io.observe(canvas)
    const onVisibility = () => {
      pageVisible = !document.hidden
      sync()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // The shader starts only after the page has been *presented*: creating
    // the context and compiling the shader occupy the GPU process for a
    // moment, and while they run the compositor cannot put a frame on
    // screen. Two animation frames means the first paint is out; the beat
    // after lets the first face and copy settle. The still field is on
    // screen meanwhile.
    let raf1 = 0
    let raf2 = 0
    let startId = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        startId = setTimeout(boot, 700)
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(startId)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      engine?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors.join(','), seed, speed, scale, turbAmp, turbFreq, turbIter, waveFreq, distBias, dither, exposure, contrast, saturation, loopSpan, loopPeriod])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
