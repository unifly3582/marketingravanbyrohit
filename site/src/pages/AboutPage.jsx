import StatsStrip from '../components/StatsStrip.jsx'
import Contact from '../components/Contact.jsx'

const APPROACH = [
  ['Think deeply', 'Strategy before spend. Every head starts with the same question: where does automation pay back first?'],
  ['Automate ruthlessly', 'If a task repeats, an agent inherits it. Your people keep the judgment calls; the machines keep the treadmill.'],
  ['Ship weekly', 'No six-month roadmaps. Something goes live in your business every single week, and dashboards prove it.'],
]

const ASYNC = [
  ['Async first', 'Progress lands in your channel while you sleep — not in meetings.'],
  ['Documented decisions', 'Every automation, prompt and pipeline is written down and yours to keep.'],
  ['Focused calls', 'One war-room call a week. Everything else is a message away.'],
  ['Shared dashboards', 'You watch the same numbers we do, live.'],
]

export default function AboutPage() {
  return (
    <>
      <section className="container-x pt-36 pb-20">
        <p className="eyebrow">About</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold md:text-6xl">
          A ten-headed studio built for ambitious operators.
        </h1>
        <p className="mt-6 max-w-xl text-muted">
          Marketing Ravan exists because growth work fractured into ten
          specialties — and hiring ten teams is how budgets die. We fused them
          back into one AI-first unit that plans like a strategist and executes
          like a machine.
        </p>
      </section>

      {/* approach — LIGHT */}
      <section className="theme-light border-y border-line">
        <div className="container-x py-24">
          <p className="eyebrow">Our approach</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            Think deeply. Automate ruthlessly. Ship weekly.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {APPROACH.map(([t, b], i) => (
              <div key={t} className="rounded-3xl border border-line bg-card p-8">
                <span className="font-display text-sm font-extrabold tracking-widest text-gold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsStrip />

      <section className="container-x py-24">
        <p className="eyebrow">How we run</p>
        <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
          Built to work while you don't.
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ASYNC.map(([t, b]) => (
            <div key={t} className="rounded-3xl border border-line bg-card p-7">
              <h3 className="text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <Contact />
    </>
  )
}
