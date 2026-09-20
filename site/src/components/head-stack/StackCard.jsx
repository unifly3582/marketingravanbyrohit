import { forwardRef } from 'react'
import { HeadIcons } from '../icons.jsx'
import './service-heading.css'

/*
 * One card in the pile: a service (one head). Position, tilt and z-index are
 * written straight onto the element by CardStack every frame, so this stays a
 * plain presentational component. `head.hl`, when set, is the opening words
 * of the title the skin may colour as the accent line. `visual`, when given, fills the card and
 * the text rides on top of it; `skin` is an extra class for cards whose
 * visual sets the whole look (the Meta card's bright blue field). `lite`
 * cards are far from the front and out of sight: an empty shell of the
 * right size, filled in once they come near.
 */
const StackCard = forwardRef(function StackCard({ head, light, hidden, visual, skin, lite }, ref) {
  if (lite) {
    return (
      <article
        ref={ref}
        className={`hs-card${light ? ' is-light' : ''}${visual ? ' has-visual' : ''}${skin ? ` ${skin}` : ''}`}
        aria-hidden="true"
      />
    )
  }
  /* a head with its own story page: the front card opens it. Any click that
     is not on a control inside the visual (the showcases have their own
     buttons) goes to the page; the pill in the masthead says so and gives
     the keyboard a real link. */
  const page = head.page && !hidden ? head.page : null
  const open = page
    ? (e) => {
        if (e.target.closest('a, button, input, textarea')) return
        window.location.assign(page)
      }
    : undefined
  return (
    <article
      ref={ref}
      className={`hs-card${light ? ' is-light' : ''}${visual ? ' has-visual' : ''}${skin ? ` ${skin}` : ''}${page ? ' has-page' : ''}`}
      aria-hidden={hidden || undefined}
      onClick={open}
    >
      <div className="hs-service-heading">
        <span><svg viewBox="0 0 24 24" aria-hidden="true">{HeadIcons[head.icon]}</svg>{head.short}</span>
        {page ? (
          <a className="hs-open" href={page} aria-label={`Open the ${head.short.toLowerCase()} page`}>
            Open
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        ) : null}
        <b>{String(head.n).padStart(2, '0')}</b>
      </div>
      {visual ? <div className="hs-visual">{visual}</div> : null}
      <h3>
        {head.hl && head.title.startsWith(head.hl) ? (
          <>
            <em>{head.hl}</em>
            {head.title.slice(head.hl.length)}
          </>
        ) : (
          head.title
        )}
      </h3>
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
