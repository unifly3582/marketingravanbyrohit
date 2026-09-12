import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 07 — Ecommerce AI: agents that run and grow an online store.
 * Demo: a cart is abandoned at 9:14pm; the agent nudges on WhatsApp,
 * answers a product question, recovers the order, sends the shipping
 * update and asks for a review — while the store's numbers tick up.
 */

const THREAD = [
  { from: 'sys', text: 'Cart abandoned · ₹2,340 · Linen shirt (L) + chinos', at: '9:14 pm' },
  { from: 'bot', text: 'Hi Aarav, your linen shirt and chinos are still in the cart. Want me to hold the size L for you? Free delivery on this order.', at: '9:44 pm' },
  { from: 'user', text: 'Is the shirt slim fit or regular?', at: '9:51 pm' },
  { from: 'bot', text: 'Regular fit with a slightly tapered waist — most people your height take L. Easy 7-day exchange if not. Here\'s your checkout link 👇', at: '9:51 pm' },
  { from: 'sys', text: 'Order #4821 placed · ₹2,340 · UPI', at: '9:56 pm' },
  { from: 'bot', text: 'Shipped! Delhivery AWB 3392… arriving Thursday. Track here.', at: 'Tue 11:10 am' },
  { from: 'bot', text: 'Hope the shirt fits well, Aarav. Two taps to rate it? Your next order gets 10% off. ⭐', at: 'Fri 6:00 pm' },
]

const ORDERS = [
  ['#4819', 'Amazon', '₹1,190'],
  ['#4820', 'Shopify', '₹3,480'],
  ['#4821', 'WhatsApp', '₹2,340'],
  ['#4822', 'Flipkart', '₹899'],
]

function Bubble({ m }) {
  if (m.from === 'sys')
    return (
      <div className="flex justify-center">
        <span className="rounded-full border border-line bg-ground px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted">
          {m.text}
        </span>
      </div>
    )
  const bot = m.from === 'bot'
  return (
    <div className={`flex ${bot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          bot ? 'rounded-bl-sm border border-line bg-ground' : 'rounded-br-sm bg-gradient-to-r from-gold to-ember text-[#14100c]'
        }`}
      >
        <p>{m.text}</p>
        <p className={`mt-1 text-[0.6rem] ${bot ? 'text-muted' : 'text-[#14100c]/70'}`}>{m.at}</p>
      </div>
    </div>
  )
}

