import { forwardRef } from 'react'

/*
 * One card in the pile: a service (one head). Position, tilt and z-index are
 * written straight onto the element by CardStack every frame, so this stays a
 * plain presentational component.
 */
const StackCard = forwardRef(function StackCard({ head, light, hidden }, ref) {
  return (
    <article ref={ref} className={`hs-card${light ? ' is-light' : ''}`} aria-hidden={hidden || undefined}>
      <div className="hs-eyebrow">
        <span>{head.short}</span>
        <b>{String(head.n).padStart(2, '0')}</b>
      </div>
      <h3>{head.title}</h3>
      <div className="hs-foot">
        <span className="hs-metric">{head.metric}</span>
        <span className="hs-tags">
          {head.tags.slice(0, 1).map((t) => (
            <i key={t}>{t}</i>
          ))}
        </span>
      </div>
    </article>
  )
})

export default StackCard
