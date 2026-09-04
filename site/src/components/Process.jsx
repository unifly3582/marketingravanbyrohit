import { motion } from 'motion/react'

/* Plain title first so a visitor knows what the step is; the Ravan
 * codename rides along as a sub-label. */
const STEPS = [
  {
    n: '01',
    title: 'Strategy call',
    code: 'Summon',
    desc: 'One 45-minute call. We audit your funnel, your stack and your ops, then pick which heads to wake first.',
  },
  {
    n: '02',
    title: 'Weekly builds',
    code: 'Strike',
    desc: 'Agents deploy in weekly sprints — SDR flows, voice lines, GEO pages, ERP pipelines — shipped and wired into your tools.',
  },
  {
    n: '03',
    title: 'Live dashboards',
    code: 'Scale',
    desc: 'Every head reports its numbers on a dashboard you can open any time. We double down on what converts and retire what doesn’t.',
  },
]

// Sample queue for the board mock — replace with live client tasks later.
const BOARD = [
  { s: 'In Review', c: '#F0A32F', t: 'WhatsApp SDR Flow' },
  { s: 'In Progress', c: '#E2571E', t: 'GEO Landing Factory' },
  { s: 'Queued', c: '#A3937F', t: 'Voice Agent v2' },
  { s: 'Completed', c: '#7BA05B', t: 'Invoice OCR Pipeline' },
  { s: 'Completed', c: '#7BA05B', t: 'Ad Creative Batch #12' },
]

export default function Process() {
  return (
    <section id="process" className="theme-light border-y border-line py-28">
      <div className="container-x">
        <div className="mb-14 text-center">
          <p className="eyebrow justify-center">How it works</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            Growth shouldn't need a complicated process.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Three moves. Then the heads do the heavy lifting.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-3xl border border-line bg-card p-8"
            >
              <span className="font-display text-sm font-extrabold tracking-widest text-gold">
                {s.n} <span className="ml-2 text-muted">{s.code}</span>
              </span>
              <h3 className="mt-3 text-2xl font-bold">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.desc}</p>

              {i === 1 && (
                <div className="mt-6 space-y-2">
                  {BOARD.map((b) => (
                    <div key={b.t} className="flex items-center gap-3 rounded-xl border border-line bg-ground/60 px-4 py-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.c }} />
                      <span className="w-24 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-muted">{b.s}</span>
                      <span className="truncate text-xs font-semibold text-cream/85">{b.t}</span>
                    </div>
                  ))}
                </div>
              )}
              {i === 2 && (
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[['Ad ROAS', '+250%'], ['Conversion', '3x'], ['Execution', '10x']].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-ground/60 px-3 py-3 text-center">
                      <p className="font-display text-lg font-extrabold text-gold">{v}</p>
                      <p className="text-[0.6rem] uppercase tracking-widest text-muted">{k}</p>
                    </div>
                  ))}
                </div>
              )}
              {i === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-gold/30 bg-ground/60 p-4 text-sm text-muted">
                  <span className="font-semibold text-cream/90">45 minutes.</span> No deck, no fluff —
                  a whiteboard session on where automation pays back first.
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