function EcomDemo() {
  const { ref, step } = usePlayer(THREAD.length, { stepMs: 1500, pauseMs: 4500 })
  const shown = THREAD.slice(0, step)
  const recovered = step >= 5

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/20 text-[0.7rem] font-extrabold text-[#25D366]">WA</span>
          <div>
            <p className="text-sm font-bold">Aarav M. · +91 98•• ••• ••</p>
            <p className="text-[0.62rem] text-muted">Store agent · Threadline Apparel</p>
          </div>
        </div>
        <div className="flex min-h-[26rem] flex-col justify-end gap-2.5 p-5">
          {shown.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Bubble m={m} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            [recovered ? '₹2,340' : '—', 'cart recovered'],
            ['38%', 'of abandoned carts saved'],
            ['4', 'stores in one inbox'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-line bg-card p-4">
              <p className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-xl font-extrabold text-transparent">{v}</p>
              <p className="mt-1 text-[0.62rem] leading-snug text-muted">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-3xl border border-line bg-card p-5">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">Orders tonight · all channels</p>
          <div className="mt-4 space-y-2">
            {ORDERS.map(([id, chan, amt], i) => {
              const on = id !== '#4821' || recovered
              return (
                <motion.div
                  key={id}
                  animate={{ opacity: on ? 1 : 0.3 }}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
                    id === '#4821' && recovered ? 'border-gold/50 bg-gold/10' : 'border-line bg-ground'
                  }`}
                >
                  <span className="font-bold">{id}</span>
                  <span className="text-muted">{chan}</span>
                  <span className="ml-auto font-bold">{on ? amt : '…'}</span>
                  {on && <Check className="h-4 w-4 text-gold" />}
                </motion.div>
              )
            })}
          </div>
          <p className="mt-4 text-[0.65rem] text-muted">
            Stock synced to Shopify, Amazon and Flipkart after every order. Support answers from the same agent.
          </p>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 7,
  hero: {
    line1: 'A store that sells while you sleep,',
    line2: 'and answers before you wake.',
    body:
      'AI agents on your store and your WhatsApp that recover abandoned carts, answer product questions, send order and shipping updates, collect reviews and keep stock in sync across Shopify, WooCommerce, Amazon and Flipkart.',
    secondary: 'Watch a cart get recovered',
  },
  cta: { label: 'Get a store audit' },
  demo: {
    title: 'Cart abandoned at 9:14. Order placed at 9:56.',
    body:
      'The agent nudges at the right moment, answers the fit question a human would have missed overnight, and closes with a checkout link — then handles shipping updates and the review ask.',
    node: <EcomDemo />,
  },
  jobs: {
    title: 'Store work an agent can own',
    titleMuted: 'from day one.',
    labels: ['Trigger', 'The head'],
    items: [
      { title: 'Abandoned-cart recovery', trigger: 'A cart sits for 30 minutes', steps: 'WhatsApp nudge → answer objections → checkout link → one reminder, never spam', outcome: '30–40% of carts saved' },
      { title: 'Product Q&A', trigger: '"Will this fit?", "Is it in stock?", "Cash on delivery?"', steps: 'Answer from your catalogue and policies → suggest the right variant → link to buy', outcome: 'Questions become orders' },
      { title: 'Order & shipping updates', trigger: 'Order placed, packed, shipped, delivered', steps: 'WhatsApp update at each step with tracking → handle "where is my order" automatically', outcome: '80% fewer support tickets' },
      { title: 'Returns & exchanges', trigger: 'A customer wants to swap or return', steps: 'Check policy → raise the pickup → confirm refund or exchange → keep the customer', outcome: 'Returns without the back-and-forth' },
      { title: 'Reviews & repeat orders', trigger: 'Delivered 3 days ago', steps: 'Ask for a rating → thank with a small offer → reorder reminder when they are due', outcome: '+40% repeat orders' },
      { title: 'Marketplace sync', trigger: 'A sale on any channel', steps: 'Update stock on Shopify, Amazon and Flipkart → flag low stock → push orders to your ERP', outcome: 'Never oversold again' },
    ],
  },
  trust: {
    eyebrow: 'Sells like your best salesperson',
    title: 'Your catalogue, your policies,',
    titleMuted: 'your tone.',
    body:
      'The agent is trained on your products, sizes, delivery rules and return policy. It never invents a discount or a delivery date, and hands over to your team the moment a customer asks.',
    items: [
      ['Knows every product', 'Catalogue, variants, stock and pricing synced live — so answers are right today, not last week.'],
      ['Hard rules', 'Discount limits, COD rules, pincodes you deliver to. It works inside them and asks you before stepping out.'],
      ['One-tap handoff', 'Bulk orders, angry customers, anything unusual — the thread lands with your team, full context attached.'],
    ],
  },
  stack: {
    title: 'Every store and marketplace you sell on.',
    body: 'We plug into the platforms you already run. No migration, no new dashboard for your team.',
    tools: ['Shopify', 'WooCommerce', 'Amazon', 'Flipkart', 'Meesho', 'WhatsApp Business API', 'Razorpay', 'Shiprocket', 'Delhivery', 'Google Merchant', 'Meta Catalog', 'Zoho / Tally'],
  },
  numbers: {
    items: [
      ['38%', 'of abandoned carts recovered on WhatsApp'],
      ['+40%', 'repeat orders from review and reorder flows'],
      ['<10 sec', 'reply to every product question, day or night'],
    ],
  },
  process: {
    title: 'From store audit to a store that runs itself.',
    steps: [
      ['Store audit', 'We read your last 90 days of orders, carts and support chats and show you where sales leak.'],
      ['Connect + train', 'Catalogue, policies and tone loaded. WhatsApp number verified, marketplaces linked.'],
      ['Supervised launch', 'Two weeks where you see every message before it sends. We tune until you stop editing.'],
      ['Grow', 'Add reorder flows, festival campaigns and new channels. Monthly report on recovered and repeat revenue.'],
    ],
  },
}

export default function HeadEcom() {
  return <HeadLayout {...CONTENT} />
}
