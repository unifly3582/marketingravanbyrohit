import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { pagesFrom } from './pages.js'

/*
 * The Meta Ads card's visual, after Meta's brand film: a looping 16-second
 * sequence of shots inside one bright 3D space.
 *
 *   0-4s   the Meta symbol turns in the middle, ad panels orbit it, tag chips
 *          drift past like the film's LAYOUT / MOVE / COLOR tags
 *   4-8s   push in: one ad panel comes to the front and fills the frame,
 *          a Sponsored chip and a burst of likes
 *   8-13s  the catch: the Meta Ads head leans out of an ad frame with a net
 *          full of customers and money (a nano banana frame), fitted to the
 *          card's height
 *   13-16s pull back out to the symbol and loop
 *
 * Built from Meta's official symbol outline (extruded, brand gradient). One
 * WebGL canvas that animates only while the card is in the middle of the pile.
 */
const ADS = pagesFrom(import.meta.glob('../../assets/ads-mockups/*.webp', { eager: true, import: 'default' }))
const CATCH = pagesFrom(import.meta.glob('../../assets/catch-mockups/*.webp', { eager: true, import: 'default' }))[0]
const SKY = 0xeef3fb
const LOOP = 16

/* Meta's symbol, exactly: the official outline (24x24 vector), extruded with
   deep rounded bevels sized to the stroke so the cross-section is close to a
   round tube. Colour is the brand gradient the mark ships with. */
const META_PATH =
  'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z'
const BLUE_L = new THREE.Color(0x0064e0)
const BLUE_R = new THREE.Color(0x0082fb)

function buildLogo() {
  const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${META_PATH}"/></svg>`)
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path))
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.3,
    steps: 1,
    curveSegments: 36,
    bevelEnabled: true,
    bevelThickness: 0.95,
    bevelSize: 1.0,
    bevelOffset: -1.0,
    bevelSegments: 14,
  })
  geo.center()
  geo.rotateX(Math.PI)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const scale = 2.9 / (bb.max.x - bb.min.x)
  geo.scale(scale, scale, scale)
  geo.computeBoundingBox()
  geo.computeVertexNormals()
  const { min, max } = geo.boundingBox
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(BLUE_L).lerp(BLUE_R, (pos.getX(i) - min.x) / (max.x - min.x))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.24, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.3 })
  return new THREE.Mesh(geo, mat)
}

/* a pill chip drawn on a canvas: white pill, dark text, hairline border */
function chipTexture(text, { bg = '#ffffff', fg = '#1c2b4a', accent = null } = {}) {
  const dpr = 2
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')
  const font = `600 ${22 * dpr}px "Instrument Sans", "Segoe UI", system-ui, sans-serif`
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width + (accent ? 54 : 40) * dpr)
  const h = 44 * dpr
  cv.width = w
  cv.height = h
  ctx.font = font
  ctx.fillStyle = bg
  ctx.strokeStyle = 'rgba(28,43,74,0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(1, 1, w - 2, h - 2, h / 2)
  ctx.fill()
  ctx.stroke()
  if (accent) {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(22 * dpr, h / 2, 6 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, (accent ? 34 : 20) * dpr, h / 2 + 1)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, aspect: w / h }
}
function chip(text, height, opts) {
  const { tex, aspect } = chipTexture(text, opts)
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(height * aspect, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
  )
  m.renderOrder = 5
  return m
}

