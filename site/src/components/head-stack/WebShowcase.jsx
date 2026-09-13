import { useEffect, useState } from 'react'

/*
 * The Website Design card's visual: a stack of tall landing-page mockups
 * inside a small browser window. The current page pans slowly downward, as
 * if scrolling, then crossfades to the next. Runs only while the card is in
 * the middle of the pile; other cards show their first page still. No
 * video: six WebP images, ~40 KB each, crisp at any pixel density.
 */
const pages = Object.entries(import.meta.glob('../../assets/web-mockups/*.webp', { eager: true, import: 'default' }))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => ({ key: path.split('/').pop().replace('.webp', ''), src }))

const HOLD_MS = 5200 // one page, including its pan
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function WebShowcase({ active }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!active || reduced || pages.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % pages.length), HOLD_MS)
    return () => clearInterval(id)
  }, [active])

  if (!pages.length) return null
  return (
    <div className="hs-browser" aria-hidden="true">
      <div className="hs-browser-bar">
        <i />
        <i />
        <i />
        <span>{pages[i].key}.in</span>
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
