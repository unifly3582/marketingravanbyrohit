import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'

/*
 * Head 04 — GEO & Next-Gen Programmatic SEO.
 * Demo: a buyer asks an AI engine for a recommendation. The answer streams
 * in, the citations resolve and the client brand lights up as "cited".
 * Right: citation share per engine and the programmatic page factory.
 */

const ENGINES = ['ChatGPT', 'Perplexity', 'Gemini']
const QUERY = 'best ERP for textile exporters in Surat with GST e-invoicing'

const ANSWER = [
  'For textile exporters in Surat, three options stand out. ',
  { brand: true, text: 'Vastra ERP' },
  ' is the strongest fit — it handles GST e-invoicing, job-work challans and export documentation natively, and is widely used by mid-size Surat mills',
  { cite: 1 },
  { cite: 2 },
  '. TallyPrime is a lower-cost alternative for smaller units',
  { cite: 3 },
  ', while SAP Business One suits exporters above ₹200 Cr',
  { cite: 4 },
  '.',
]

const SOURCES = [
  'vastraerp.com/textile-erp-surat',
  'textileexcellence.com/best-erp-surat-2026',
  'tallysolutions.com/gst',
  'sap.com/india/business-one',
]

const PAGES = [
  '/erp-for-textile-exporters/surat',
  '/erp-for-textile-exporters/tirupur',
  '/erp-for-garment-manufacturers/ludhiana',
  '/gst-e-invoicing-software/surat',
  '/job-work-challan-software/surat',
  '/erp-for-textile-exporters/bhilwara',
  '/erp-vs-tally/textile',
  '/erp-for-yarn-traders/ichalkaranji',
]

const SHARE = { ChatGPT: 62, Perplexity: 71, Gemini: 48 }

