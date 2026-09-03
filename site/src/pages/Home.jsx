import Hero from '../components/Hero.jsx'
import ImageMarquee from '../components/ImageMarquee.jsx'
import Statement from '../components/Statement.jsx'
import Heads from '../components/Heads.jsx'
import Marquee from '../components/Marquee.jsx'
import CaseTeaser from '../components/CaseTeaser.jsx'
import Process from '../components/Process.jsx'
import StatsStrip from '../components/StatsStrip.jsx'
import WhyUs from '../components/WhyUs.jsx'
import Testimonials from '../components/Testimonials.jsx'
import Blog from '../components/Blog.jsx'
import Contact from '../components/Contact.jsx'

export default function Home() {
  return (
    <>
      <Hero />
      <ImageMarquee />
      <Statement />
      <Heads />
      <Marquee />
      <CaseTeaser />
      <Process />
      <StatsStrip />
      <WhyUs />
      <Testimonials />
      <Blog />
      <Contact />
    </>
  )
}
