import Hero from '../components/Hero.jsx'
import Services from '../components/Services.jsx'
import Process from '../components/Process.jsx'
import WhyUs from '../components/WhyUs.jsx'
import StatsStrip from '../components/StatsStrip.jsx'
import HearIt from '../components/HearIt.jsx'
import CaseTeaser from '../components/CaseTeaser.jsx'
import PricingTeaser from '../components/PricingTeaser.jsx'
import FAQ from '../components/FAQ.jsx'
import Contact from '../components/Contact.jsx'

/*
 * Homepage order: what we do -> how it works -> why us -> proof -> price ->
 * questions -> contact. Decorative marquees, the statement line, the blog
 * teaser and the placeholder testimonials were removed from this page;
 * the components still exist for when there is real content to show.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Services />
      <Process />
      <WhyUs />
      <StatsStrip note="What each head is built to hit. Targets, not client averages." />
      <HearIt />
      <CaseTeaser />
      <PricingTeaser />
      <FAQ limit={4} more />
      <Contact call={false} />
    </>
  )
}
