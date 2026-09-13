import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { pagesFrom } from './pages.js'

/*
 * The Meta Ads card's visual, after Meta's own brand film: Meta's symbol,
 * built from its official outline, as a glossy 3D piece turning slowly in a
 * bright, airy space, with ad panels drifting around it like cards in orbit.
 * Fills the whole card.
 *
 * One WebGL canvas. It renders continuously only while the card is in the
 * middle of the pile; otherwise it draws a single frame and sleeps.
 */
const ADS = pagesFrom(import.meta.glob('../../assets/ads-mockups/*.webp', { eager: true, import: 'default' }))
const SKY = 0xeef3fb

/* Meta's symbol, exactly: the official outline (24x24 vector), extruded with
   deep rounded bevels so the cross-section is close to a round tube, which
   is how the film renders it. Colour is the brand gradient the mark ships
   with: #0064E0 on the left sweeping to #0082FB on the right. */
const META_PATH =
  'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z'
const BLUE_L = new THREE.Color(0x0064e0)
const BLUE_R = new THREE.Color(0x0082fb)

function buildLogo() {
  const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${META_PATH}"/></svg>`)
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path))
  const geo = new THREE.ExtrudeGeometry(shapes, {
    // stroke is ~2.2 units wide at its thickest; total depth 0.3 + 2 x 0.95
    // matches it, so the cross-section is close to round, like the film's tube
    depth: 0.3,
    steps: 1,
    curveSegments: 36,
    bevelEnabled: true,
    bevelThickness: 0.95,
    bevelSize: 1.0,
    bevelOffset: -1.0, // bevel eats into the outline instead of fattening it
    bevelSegments: 14,
  })
  geo.center()
  // SVG y runs down; face the camera and size to ~2.9 units wide
  geo.rotateX(Math.PI)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const scale = 2.9 / (bb.max.x - bb.min.x)
  geo.scale(scale, scale, scale)
  geo.computeBoundingBox()
  geo.computeVertexNormals()
  // brand gradient across x, baked as vertex colours
  const { min, max } = geo.boundingBox
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - min.x) / (max.x - min.x)
    c.copy(BLUE_L).lerp(BLUE_R, u)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
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