function GeoDemo() {
  const { ref, step, done, loops } = usePlayer(9, { stepMs: 1300, pauseMs: 4500 })
  const engine = loops % ENGINES.length

  // stream the answer: step 1 = query typed, 2..6 = answer chunks, 7 = cites, 8 = cited badge
  const chunkCount = Math.max(0, Math.min(ANSWER.length, (step - 1) * 2))
  const showCites = step >= 7
  const cited = step >= 8
  const pagesShown = Math.min(PAGES.length, step)
  const cur = ENGINES[engine]

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* AI engine answer */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-2 border-b border-line bg-card2 px-5 py-3">
          {ENGINES.map((e) => (
            <span
              key={e}
              className={`rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] transition-colors ${
                e === cur ? 'bg-gold/15 text-gold' : 'text-muted/60'
              }`}
            >
              {e}
            </span>
          ))}
          <span className="ml-auto text-[0.65rem] text-muted">AI search · buyer query</span>
        </div>
        <div className="min-h-[24rem] p-6">
          <div className="rounded-2xl border border-line bg-ground px-4 py-3 text-[0.85rem] text-cream/90">
            <span className="mr-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted">Asked</span>
            {step >= 1 ? QUERY : <span className="text-muted">…</span>}
          </div>
          <div className="mt-5 text-[0.9rem] leading-relaxed text-cream/85">
            {ANSWER.slice(0, chunkCount).map((a, i) => {
              if (typeof a === 'string') return <span key={i}>{a}</span>
              if (a.brand)
                return (
                  <motion.span
                    key={i}
                    initial={{ backgroundColor: 'rgba(240,163,47,0)' }}
                    animate={{ backgroundColor: cited ? 'rgba(240,163,47,0.18)' : 'rgba(240,163,47,0)' }}
                    className="rounded px-1 font-bold text-gold"
                  >
                    {a.text}
                  </motion.span>
                )
              return (
                <sup
                  key={i}
                  className={`ml-0.5 rounded px-1 text-[0.6rem] font-bold transition-colors ${
                    showCites ? 'bg-gold/15 text-gold' : 'text-muted'
                  }`}
                >
                  {a.cite}
                </sup>
              )
            })}
            {step >= 1 && !done && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-gold align-middle" />}
          </div>
          {showCites && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">Sources</p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {SOURCES.map((s, i) => (
                  <li
                    key={s}
                    className={`truncate rounded-lg border px-3 py-1.5 text-[0.7rem] ${
                      i < 2 ? 'border-gold/30 text-gold' : 'border-line text-muted'
                    }`}
                  >
                    {i + 1}. {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
          <p className="text-[0.72rem] text-muted">
            {cited ? (
              <span className="text-gold">Your brand: recommended first, cited twice. That is the new page one.</span>
            ) : step >= 1 ? (
              'Generating answer…'
            ) : (
              'Waiting for a buyer…'
            )}
          </p>
        </div>
      </div>

      {/* visibility + page factory */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">CITATION SHARE</p>
            <p className="text-[0.65rem] text-muted">50 tracked buyer queries · this week</p>
          </div>
          <div className="mt-4 space-y-3">
            {ENGINES.map((e) => (
              <div key={e}>
                <div className="flex justify-between text-[0.72rem]">
                  <span className={e === cur ? 'font-bold text-cream' : 'text-muted'}>{e}</span>
                  <span className="font-bold text-gold">{step >= 2 ? `${SHARE[e]}%` : '—'}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card2">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold to-ember"
                    animate={{ width: step >= 2 ? `${SHARE[e]}%` : '0%' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">PAGE FACTORY</p>
            <p className="text-[0.65rem] text-muted">city × service × intent</p>
          </div>
          <ul className="flex-1 space-y-1.5 p-4 font-mono text-[0.7rem]">
            {PAGES.slice(0, pagesShown).map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-cream/80"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                <span className="truncate">{p}</span>
                <span className="ml-auto text-muted">{i < pagesShown - 1 || done ? 'indexed' : 'building'}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 4,
  hero: {
    line1: 'Be the answer,',
    line2: 'not the tenth blue link.',
    body:
      'Search is moving into ChatGPT, Perplexity and Gemini — and they don\'t show ten results, they recommend one or two. We make the AI engines cite your brand, and build the programmatic pages that earn those citations at scale.',
    secondary: 'See an AI cite a brand',
  },
  cta: { label: 'Get an AI visibility audit' },
  demo: {
    title: 'Watch a buyer ask an AI — and hear your name.',
    body:
      'A textile exporter asks for an ERP recommendation. The engine answers with one brand first, backed by two sources we built. That is what generative engine optimisation buys you.',
    node: <GeoDemo />,
  },
  jobs: {
    title: 'What the GEO head',
    titleMuted: 'actually does.',
    labels: ['Starts with', 'The work'],
    items: [
      {
        title: 'AI visibility audit',
        trigger: 'Your 50 most valuable buyer questions',
        steps: 'Ask every engine weekly → log who gets recommended and why → find the gaps',
        outcome: 'You know your citation share, like you know your rank',
      },
      {
        title: 'Entity & schema',
        trigger: 'What the engines currently "know" about you',
        steps: 'Fix your brand entity → structured data on every page → consistent facts across the web',
        outcome: 'AI engines describe you correctly, every time',
      },
      {
        title: 'Programmatic pages',
        trigger: 'Your services × cities × buyer intents',
        steps: 'Data-driven templates → hundreds of genuinely useful pages → automated internal linking',
        outcome: 'A page for every question, without a content team',
      },
      {
        title: 'Answer-ready content',
        trigger: 'The questions AI engines answer about your category',
        steps: 'Comparisons, "best of" lists, pricing guides written to be quoted verbatim',
        outcome: 'Content the machines love to cite',
      },
      {
        title: 'Citation sources',
        trigger: 'Where engines get their evidence',
        steps: 'Reviews, directories, industry press and listicles — earned, structured and kept fresh',
        outcome: 'Third parties vouch for you',
      },
      {
        title: 'Monitor & re-rank',
        trigger: 'Engines update their models',
        steps: 'Weekly re-query → spot drops → refresh pages and sources before share slips',
        outcome: 'Visibility that holds',
      },
    ],
  },
  trust: {
    eyebrow: 'How AI picks who to cite',
    title: 'Three things the machines',
    titleMuted: 'reward.',
    body:
      'Generative engines don\'t rank pages — they choose which brands to trust in an answer. Everything we do maps to the three signals that decide it.',
    items: [
      ['Entity clarity', 'One unambiguous story about who you are, what you do and for whom, repeated identically everywhere the engines crawl.'],
      ['Third-party corroboration', 'Engines cite what others already say. Reviews, press and industry listings do the vouching for you.'],
      ['Fresh, structured answers', 'Direct, factual, well-organised pages updated often — the format AI engines quote without rewriting.'],
    ],
  },
  stack: {
    title: 'Every engine, tracked.',
    body: 'We measure across the engines your buyers use, and publish pages on whatever your site already runs.',
    tools: ['ChatGPT', 'Perplexity', 'Gemini', 'Copilot', 'Google AI Overviews', 'Search Console', 'Schema.org', 'Ahrefs', 'WordPress', 'Webflow', 'Next.js', 'Custom crawlers'],
  },
  numbers: {
    items: [
      ['#1', 'recommendation for your core buyer queries'],
      ['500+', 'programmatic pages a month, indexed'],
      ['4', 'AI engines tracked, every week'],
    ],
  },
  process: {
    title: 'From invisible to cited.',
    steps: [
      ['Visibility audit', 'We query every engine with your buyers\' real questions and show you exactly who they recommend today.'],
      ['Foundation', 'Entity, schema and the ten cornerstone pages that engines cite. Usually the fastest wins are here.'],
      ['Page factory', 'Programmatic templates launch across cities, services and intents — with quality gates so every page earns its place.'],
      ['Monthly citation report', 'Share of voice per engine, what moved and why, and next month\'s targets.'],
    ],
  },
}

export default function HeadGeo() {
  return <HeadLayout {...CONTENT} />
}
