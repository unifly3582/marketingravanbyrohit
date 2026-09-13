import Hero from '../components/Hero.jsx'
import Statement from '../components/Statement.jsx'
import HeadStack from '../components/head-stack/HeadStack.jsx'

/*
 * Homepage (2026-09-13): hero, the statement line, then the ten heads as a
 * tilted card pile (HeadStack), then the site footer. The older "What we do"
 * stage and the sections after it still exist under components/ for reuse.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Statement />
      <HeadStack />
    </>
  )
}
