/*
 * The hero's grain shader, off the main thread. ShaderGrain.jsx transfers its
 * canvas here as an OffscreenCanvas; compiling the shader and drawing every
 * frame then never compete with scrolling, the face flicker or React.
 *
 * Messages in:  { type: 'init', canvas, opts } · { type: 'resize', w, h }
 *               { type: 'start' } · { type: 'stop' } · { type: 'destroy' }
 * Messages out: { type: 'ready', ok }
 */
import { createGrainRenderer } from './grainRenderer.js'

let renderer = null

self.onmessage = (e) => {
  const m = e.data
  switch (m.type) {
    case 'init':
      renderer = createGrainRenderer(m.canvas, { ...m.opts, onReady: (ok) => self.postMessage({ type: 'ready', ok }) })
      renderer.resize(m.w, m.h)
      break
    case 'resize':
      renderer?.resize(m.w, m.h)
      break
    case 'start':
      renderer?.start()
      break
    case 'stop':
      renderer?.stop()
      break
    case 'destroy':
      renderer?.destroy()
      renderer = null
      self.close()
      break
  }
}
