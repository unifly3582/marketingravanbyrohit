/* One dot per card; the middle card's dot is lit. */
export default function StackDots({ count, current }) {
  return (
    <div className="hs-dots" role="tablist" aria-label="Heads">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i === current ? 'on' : undefined} role="tab" aria-selected={i === current} />
      ))}
    </div>
  )
}
