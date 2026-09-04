import CallRequest from './CallRequest.jsx'

/*
 * The AI call-back demo as its own section. It is the strongest proof on the
 * site (the visitor hears the product on their own phone), so it gets a
 * headline and a slot high on the page instead of the bottom of Contact.
 */
export default function HearIt() {
  return (
    <section id="hear-it" className="border-y border-line bg-surface/60 py-24">
      <div className="container-x">
        <div className="mb-10 text-center">
          <p className="eyebrow justify-center">Live demo</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold md:text-5xl">
            Hear it yourself.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            The Voice head will ring your phone in seconds. It is the same
            agent we deploy on customer support and telesales lines.
          </p>
        </div>
        <CallRequest />
      </div>
    </section>
  )
}
