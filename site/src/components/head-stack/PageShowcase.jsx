import { useEffect, useState } from 'react'

/*
 * A card's visual: a stack of tall screen mockups inside a small window.
 * The current screen pans slowly downward, as if scrolling, then crossfades
 * to the next. Runs only while the card is in the middle of the pile; other
 * cards show their first screen still. No video: WebP images, 30-70 KB each,
 * crisp at any pixel density.
 *
 * `pages` is a list of { key, src }; build one with `pagesFrom()` from pages.js.
 * `label(key)` names the screen in the window's title pill.
 */
const HOLD_MS = 5200 // one screen, including its pan
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function PageShowcase({ active, pages, label = (key) => key }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!active || reduced || pages.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % pages.length), HOLD_MS)
    return () => clearInterval(id)
  }, [active, pages.length])

  if (!pages.length) return null
  return (
    <div className="hs-browser" aria-hidden="true">
      <div className="hs-browser-bar">
        <i />
        <i />
        <i />
        <span>{label(pages[i].key)}</span>
      </div>
      <div className="hs-browser-view">
        {pages.map((p, k) => (
          <img
            key={p.key}
            src={p.src}
            alt=""
            loading={k === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={`hs-page${k === i ? ' is-on' : ''}${active && !reduced ? ' is-live' : ''}`}
            style={{ '--hold': `${HOLD_MS}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
