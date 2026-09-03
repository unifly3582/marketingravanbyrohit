import { Check, Cross } from './icons.jsx'

const ROWS = [
  ['Start in days, not months', false, false, false, true],
  ['AI agents included', false, false, false, true],
  ['Marketing + ERP + AI in one team', false, false, false, true],
  ['Fixed monthly cost', true, false, false, true],
  ['Senior specialists on every task', false, true, false, true],
  ['Works while you sleep', false, false, false, true],
  ['Pause or cancel anytime', true, false, false, true],
]

const COLS = ['Freelancers', 'Traditional Agency', 'In-house Team', 'Marketing Ravan']

export default function Comparison() {
  return (
    <section className="container-x py-28">
      <div className="mb-12 text-center">
        <p className="eyebrow justify-center">Service comparison</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
          Why build another marketing department?
        </h2>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/80">
              <th className="p-5 text-left font-semibold text-muted">What you get</th>
              {COLS.map((c, i) => (
                <th
                  key={c}
                  className={`p-5 text-center font-display font-bold ${
                    i === 3 ? 'bg-gradient-to-b from-ember/15 to-transparent text-gold' : 'text-cream/80'
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, ...cells]) => (
              <tr key={label} className="border-b border-line last:border-0">
                <td className="p-5 font-medium text-cream/90">{label}</td>
                {cells.map((ok, i) => (
                  <td key={i} className={`p-5 text-center ${i === 3 ? 'bg-ember/5' : ''}`}>
                    {ok ? (
                      <Check className={`mx-auto h-5 w-5 ${i === 3 ? 'text-gold' : 'text-cream/50'}`} />
                    ) : (
                      <Cross className="mx-auto h-4 w-4 text-cream/20" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
