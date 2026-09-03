import { motion } from 'motion/react'
import { Arrow } from './icons.jsx'
import CallRequest from './CallRequest.jsx'

const OPTIONS = [
  {
    title: 'Book an intro call',
    desc: '45 minutes on where automation pays back first in your business. No deck, no fluff.',
    cta: 'Book a Call',
    href: 'mailto:hello@marketingravan.com?subject=Intro%20call',
  },
  {
    title: 'WhatsApp us',
    desc: 'Talk to us where our agents live. A human answers — usually within the hour.',
    cta: 'Open WhatsApp',
    href: '#', // TODO: set wa.me link
  },
  {
    title: 'Scope a project',
    desc: 'Have a defined build in mind — an SDR flow, an ERP pipeline, a site? Send the brief.',
    cta: 'Email the Brief',
    href: 'mailto:hello@marketingravan.com?subject=Project%20brief',
  },
]

export default function Contact() {
  return (
    <section id="contact" className="border-t border-line bg-surface/60 py-28">
      <div className="container-x">
        <div className="text-center">
          <p className="font-deva text-3xl text-ember/60">दस सिर। एक लक्ष्य।</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold md:text-6xl">
            Your funnel isn't going to automate itself.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted">
            Tell us what you're building. The first strategy session is on us.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {OPTIONS.map((o, i) => (
            <motion.div
              key={o.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="flex flex-col rounded-3xl border border-line bg-card p-8"
            >
              <h3 className="text-xl font-bold">{o.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{o.desc}</p>
              <a
                href={o.href}
                className={`${i === 0 ? 'btn-primary' : 'btn-ghost'} mt-6 w-full justify-center`}
              >
                {o.cta} <Arrow className="h-4 w-4" />
              </a>
            </motion.div>
          ))}
        </div>

        <CallRequest />
      </div>
    </section>
  )
}
