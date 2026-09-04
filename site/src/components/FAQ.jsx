const QA = [
  {
    q: 'What exactly is a "head"?',
    a: 'A head is one complete capability — strategy, setup, automation and reporting for one discipline (for example the Autonomous AI Sales Engine, or GEO). You subscribe to heads the way you would hire specialists, except each head ships in days and works around the clock.',
  },
  {
    q: 'Do the AI agents replace my team?',
    a: 'No — they replace the repetitive work your team shouldn\'t be doing: follow-ups, data entry, reporting, ad variations. Your people keep the judgment calls; the agents keep the treadmill.',
  },
  {
    q: 'Can you work with our existing ERP / CRM / tools?',
    a: 'Yes. Head 9 exists for exactly this: we connect legacy ERPs, custom software and modern SaaS through APIs, webhooks and low-code connectors, so nothing you already run has to be thrown away.',
  },
  {
    q: 'How fast do we see something live?',
    a: 'The first head is typically live inside the first two weeks — an SDR flow, a voice line or an OCR pipeline you can watch working. Bigger integrations land in weekly sprints after that.',
  },
  {
    q: 'What about our data?',
    a: 'Your data stays in your accounts — we build inside your CRM, your ERP, your ad accounts. We sign NDAs and access is revocable by you at any time.',
  },
  {
    q: 'Can we pause or cancel?',
    a: 'Any subscription can be paused or cancelled at the end of the month, no lock-in. Everything we built — automations, pages, dashboards — stays yours.',
  },
]

/* `limit` shows only the first N questions (Home uses 4); `more` adds a
 * link to the full list on the pricing page. */
export default function FAQ({ limit, more = false }) {
  const items = limit ? QA.slice(0, limit) : QA
  return (
    <section id="faq" className="container-x py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">
            Questions, answered straight.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Everything about how the ten heads plug into your business — from
            data access to pause rules.
          </p>
          {more && (
            <a href="/pricing#faq" className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-gold">
              All questions
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <details key={item.q} className="faq-item group rounded-2xl border border-line bg-card">
              <summary className="flex items-center justify-between gap-4 p-5 text-[0.95rem] font-semibold">
                {item.q}
                <span className="faq-plus flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-gold">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
