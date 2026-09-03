import { useEffect, useRef, useState } from 'react'

/*
 * Interactive Aurora robot: loads the Blender-assembled GLB (Meshy body with
 * the head and pointing forearm split into their own nodes) and turns the
 * "Head" toward the cursor while the "ArmR" forearm points after it.
 * three.js is imported dynamically so it lands in its own chunk.
 */
export default function RobotViewer() {
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
        renderer.toneMappingExposure = 1.15
        host.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.05, 100)

        // bright studio setup — white key, cool sky fill, cyan rim
        scene.add(new THREE.HemisphereLight(0xffffff, 0xdce9f5, 0.85))
        const key = new THREE.DirectionalLight(0xffffff, 2.2)
        key.position.set(2.5, 3, 4)
        scene.add(key)
        const rim = new THREE.DirectionalLight(0x7fd8ff, 1.6)
        rim.position.set(-2, 2, -3)
        scene.add(rim)
        const fill = new THREE.DirectionalLight(0xcfe8ff, 0.9)
        fill.position.set(-3, 0.5, 3)
        scene.add(fill)

        const draco = new DRACOLoader()
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
        const loader = new GLTFLoader()
        loader.setDRACOLoader(draco)

        const gltf = await loader.loadAsync('/models/aurora-bot.glb')
        if (disposed) return
        const model = gltf.scene
        scene.add(model)

        // frame the model
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        camera.position.set(center.x, center.y + size.y * 0.12, center.z + size.y * 1.75)
        camera.lookAt(center.x, center.y + size.y * 0.08, center.z)

        const head = model.getObjectByName('Head')
        const body = model.getObjectByName('Body')
        const arm = model.getObjectByName('ArmR')

        // --- procedural face -------------------------------------------------
        // The eyes/mouth are baked into the visor texture, so we cover them
        // with visor-black patches and draw our own glowing features on top —
        // those we can blink and talk. Positions are head-local, measured off
        // the mesh with scripts/measure-aurora-face2.py.
        const EYE_RX = 0.028, EYE_RY = 0.046
        const face = {}
        if (head) {
          const inkMat = new THREE.MeshBasicMaterial({ color: 0x05080b, toneMapped: false })
          const glowMat = new THREE.MeshBasicMaterial({ color: 0x55e9f2, toneMapped: false })
          const circleGeo = new THREE.CircleGeometry(1, 40)
          const disc = (mat, rx, ry, z, y = 0) => {
            const m = new THREE.Mesh(circleGeo, mat)
            m.scale.set(rx, ry, 1)
            m.position.set(0, y, z)
            return m
          }
          const feature = (pos, normal) => {
            const g = new THREE.Group()
            g.position.set(...pos)
            g.lookAt(new THREE.Vector3(...pos).add(new THREE.Vector3(...normal).normalize()))
            head.add(g)
            return g
          }
          for (const [key, pos, normal] of [
            ['eyeL', [-0.1134, 0.2847, 0.238], [-0.23, 0.02, 0.97]],
            ['eyeR', [0.1059, 0.2734, 0.241], [0.30, 0.12, 0.95]],
          ]) {
            const g = feature(pos, normal)
            g.add(disc(inkMat, 0.064, 0.084, 0.010))
            const glow = disc(glowMat, EYE_RX, EYE_RY, 0.016)
            g.add(glow)
            face[key] = glow
          }
          const mg = feature([-0.0098, 0.168, 0.2454], [0, 0.25, 0.97])
          mg.add(disc(inkMat, 0.074, 0.036, 0.010))
          const smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 10, 28, 1.9), glowMat)
          smile.rotation.z = Math.PI * 1.5 - 0.95
          smile.position.set(0, 0.030, 0.016)
          mg.add(smile)
          const mouth = disc(glowMat, 0.030, 0.016, 0.016)
          mouth.visible = false
          mg.add(mouth)
          face.smile = smile
          face.mouth = mouth
        }
        let blinkStart = -1
        let nextBlink = performance.now() + 2600
        let talkEnd = 0
        let nextTalk = performance.now() + 2400
        if (import.meta.env.DEV) {
          // manual triggers for eyeballing the face animations
          window.__aurora = {
            blink: () => { blinkStart = performance.now() },
            talk: () => { nextTalk = 0 },
            state: () => ({
              eyeScaleY: face.eyeL?.scale.y,
              blinking: blinkStart >= 0,
              talking: performance.now() < talkEnd,
              smileVisible: face.smile?.visible,
              mouthScaleY: face.mouth?.scale.y,
            }),
          }
        }

        // cursor tracking
        let tx = 0, ty = 0
        let lastMove = 0
        const onMove = (e) => {
          const r = host.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height * 0.35
          tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 0.7)))
          ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.7)))
          lastMove = performance.now()
        }
        window.addEventListener('pointermove', onMove, { passive: true })

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
          // idle sway + wave when the cursor has been quiet
          const idle = now - lastMove > 2500 || reduced
          const gx = idle ? Math.sin(t * 0.6) * 0.35 : tx
          const gy = idle ? Math.sin(t * 0.35) * 0.1 : ty
          if (head) {
            head.rotation.y += (gx * 0.8 - head.rotation.y) * 0.08
            head.rotation.x += (gy * 0.32 - head.rotation.x) * 0.08
          }
          if (body) {
            body.rotation.y += (gx * 0.16 - body.rotation.y) * 0.045
          }
          if (arm) {
            // forearm points after the cursor; waves gently while idle
            const az = idle ? Math.sin(t * 1.6) * 0.22 : -gx * 0.55
            const ax = idle ? 0 : gy * 0.35
            arm.rotation.z += (az - arm.rotation.z) * 0.1
            arm.rotation.x += (ax - arm.rotation.x) * 0.1
          }
          if (face.eyeL) {
            // blink: quick squash-and-open every few seconds
            if (blinkStart < 0 && now >= nextBlink) {
              blinkStart = now
              nextBlink = now + 2600 + Math.random() * 4200 + (Math.random() < 0.12 ? -2300 : 0)
            }
            if (blinkStart >= 0) {
              const p = (now - blinkStart) / 240
              const s = p >= 1 ? 1 : Math.max(0.06, 1 - Math.sin(Math.PI * p))
              if (p >= 1) blinkStart = -1
              face.eyeL.scale.y = EYE_RY * s
              face.eyeR.scale.y = EYE_RY * s
            }
            // mouth: resting smile, with occasional chatter
            const talking = now < talkEnd
            if (!talking && now >= nextTalk && !reduced) {
              talkEnd = now + 1400 + Math.random() * 1600
              nextTalk = talkEnd + 2200 + Math.random() * 3500
            }
            face.smile.visible = !talking
            face.mouth.visible = talking
            if (talking) {
              const o = 0.3 + Math.abs(Math.sin(now * 0.022)) * 0.9 + Math.sin(now * 0.0071) * 0.12
              face.mouth.scale.y = 0.016 * o
              face.mouth.scale.x = 0.030 * (1.12 - 0.18 * o)
            }
          }
          renderer.render(scene, camera)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        setReady(true)

        cleanup = () => {
          cancelAnimationFrame(raf)
          window.removeEventListener('pointermove', onMove)
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
        console.error('RobotViewer failed:', err)
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
    <div className="relative h-full w-full">
      {/* ice stage behind the robot */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(46,196,222,0.16) 0%, rgba(30,155,233,0.05) 45%, transparent 70%)',
          border: '1px solid rgba(30,155,233,0.18)',
        }}
      />
      <div
        ref={hostRef}
        className={`relative h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-muted">
            Booting…
          </span>
        </div>
      )}
    </div>
  )
}