const clamp01 = (u) => Math.max(0, Math.min(1, u))
const smooth = (u) => {
  const x = clamp01(u)
  return x * x * (3 - 2 * x)
}
/** 0 -> 1 over [a, b], smoothstepped */
const seg = (t, a, b) => smooth((t - a) / (b - a))
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
    scene.fog = new THREE.Fog(SKY, 5, 9)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.7

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.5, 3, 4)
    scene.add(key, new THREE.HemisphereLight(0xffffff, 0xdfe7f5, 0.6))

    const logo = buildLogo()
    scene.add(logo)

    // ---- ad panels on a loose ring
    const loader = new THREE.TextureLoader()
    const ring = [
      { a: 0.35, r: 2.1, y: 0.95, s: 0.62 },
      { a: 1.55, r: 2.35, y: -0.75, s: 0.7 },
      { a: 2.6, r: 2.0, y: 0.55, s: 0.56 },
      { a: 3.7, r: 2.4, y: -1.0, s: 0.66 },
      { a: 4.75, r: 2.15, y: 0.85, s: 0.6 },
      { a: 5.7, r: 2.5, y: -0.35, s: 0.52 },
    ]
    const panels = ADS.map((p, i) => {
      const spec = ring[i % ring.length]
      const tex = loader.load(p.src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.s, spec.s * 1.25),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      )
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.s * 1.06, spec.s * 1.25 * 1.06),
        new THREE.MeshBasicMaterial({ color: 0x9fb2d6, transparent: true, opacity: 0.25 }),
      )
      shadow.position.set(0.02, -0.03, -0.01)
      mesh.add(shadow)
      mesh.userData = { ...spec, key: p.key }
      scene.add(mesh)
      return mesh
    })
    // the ad that comes forward: the Instagram post if we have it
    const hero = panels.find((m) => m.userData.key === 'instagram') ?? panels[0]
    // the catch frame: Ravan out of an ad with a net; comes forward for the catch shot
    let catcher = null
    if (CATCH) {
      const spec = { a: 3.1, r: 2.3, y: 0.2, s: 0.66, key: 'catch' }
      const tex = loader.load(CATCH.src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      catcher = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.s, spec.s * 1.25),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      )
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.s * 1.06, spec.s * 1.25 * 1.06),
        new THREE.MeshBasicMaterial({ color: 0x9fb2d6, transparent: true, opacity: 0.25 }),
      )
      shadow.position.set(0.02, -0.03, -0.01)
      catcher.add(shadow)
      catcher.userData = spec
      scene.add(catcher)
      panels.push(catcher)
    }

    // ---- floating tag chips, like the film's LAYOUT / MOVE / COLOR
    const TAGS = ['REELS', 'RETARGETING', 'LOOKALIKE 1%', 'A/B TEST', 'CREATIVE', 'CATALOG']
    const tags = TAGS.map((t, i) => {
      const m = chip(t, 0.2)
      m.userData = { x: -2.6 + ((i * 1.05) % 5.2), y: -1.4 + ((i * 1.7) % 2.8), z: -0.8 + ((i * 0.9) % 1.8), v: 0.12 + (i % 3) * 0.04 }
      scene.add(m)
      return m
    })

    // ---- the ad's dressing for the push-in: Sponsored chip and likes
    const sponsored = chip('Sponsored', 0.16, { accent: '#0a6cff' })
    const likes = ['❤ 2,318', '❤ 3,102', '❤ 4,860'].map((t) => chip(t, 0.16, { fg: '#e0245e' }))
    ;[sponsored, ...likes].forEach((o) => {
      o.visible = false
      scene.add(o)
    })
    const setAlpha = (obj, a) => {
      const mats = obj.userData?.mats ?? (obj.material ? [obj.material] : [])
      mats.forEach((m) => {
        m.opacity = a
      })
      obj.visible = a > 0.01
    }

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

    // ---- the sequence
    const camPos = new THREE.Vector3()
    const camAt = new THREE.Vector3()
    const heroHome = new THREE.Vector3()
    const heroFront = new THREE.Vector3(-0.7, 0.05, 2.9)
    const heroSide = new THREE.Vector3(-1.35, 0.5, 2.0) // where the ad waits during the catch
    const catchFront = new THREE.Vector3(0, 0, 3.0)
    const catchHome = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    let raf = 0
    const t0 = performance.now()

    const draw = (now) => {
      const T = (now - t0) / 1000
      const t = T % LOOP
      const zoomIn = seg(t, 4, 5.6) - seg(t, 13, 14.6) // 0 wide, 1 on the hero
      const catching = seg(t, 8, 8.6) - seg(t, 12.6, 13.4)

      // symbol: turns in the wide shot, steps back and shrinks during the close shots
      logo.rotation.y = T * 0.55
      logo.rotation.z = Math.sin(T * 0.6) * 0.08
      logo.position.set(1.1 * zoomIn, 0.35 * zoomIn, -1.6 * zoomIn)
      logo.scale.setScalar(1 - 0.45 * zoomIn)

      // camera: slow drift wide, a gentle push during the close shots
      const camA = Math.sin(T * 0.25) * 0.12
      const dist = 5.2 - 0.6 * zoomIn
      camPos.set(Math.sin(camA) * dist, 0.05 + 0.05 * zoomIn, Math.cos(camA) * dist)
      camAt.set(-0.25 * zoomIn, 0, 0)
      camera.position.copy(camPos)
      camera.lookAt(camAt)

      // panels orbit; the hero leaves its slot and comes to the front, larger
      panels.forEach((m, i) => {
        const { a, r, y } = m.userData
        const ang = a + T * 0.12
        tmp.set(Math.cos(ang) * r, y + Math.sin(T * 0.7 + i) * 0.08, Math.sin(ang) * r * 0.55)
        if (m === hero) {
          heroHome.copy(tmp)
          m.position.lerpVectors(heroHome, heroFront, zoomIn).lerp(heroSide, catching)
          m.scale.setScalar((1 + 1.55 * zoomIn) * (1 - 0.5 * catching))
          m.lookAt(camera.position)
          m.rotation.z += (1 - zoomIn) * Math.sin(T * 0.5 + i * 1.3) * 0.06
        } else if (m === catcher) {
          catchHome.copy(tmp)
          catchHome.z -= 1.2 * zoomIn * (1 - catching)
          m.position.lerpVectors(catchHome, catchFront, catching)
          const dCam = camera.position.distanceTo(catchFront)
          const viewH = 2 * dCam * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
          const fit = (viewH * 0.98) / (m.userData.s * 1.25) // full card height, no crop
          m.scale.setScalar((1 - 0.25 * zoomIn) * (1 - catching) + fit * catching)
          m.lookAt(camera.position)
          m.rotation.z += (1 - catching) * Math.sin(T * 0.5 + i * 1.3) * 0.06
        } else {
          tmp.z -= 1.2 * zoomIn // the others drift back so the hero owns the frame
          m.position.copy(tmp)
          m.scale.setScalar(1 - 0.25 * zoomIn)
          m.lookAt(camera.position)
          m.rotation.z += Math.sin(T * 0.5 + i * 1.3) * 0.06
        }
      })

      // tag chips rise slowly and wrap; they hide during the close shots
      tags.forEach((m) => {
        const d = m.userData
        const y = ((d.y + T * d.v + 1.4) % 2.8) - 1.4
        m.position.set(d.x, y, d.z)
        m.lookAt(camera.position)
        setAlpha(m, (1 - zoomIn) * (0.35 + 0.65 * (1 - Math.abs(y) / 1.4)))
      })

      // ---- close shot dressing: Sponsored chip and likes bursting off the ad
      const heroW = hero.userData.s * hero.scale.x
      const heroH = heroW * 1.25
      sponsored.position.copy(hero.position).add(tmp.set(-heroW * 0.42, heroH * 0.52, 0.05))
      sponsored.lookAt(camera.position)
      setAlpha(sponsored, (seg(t, 5.2, 5.7) - seg(t, 13, 13.4)) * (1 - catching))
      likes.forEach((m, i) => {
        const start = 6 + i * 0.55
        const u = seg(t, start, start + 1.6)
        m.position.copy(hero.position).add(tmp.set(heroW * 0.35 + i * 0.12, -heroH * 0.2 + u * 0.9, 0.06))
        m.lookAt(camera.position)
        m.scale.setScalar(0.8 + 0.4 * u)
        setAlpha(m, (u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0) * (1 - catching))
      })

      renderer.render(scene, camera)
    }
    const loop = (now) => {
      draw(now)
      raf = activeRef.current && !reduced ? requestAnimationFrame(loop) : 0
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const poll = setInterval(() => {
      if (activeRef.current && !reduced) wake()
    }, 300)
    draw(performance.now())
    if (active && !reduced) wake()

    return () => {
      clearInterval(poll)
      cancelAnimationFrame(raf)
      ro.disconnect()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const mats = o.material ? [o.material] : []
        mats.forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
      })
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="hs-meta" aria-hidden="true" />
}
