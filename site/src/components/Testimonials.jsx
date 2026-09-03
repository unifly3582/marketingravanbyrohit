import { motion } from 'motion/react'

/*
 * PLACEHOLDER CONTENT — these are sample quotes with fictional names so the
 * section is designed and ready. Swap in real client testimonials before launch.
 */
const QUOTES = [
  {
    quote:
      'The SDR head booked more qualified calls in its first month than our old agency did in a quarter.',
    name: 'Placeholder — replace with a real client',
    role: 'Founder, D2C brand',
  },
  {
    quote:
      'Invoices go from WhatsApp photo to our ERP in seconds. Our back office finally stopped drowning.',
    name: 'Placeholder — replace with a real client',
    role: 'Operations Head, distribution company',
  },
  {
    quote:
      'We started showing up in ChatGPT and Perplexity answers for our category. That traffic converts.',
    name: 'Placeholder — replace with a real client',
    role: 'CMO, SaaS startup',
  },
]

export default function Testimonials() {
  return (
    <section className="container-x py-28">
      <div className="mb-12 text-center">
        <p className="eyebrow justify-center">Field reports</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
          Stories from the war front.
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {QUOTES.map((q, i) => (
          <motion.figure
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="flex flex-col justify-between rounded-3xl border border-line bg-card p-8"
          >
            <blockquote className="text-[0.95rem] leading-relaxed text-cream/90">
              “{q.quote}”
            </blockquote>
            <figcaption className="mt-6 border-t border-line pt-4">
              <p className="text-sm font-semibold">{q.name}</p>
              <p className="text-xs text-muted">{q.role}</p>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  )
}
