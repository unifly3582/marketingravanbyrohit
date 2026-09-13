import { forwardRef } from 'react'

/*
 * One card in the pile: a service (one head). Position, tilt and z-index are
 * written straight onto the element by CardStack every frame, so this stays a
 * plain presentational component. `visual`, when given, fills the card and
 * the text rides on top of it; `skin` is an extra class for cards whose
 * visual sets the whole look (the Meta card's bright blue field).
 */
const StackCard = forwardRef(function StackCard({ head, light, hidden, visual, skin }, ref) {
  return (
    <article
      ref={ref}
      className={`hs-card${light ? ' is-light' : ''}${visual ? ' has-visual' : ''}${skin ? ` ${skin}` : ''}`}
      aria-hidden={hidden || undefined}
    >
      <div className="hs-eyebrow">
        <span>{head.short}</span>
        <b>{String(head.n).padStart(2, '0')}</b>
      </div>
      {visual ? <div className="hs-visual">{visual}</div> : null}
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
