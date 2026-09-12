import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 03 — Social Media, managed every day.
 * Demo: a week of the content calendar fills itself in (reel, carousel,
 * story, post, reel), a comment lands and is answered in the brand's voice,
 * and the month's numbers tick up on the right.
 */

const WEEK = [
  { day: 'Mon', kind: 'Reel', title: 'Behind the counter: 6am dough', chan: 'IG · FB' },
  { day: 'Tue', kind: 'Carousel', title: '5 breads you did not know we bake', chan: 'IG · LinkedIn' },
  { day: 'Wed', kind: 'Story', title: 'Poll: sourdough or multigrain?', chan: 'IG' },
  { day: 'Thu', kind: 'Post', title: 'Customer of the week — Meera', chan: 'IG · FB' },
  { day: 'Fri', kind: 'Reel', title: 'Weekend box unboxing', chan: 'IG · YT Shorts' },
]

const COMMENT = { who: '@rahul.eats', text: 'Do you deliver to Andheri West? Need 20 boxes for Saturday 🙏' }
const REPLY = 'Yes we do, Rahul! 20 boxes for Saturday is easy — sending you the bulk menu on DM now. 🍞'

const KIND_COLOR = { Reel: '#E2571E', Carousel: '#F0A32F', Story: '#8B7CFF', Post: '#5FD3A3' }

