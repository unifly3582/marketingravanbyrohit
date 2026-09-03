import { HEADS } from '../data/heads.js'
import { Flame } from './icons.jsx'

export default function Marquee() {
  const items = HEADS.map((h) => h.title)
  return (
    <div className="mt-14 overflow-hidden border-y border-line py-5" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center gap-10">
            {items.map((t) => (
              <span key={half + t} className="flex items-center gap-10">
                <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.2em] text-cream/45">
                  {t}
                </span>
                <Flame className="h-3.5 w-3.5 shrink-0 text-ember/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
