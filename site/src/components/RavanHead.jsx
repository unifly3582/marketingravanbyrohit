import { useEffect, useRef, useState } from 'react'

/*
 * Interactive Ravan head for the hero: loads the Meshy-generated,
 * Blender-optimized GLB and turns it toward the cursor on desktop.
 * On touch devices it follows touch drags and otherwise sways idly.
 * three.js is imported dynamically so it lands in its own chunk.
 */
export default function RavanHead({ className = '' }) {
  const hostRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
        if (disposed) return

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
        renderer.setSize(host.clientWidth, host.clientHeight)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
        host.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(30, host.clientWidth / host.clientHeight, 0.05, 100)

        // warm studio: soft daylight key, gold fill, ember rim
        scene.add(new THREE.HemisphereLight(0xfff4e0, 0x241710, 1.0))
        const key = new THREE.DirectionalLight(0xffffff, 2.4)
        key.position.set(2.5, 3, 4)
        scene.add(key)
        const rim = new THREE.DirectionalLight(0xe2571e, 1.8)
        rim.position.set(-2.5, 1.5, -3)
        scene.add(rim)
        const fill = new THREE.DirectionalLight(0xf0a32f, 0.8)
        fill.position.set(-3, 0.5, 3)
        scene.add(fill)

        const draco = new DRACOLoader()
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
        const loader = new GLTFLoader()
        loader.setDRACOLoader(draco)

        const gltf = await loader.loadAsync('/models/ravan-head2-web.glb')
        if (disposed) return

        // pivot group so the head yaws/pitches around its own center
        const pivot = new THREE.Group()
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        pivot.add(model)
        scene.add(pivot)

        camera.position.set(0, size.y * 0.05, size.y * 2.1)
        camera.lookAt(0, 0, 0)

        // pointer / touch tracking
        let tx = 0, ty = 0
        let lastMove = 0
        const track = (clientX, clientY) => {
          const r = host.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          tx = Math.max(-1, Math.min(1, (clientX - cx) / (r.width * 0.9)))
          ty = Math.max(-1, Math.min(1, (clientY - cy) / (r.height * 0.9)))
          lastMove = performance.now()
        }
        const onPointer = (e) => track(e.clientX, e.clientY)
        const onTouch = (e) => {
          const t = e.touches[0]
          if (t) track(t.clientX, t.clientY)
        }
        window.addEventListener('pointermove', onPointer, { passive: true })
        window.addEventListener('touchmove', onTouch, { passive: true })
        window.addEventListener('touchstart', onTouch, { passive: true })

        const onResize = () => {
          renderer.setSize(host.clientWidth, host.clientHeight)
          camera.aspect = host.clientWidth / host.clientHeight
          camera.updateProjectionMatrix()
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(host)

        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
        let raf
        const tick = (now) => {
          const t = now / 1000
          // follow the cursor/finger; sway regally when idle
          const idle = now - lastMove > 2800 || reduced
          const gx = idle ? Math.sin(t * 0.5) * 0.4 : tx
          const gy = idle ? Math.sin(t * 0.3) * 0.12 : ty
          pivot.rotation.y += (gx * 0.7 - pivot.rotation.y) * 0.07
          pivot.rotation.x += (gy * 0.3 - pivot.rotation.x) * 0.07
          pivot.position.y = Math.sin(t * 0.8) * size.y * 0.012 // gentle breathe-bob
          renderer.render(scene, camera)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        setReady(true)

        cleanup = () => {
          cancelAnimationFrame(raf)
          window.removeEventListener('pointermove', onPointer)
          window.removeEventListener('touchmove', onTouch)
          window.removeEventListener('touchstart', onTouch)
          ro.disconnect()
          draco.dispose()
          renderer.dispose()
          renderer.domElement.remove()
          scene.traverse((o) => {
            if (o.geometry) o.geometry.dispose()
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material]
              mats.forEach((m) => {
                Object.values(m).forEach((v) => v?.isTexture && v.dispose())
                m.dispose()
              })
            }
          })
        }
      } catch (err) {
        console.error('RavanHead failed:', err)
        setFailed(true)
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  if (failed) return null

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}
