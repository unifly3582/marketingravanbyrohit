import { Arrow } from './icons.jsx'
import CallRequest from './CallRequest.jsx'
import LeadForm from './LeadForm.jsx'

/*
 * One form, plus the two other ways to reach us on a single line. The AI
 * call-back demo is included by default (head pages, pricing, about); Home
 * passes call={false} because it already shows the demo as its own section.
 */
const ALT = [
  { label: 'Book a call', href: 'mailto:hello@marketingravan.com?subject=Intro%20call' },
  { label: 'WhatsApp us', href: '#' }, // TODO: set wa.me link
]

export default function Contact({ call = true }) {
  return (
    <section id="contact" className="border-t border-line bg-surface/60 py-28">
      <div className="container-x">
        <div className="text-center">
          <p className="font-deva text-3xl text-ember/60">दस सिर। एक लक्ष्य।</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold md:text-6xl">
            Your funnel isn't going to automate itself.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted">
            Tell us what you're building. The first strategy call is on us.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {ALT.map((a) => (
              <a key={a.label} href={a.href} className="btn-ghost">
                {a.label} <Arrow className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <LeadForm />
          {call && <CallRequest />}
        </div>
      </div>
    </section>
  )
}
