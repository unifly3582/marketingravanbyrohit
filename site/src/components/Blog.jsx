import { motion } from 'motion/react'
import { Arrow } from './icons.jsx'
import b1 from '../assets/blog-1.jpg'
import b2 from '../assets/blog-2.jpg'
import b3 from '../assets/blog-3.jpg'

/*
 * DRAFT POSTS — the articles themselves aren't written yet; links are
 * placeholders. Titles/topics are ours to publish.
 */
const POSTS = [
  {
    img: b1,
    kind: 'PLAYBOOK',
    date: 'Sep 2026',
    read: '7 MIN READ',
    title: 'Agentic AI: from chatbots to a workforce that ships',
    tags: ['AGENTIC AI', 'AUTOMATION'],
  },
  {
    img: b2,
    kind: 'GUIDE',
    date: 'Sep 2026',
    read: '9 MIN READ',
    title: 'GEO: getting your brand cited by ChatGPT, Perplexity & Gemini',
    tags: ['GEO', 'AI SEARCH'],
  },
  {
    img: b3,
    kind: 'INSIGHTS',
    date: 'Sep 2026',
    read: '6 MIN READ',
    title: 'From paper invoice to ERP entry in eight seconds',
    tags: ['SMART ERP', 'AI / OCR'],
  },
]

export default function Blog() {
  return (
    <section className="container-x py-28">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Intel</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold md:text-5xl">
            Dispatches from the war front.
          </h2>
        </div>
        <a href="/blog" className="btn-ghost">All Articles</a>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {POSTS.map((p, i) => (
          <motion.a
            key={p.title}
            href="/contact"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
            className="group overflow-hidden rounded-3xl border border-line bg-card transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="overflow-hidden">
              <img
                src={p.img}
                alt=""
                loading="lazy"
                className="block aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
              />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.16em]">
                <span className="text-gold">{p.kind}</span>
                <span className="text-muted">{p.date}</span>
                <span className="text-muted">{p.read}</span>
              </div>
              <h3 className="mt-3 text-lg font-bold leading-snug">{p.title}</h3>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  {p.tags.map((t) => (
                    <span key={t} className="chip !text-[0.55rem]">{t}</span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs font-bold text-gold">
                  READ <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  )
}
