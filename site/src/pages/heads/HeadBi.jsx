import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer, useCountUp } from './usePlayer.js'

/*
 * Head 07 — Predictive BI & Business Intelligence.
 * Demo: a revenue chart draws the actuals, then fans out a forecast band;
 * beside it, the churn radar flags accounts and the pricing model
 * recommends moves.
 */

// 12 months of actuals followed by 6 months forecast (₹ lakh)
const ACTUAL = [42, 45, 44, 51, 55, 53, 61, 64, 62, 70, 74, 78]
const FORECAST = [82, 85, 91, 94, 99, 106]
const BAND = [4, 6, 8, 10, 12, 14]

const W = 560
const H = 220
const PAD = 26
const MAX = 125
const N = ACTUAL.length + FORECAST.length

const x = (i) => PAD + (i / (N - 1)) * (W - PAD * 2)
const y = (v) => H - PAD - (v / MAX) * (H - PAD * 2)

const line = (arr, offset = 0) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i + offset)},${y(v)}`).join(' ')

const CHURN = [
  ['Apex Textiles', 84, 'Usage down 60% · 2 unpaid invoices'],
  ['Kavya Clinics', 71, 'Support tickets up · no login in 18 days'],
  ['Meher Foods', 38, 'Seasonal dip · matches last year'],
]

const PRICING = [
  ['Protein bar 12-pack', '₹899 → ₹949', '+5.6% margin, demand elastic <0.4'],
  ['Starter box', '₹499 → ₹449', 'Conversion lift 22% at this price point'],
]

function BiDemo() {
  const { ref, step, done } = usePlayer(7, { stepMs: 1300, pauseMs: 4500 })
  // 1: actual line draws  2: forecast + band  3: churn  4-5: pricing  6: alert  7 done
  const actualsOn = step >= 1
  const forecastOn = step >= 2
  const churnShown = step >= 3 ? CHURN.length : 0
  const pricingShown = step < 4 ? 0 : Math.min(PRICING.length, step - 3)
  const q4 = useCountUp(2.94, forecastOn, 1200)

  const bandPath = (() => {
    const start = ACTUAL.length - 1
    const upper = [ACTUAL[start], ...FORECAST.map((v, i) => v + BAND[i])]
    const lower = [ACTUAL[start], ...FORECAST.map((v, i) => v - BAND[i])]
    const up = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i + start)},${y(v)}`).join(' ')
    const down = lower
      .map((v, i) => `L${x(i + start)},${y(v)}`)
      .reverse()
      .join(' ')
    return `${up} ${down} Z`
  })()

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      {/* forecast chart */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line bg-card2 px-5 py-3.5">
          <div>
            <p className="text-sm font-bold">Revenue · actual vs. forecast</p>
            <p className="text-[0.65rem] text-muted">₹ lakh / month · 80% confidence band</p>
          </div>
          <div className="text-right">
            <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted">Next 2 quarters</p>
            <p className="font-display text-xl font-extrabold text-gold tabular-nums">
              {forecastOn ? `₹${q4.toFixed(2)} Cr` : '—'}
            </p>
          </div>
        </div>
        <div className="p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue chart with forecast band">
            {[25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="rgba(244,234,219,0.07)" />
                <text x={PAD - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#A3937F">{g}</text>
              </g>
            ))}
            <line x1={x(ACTUAL.length - 1)} x2={x(ACTUAL.length - 1)} y1={PAD} y2={H - PAD} stroke="rgba(240,163,47,0.35)" strokeDasharray="3 4" />
            <text x={x(ACTUAL.length - 1) + 5} y={PAD + 8} fontSize="8" fill="#F0A32F" letterSpacing="1.5">TODAY</text>

            <motion.path
              d={bandPath}
              fill="url(#band)"
              initial={{ opacity: 0 }}
              animate={{ opacity: forecastOn ? 1 : 0 }}
              transition={{ duration: 0.8 }}
            />
            <motion.path
              d={line(ACTUAL)}
              fill="none"
              stroke="#F4EADB"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: actualsOn ? 1 : 0 }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
            />
            <motion.path
              d={line([ACTUAL[ACTUAL.length - 1], ...FORECAST], ACTUAL.length - 1)}
              fill="none"
              stroke="#F0A32F"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="6 5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: forecastOn ? 1 : 0 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
            {forecastOn && (
              <motion.circle
                cx={x(N - 1)}
                cy={y(FORECAST[FORECAST.length - 1])}
                r="4"
                fill="#F0A32F"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.9 }}
              />
            )}
            <defs>
              <linearGradient id="band" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#F0A32F" stopOpacity="0.28" />
                <stop offset="1" stopColor="#E2571E" stopOpacity="0.12" />
              </linearGradient>
            </defs>
          </svg>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2 pt-1 text-[0.65rem] text-muted">
            <span className="flex items-center gap-2"><i className="h-[2px] w-5 bg-cream" /> Actual</span>
            <span className="flex items-center gap-2"><i className="h-[2px] w-5 border-t-2 border-dashed border-gold" /> Forecast</span>
            <span className="flex items-center gap-2"><i className="h-3 w-5 rounded-sm bg-gold/25" /> 80% band</span>
            <span className="ml-auto">{done ? 'Drivers: ad spend +18%, repeat rate 41%, Q3 seasonality' : forecastOn ? 'Explaining drivers…' : 'Loading actuals…'}</span>
          </div>
        </div>
      </div>

      {/* churn + pricing */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">CHURN RADAR</p>
            <p className="text-[0.65rem] text-muted">6-week lead time</p>
          </div>
          <div className="space-y-2.5 p-4">
            {CHURN.slice(0, churnShown).map(([name, risk, why], i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
                className="rounded-2xl border border-line bg-card p-3.5"
              >
                <div className="flex items-center justify-between text-[0.8rem]">
                  <span className="font-bold">{name}</span>
                  <span className={`font-display font-extrabold ${risk > 60 ? 'text-ember' : 'text-muted'}`}>{risk}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-card2">
                  <motion.div
                    className={`h-full ${risk > 60 ? 'bg-gradient-to-r from-gold to-ember' : 'bg-muted/60'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${risk}%` }}
                    transition={{ duration: 0.8, delay: i * 0.12 }}
                  />
                </div>
                <p className="mt-1.5 text-[0.65rem] text-muted">{why}</p>
              </motion.div>
            ))}
            {churnShown === 0 && <p className="p-1 text-[0.78rem] text-muted">Scoring accounts…</p>}
          </div>
        </div>

        <div className="flex-1 rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">PRICE MOVES</p>
            <p className="text-[0.65rem] text-muted">elasticity model</p>
          </div>
          <div className="space-y-2.5 p-4">
            {PRICING.slice(0, pricingShown).map(([sku, move, why]) => (
              <motion.div key={sku} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-line bg-card p-3.5 text-[0.78rem]">
                <div className="flex justify-between">
                  <span className="font-bold">{sku}</span>
                  <span className="font-semibold text-gold">{move}</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-muted">{why}</p>
              </motion.div>
            ))}
            {pricingShown === 0 && <p className="p-1 text-[0.78rem] text-muted">Waiting for the model…</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 7,
  hero: {
    line1: 'See next quarter,',
    line2: 'before it happens.',
    body:
      'Machine-learning models on your own sales, ops and marketing data — forecasting revenue with confidence bands, flagging churn weeks before it lands, and recommending prices that actually move margin.',
    secondary: 'Watch a forecast build',
  },
  cta: { label: 'Book a data audit' },
  demo: {
    title: 'Your dashboard, if it could think.',
    body:
      'Twelve months of actuals, six months of forecast with an honest confidence band, the three accounts about to churn — and the two price changes worth making this week.',
    node: <BiDemo />,
  },
  jobs: {
    title: 'Questions the BI head',
    titleMuted: 'answers on its own.',
    labels: ['The question', 'The model'],
    items: [
      {
        title: 'Revenue forecasting',
        trigger: '"What will we do next quarter?"',
        steps: 'Seasonality + pipeline + ad spend + repeat rate → monthly forecast with confidence bands, re-run nightly',
        outcome: 'Plan cash and hiring on numbers, not hope',
      },
      {
        title: 'Churn prediction',
        trigger: '"Which customers are about to leave?"',
        steps: 'Usage, payments, support and engagement signals → risk score per account → alert with the reason',
        outcome: 'Save them six weeks before they go',
      },
      {
        title: 'Dynamic pricing',
        trigger: '"Are we charging the right price?"',
        steps: 'Elasticity per SKU and segment → recommended moves → measured lift after each change',
        outcome: 'Margin you didn\'t know you were leaving',
      },
      {
        title: 'Demand & inventory planning',
        trigger: '"How much stock do we need in October?"',
        steps: 'Forecast per SKU and location → reorder points → stock-out and dead-stock warnings',
        outcome: 'Less capital stuck on shelves',
      },
      {
        title: 'Marketing attribution',
        trigger: '"Which channel actually made the sale?"',
        steps: 'Multi-touch model across ads, WhatsApp, email and organic → true cost per acquisition',
        outcome: 'Cut what doesn\'t work with confidence',
      },
      {
        title: 'Anomaly alerts',
        trigger: 'Something moves that shouldn\'t',
        steps: 'Watch every metric hourly → flag the odd one → one WhatsApp message with the likely cause',
        outcome: 'Find out at 9 AM, not month end',
      },
    ],
  },
  trust: {
    eyebrow: 'Models you can question',
    title: 'No black boxes',
    titleMuted: 'in the boardroom.',
    body:
      'A prediction you can\'t explain is a guess with a decimal point. Every model we ship names its drivers, proves itself on your past data, and keeps your data yours.',
    items: [
      ['Explainable drivers', 'Every forecast and every risk score says why: which inputs moved it and by how much. Leadership can argue with it.'],
      ['Backtested first', 'Before a model goes live it predicts the last twelve months blind. You see the error rate before you trust it.'],
      ['Your data stays yours', 'Models run in your warehouse or a private instance. Nothing is pooled, shared or used to train anyone else.'],
    ],
  },
  stack: {
    title: 'Built on the data you already have.',
    body: 'We pull from the tools you run, stand up a clean warehouse, and put the outputs where people actually look.',
    tools: ['Google Sheets', 'Tally', 'Zoho', 'Shopify', 'GA4', 'Meta Ads', 'PostgreSQL', 'BigQuery', 'Python', 'Looker Studio', 'Power BI', 'WhatsApp alerts'],
  },
  numbers: {
    items: [
      ['90%+', 'forecast accuracy at a one-quarter horizon'],
      ['6 wks', 'warning before a customer churns'],
      ['Nightly', 'model refresh, real-time alerts'],
    ],
  },
  process: {
    title: 'From spreadsheets to foresight.',
    steps: [
      ['Data audit + warehouse', 'We find every source, judge its quality and stand up one clean, joined dataset. Most companies discover gaps here.'],
      ['Model build + backtest', 'Forecast, churn or pricing first — whichever pays back fastest — validated against your own history.'],
      ['Dashboard + alerts', 'One board leadership opens, plus alerts on WhatsApp or Slack for the things that need a human today.'],
      ['Monthly retrain', 'Models learn from every new month. We review accuracy with you and add the next question.'],
    ],
  },
}

export default function HeadBi() {
  return <HeadLayout {...CONTENT} />
}
