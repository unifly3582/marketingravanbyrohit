import { useEffect, useRef, useState } from 'react'

/*
 * Interactive 3D Ravan head. Boots one persistent renderer, then swaps the
 * model whenever `src` changes — loads are cached module-wide and scenes are
 * cloned, so the two arc hosts flip between personality heads instantly.
 * Turns toward the cursor on desktop, follows touch on mobile, sways idly.
 */

const FALLBACK_SRC = '/models/ravan-head2-web.glb'

// src -> Promise<gltf>; shared across instances so each file loads once
const gltfCache = new Map()
function loadCached(loader, src) {
  if (!gltfCache.has(src)) {
    const p = loader.loadAsync(src)
    p.catch(() => gltfCache.delete(src)) // let a failed load retry later
    gltfCache.set(src, p)
  }
  return gltfCache.get(src)
}

export default function RavanHead({ src = FALLBACK_SRC, className = '' }) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const [booted, setBooted] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // boot the renderer, lights, camera and loop once
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

        const pivot = new THREE.Group()
        scene.add(pivot)
        let sizeY = 1

        const setModel = (model) => {
          pivot.clear()
          const box = new THREE.Box3().setFromObject(model)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          model.position.sub(center)
          pivot.add(model)
          sizeY = size.y
          camera.position.set(0, sizeY * 0.05, sizeY * 2.1)
          camera.lookAt(0, 0, 0)
        }

        apiRef.current = { THREE, loader, setModel }

        // pointer / touch tracking
        let tx = 0, ty = 0
        let lastMove = 0
        const track = (clientX, clientY) => {
          const r = host.getBoundingClientRect()
          tx = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width * 0.9)))
          ty = Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (r.height * 0.9)))
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
          const idle = now - lastMove > 2800 || reduced
          const gx = idle ? Math.sin(t * 0.5) * 0.4 : tx
          const gy = idle ? Math.sin(t * 0.3) * 0.12 : ty
          pivot.rotation.y += (gx * 0.7 - pivot.rotation.y) * 0.07
          pivot.rotation.x += (gy * 0.3 - pivot.rotation.x) * 0.07
          pivot.position.y = Math.sin(t * 0.8) * sizeY * 0.012
          renderer.render(scene, camera)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        setBooted(true)

        cleanup = () => {
          cancelAnimationFrame(raf)
          window.removeEventListener('pointermove', onPointer)
          window.removeEventListener('touchmove', onTouch)
          window.removeEventListener('touchstart', onTouch)
          ro.disconnect()
          draco.dispose()
          renderer.dispose()
          renderer.domElement.remove()
          // cached gltf assets are shared between instances; only the
          // renderer-local resources are torn down here
        }
      } catch (err) {
        console.error('RavanHead boot failed:', err)
        setFailed(true)
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  // load / swap the model whenever src changes
  useEffect(() => {
    if (!booted) return
    const api = apiRef.current
    let stale = false
    ;(async () => {
      try {
        const gltf = await loadCached(api.loader, src)
        if (stale) return
        api.setModel(gltf.scene.clone(true))
        setReady(true)
      } catch (err) {
        console.warn(`RavanHead: ${src} failed, using fallback`, err)
        try {
          const gltf = await loadCached(api.loader, FALLBACK_SRC)
          if (stale) return
          api.setModel(gltf.scene.clone(true))
          setReady(true)
        } catch (err2) {
          console.error('RavanHead: fallback failed too', err2)
          setFailed(true)
        }
      }
    })()
    return () => { stale = true }
  }, [booted, src])

  if (failed) return null

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}