function SocialDemo() {
  // 1..5 calendar fills, 6 comment lands, 7 reply drafted, 8 posted + stats
  const { ref, step } = usePlayer(8, { stepMs: 1300, pauseMs: 4500 })
  const filled = Math.min(WEEK.length, step)
  const comment = step >= 6
  const reply = step >= 7
  const posted = step >= 8

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* the calendar */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line bg-card2 px-5 py-3.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-gold" />
          </span>
          <p className="text-sm font-bold">Content calendar · Crust & Co. Bakery</p>
          <span className="ml-auto text-[0.65rem] text-muted">Week 2 of 4 · auto-planned</span>
        </div>
        <div className="grid gap-2.5 p-5">
          {WEEK.map((w, i) => {
            const on = i < filled
            return (
              <motion.div
                key={w.day}
                animate={{ opacity: on ? 1 : 0.35 }}
                className="flex items-center gap-4 rounded-2xl border border-line bg-ground px-4 py-3"
              >
                <span className="w-9 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted">{w.day}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#14100c]"
                  style={{ background: on ? KIND_COLOR[w.kind] : 'rgba(244,234,219,0.15)' }}
                >
                  {w.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {on ? w.title : <span className="text-muted">Planning…</span>}
                </span>
                <span className="hidden text-[0.65rem] text-muted sm:block">{w.chan}</span>
                {on && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-gold">
                    <Check className="h-4 w-4" />
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* the inbox + the numbers */}
      <div className="flex flex-col gap-4">
        <div className="flex-1 rounded-3xl border border-line bg-card p-5">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">Comments & DMs</p>
          <div className="mt-4 space-y-3">
            {comment ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-ground p-3.5">
                <p className="text-[0.65rem] font-bold text-gold">{COMMENT.who}</p>
                <p className="mt-1 text-sm">{COMMENT.text}</p>
              </motion.div>
            ) : (
              <p className="text-sm text-muted">Listening on Instagram, Facebook and LinkedIn…</p>
            )}
            {reply && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-3.5 ${posted ? 'border-gold/50 bg-gold/10' : 'border-line bg-card2'}`}
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted">
                  {posted ? 'Replied · 41 seconds' : 'Drafting in brand voice…'}
                </p>
                <p className="mt-1 text-sm">{REPLY}</p>
              </motion.div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['30', 'posts this month'],
            [posted ? '4.8x' : '—', 'reach vs last month'],
            [posted ? '100%' : '—', 'comments answered'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-line bg-card p-4">
              <p className="bg-gradient-to-r from-gold to-ember bg-clip-text font-display text-2xl font-extrabold text-transparent">{v}</p>
              <p className="mt-1 text-[0.65rem] leading-snug text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 3,
  hero: {
    line1: 'Show up every day,',
    line2: 'without doing it yourself.',
    body:
      'A full social media team for one retainer — strategy, reels, carousels, captions, scheduling and replies for Instagram, Facebook, LinkedIn and YouTube. You approve on Monday; the week runs itself.',
    secondary: 'Watch a week get made',
  },
  cta: { label: 'Get a content plan' },
  demo: {
    title: 'A week of content. Planned, made, posted, answered.',
    body:
      'The calendar fills from your brand playbook, every post is designed in your look, and every comment gets a reply in your voice — within the hour, not the week.',
    node: <SocialDemo />,
  },
  jobs: {
    title: 'Everything a social media manager does,',
    titleMuted: 'done for you.',
    labels: ['Every month', 'The head'],
    items: [
      { title: 'Monthly content plan', trigger: 'Your goals, launches and festivals for the month', steps: 'Research what your audience watches → 30-post calendar with hooks → sent for one-tap approval', outcome: 'A month planned in one sitting' },
      { title: 'Reels & short video', trigger: 'Raw phone footage from your team, or nothing at all', steps: 'Script → edit → captions, music and cover → posted at the best hour', outcome: '8–12 reels a month' },
      { title: 'Design & captions', trigger: 'Every scheduled post', steps: 'On-brand carousel or creative → caption with hooks and hashtags → alt text', outcome: 'A feed that looks like one brand' },
      { title: 'Community replies', trigger: 'A comment, DM or mention', steps: 'Answer FAQs in your voice → flag leads to WhatsApp → escalate complaints to you', outcome: 'Nobody left on read' },
      { title: 'Festival & launch pushes', trigger: 'Diwali, a new product, a sale', steps: 'Teaser → launch → reminder series across all channels', outcome: 'Moments that move sales' },
      { title: 'Monthly report', trigger: 'Month end', steps: 'Reach, followers, saves, leads → what worked → next month\'s plan', outcome: 'You always know the return' },
    ],
  },
  trust: {
    eyebrow: 'On brand, every time',
    title: 'Your look, your voice,',
    titleMuted: 'your approval.',
    body:
      'We build a brand playbook first — colours, fonts, tone, what you never say — and every post is checked against it. Nothing goes live without your Monday thumbs-up.',
    items: [
      ['Brand playbook first', 'Colours, type, tone of voice, banned words and examples of your best posts, all written down before the first reel.'],
      ['One-tap approval', 'The week\'s posts land on your WhatsApp every Monday. Approve, comment or swap — from your phone.'],
      ['Real footage, real people', 'We work from your photos and clips when you have them. When you don\'t, we shoot or generate on-brand visuals — never stock.'],
    ],
  },
  stack: {
    title: 'Every channel your customers scroll.',
    body: 'Scheduling, design and inbox all run from tools we already have — nothing for you to buy or learn.',
    tools: ['Instagram', 'Facebook', 'LinkedIn', 'YouTube Shorts', 'X', 'Meta Business Suite', 'Canva', 'CapCut', 'Figma', 'Buffer', 'Metricool', 'WhatsApp'],
  },
  numbers: {
    items: [
      ['30', 'posts a month, planned and published'],
      ['<1 hr', 'reply time on every comment and DM'],
      ['3–5x', 'reach growth in the first 90 days'],
    ],
  },
  process: {
    title: 'From playbook to a feed that sells.',
    steps: [
      ['Brand playbook', 'One workshop on who you are, who you serve and how you sound. We audit your last 90 days and your competitors.'],
      ['Month one calendar', 'Thirty posts planned around your goals, approved by you in one sitting.'],
      ['Publish + reply', 'The head designs, schedules and posts. Comments and DMs answered inside the hour, leads pushed to your WhatsApp.'],
      ['Report + repeat', 'Monthly numbers, what worked, and the next month\'s plan — better every cycle.'],
    ],
  },
}

export default function HeadSocial() {
  return <HeadLayout {...CONTENT} />
}
