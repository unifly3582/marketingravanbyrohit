import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { pagesFrom } from './pages.js'

/*
 * The Meta Ads card's visual, after Meta's own brand film: the blue infinity
 * loop as a glossy 3D tube turning slowly in a bright, airy space, with ad
 * panels drifting around it like cards in orbit. Fills the whole card.
 *
 * One WebGL canvas. It renders continuously only while the card is in the
 * middle of the pile; otherwise it draws a single frame and sleeps.
 */
const ADS = pagesFrom(import.meta.glob('../../assets/ads-mockups/*.webp', { eager: true, import: 'default' }))
const META_BLUE = 0x0866ff
const SKY = 0xeef3fb

/* the loop: a lemniscate whose two lobes pass over and under each other, drawn
   as a tube whose thickness swells and thins the way the logo's stroke does */
class MetaCurve extends THREE.Curve {
  getPoint(u, target = new THREE.Vector3()) {
    const t = u * Math.PI * 2
    const d = 1 + Math.sin(t) ** 2
    const x = (1.25 * Math.cos(t)) / d
    const y = (1.25 * Math.sin(t) * Math.cos(t)) / d
    const z = 0.28 * Math.sin(t)
    return target.set(x, y * 1.15, z)
  }
}

function buildLogo() {
  const curve = new MetaCurve()
  const geo = new THREE.TubeGeometry(curve, 260, 0.17, 28, true)
  // vary the stroke: thick on the outer sweeps, thin through the crossing
  const pos = geo.attributes.position
  const tmp = new THREE.Vector3()
  const centre = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 29) // 28 radial + 1
    const u = seg / 260
    const t = u * Math.PI * 2
    const k = 0.72 + 0.32 * Math.cos(2 * t + 0.9) // 0.4 .. 1.04 of base radius
    curve.getPoint(u % 1, centre)
    tmp.fromBufferAttribute(pos, i).sub(centre).multiplyScalar(k).add(centre)
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z)
  }
  geo.computeVertexNormals()
  const mat = new THREE.MeshPhysicalMaterial({
    color: META_BLUE,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  })
  return new THREE.Mesh(geo, mat)
}

export default function MetaOrbit({ active }) {
  const hostRef = useRef(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.98
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(SKY)
    scene.fog = new THREE.Fog(SKY, 4.5, 8)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.7

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
    camera.position.set(0, 0.05, 5.2)

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.5, 3, 4)
    scene.add(key)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe7f5, 0.6))

    const logo = buildLogo()
    logo.rotation.x = 0.12
    scene.add(logo)

    // ad panels in orbit: 4:5 planes on a loose ring, each bobbing on its own clock
    const loader = new THREE.TextureLoader()
    const panels = []
    const ring = [
      { a: 0.35, r: 2.1, y: 0.95, s: 0.62 },
      { a: 1.55, r: 2.35, y: -0.75, s: 0.7 },
      { a: 2.6, r: 2.0, y: 0.55, s: 0.56 },
      { a: 3.7, r: 2.4, y: -1.0, s: 0.66 },
      { a: 4.75, r: 2.15, y: 0.85, s: 0.6 },
      { a: 5.7, r: 2.5, y: -0.35, s: 0.52 },
    ]
    ADS.forEach((p, i) => {
      const spec = ring[i % ring.length]
      const tex = loader.load(p.src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.s, spec.s * 1.25), mat)
      // a soft card shadow under each panel
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.s * 1.06, spec.s * 1.25 * 1.06),
        new THREE.MeshBasicMaterial({ color: 0x9fb2d6, transparent: true, opacity: 0.25 }),
      )
      shadow.position.set(0.02, -0.03, -0.01)
      mesh.add(shadow)
      mesh.userData = spec
      scene.add(mesh)
      panels.push(mesh)
    })

    const size = () => {
      const w = host.clientWidth || 300
      const h = host.clientHeight || 220
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    size()
    const ro = new ResizeObserver(() => {
      size()
      draw(performance.now())
    })
    ro.observe(host)

    let raf = 0
    let t0 = performance.now()
    const draw = (now) => {
      const t = (now - t0) / 1000
      logo.rotation.y = t * 0.55
      logo.rotation.z = Math.sin(t * 0.6) * 0.08
      const camA = Math.sin(t * 0.25) * 0.12
      camera.position.x = Math.sin(camA) * 5.2
      camera.position.z = Math.cos(camA) * 5.2
      camera.lookAt(0, 0, 0)
      panels.forEach((m, i) => {
        const { a, r, y } = m.userData
        const ang = a + t * 0.12
        m.position.set(Math.cos(ang) * r, y + Math.sin(t * 0.7 + i) * 0.08, Math.sin(ang) * r * 0.55)
        m.lookAt(camera.position)
        m.rotation.z += Math.sin(t * 0.5 + i * 1.3) * 0.06
      })
      renderer.render(scene, camera)
    }
    const loop = (now) => {
      draw(now)
      raf = activeRef.current && !reduced ? requestAnimationFrame(loop) : 0
    }
    const wake = () => {
      if (!raf) {
        t0 = performance.now() - (wake.paused ?? 0)
        raf = requestAnimationFrame(loop)
      }
    }
    // re-check every 300ms whether we should be animating (cheap; keeps the
    // loop tied to `active` without re-creating the scene)
    const poll = setInterval(() => {
      if (activeRef.current && !reduced) wake()
    }, 300)
    draw(performance.now())
    if (active && !reduced) wake()

    return () => {
      clearInterval(poll)
      cancelAnimationFrame(raf)
      ro.disconnect()
      panels.forEach((m) => {
        m.material.map?.dispose()
        m.material.dispose()
        m.geometry.dispose()
      })
      logo.geometry.dispose()
      logo.material.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="hs-meta" aria-hidden="true" />
}
