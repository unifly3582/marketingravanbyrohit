import Hero from '../components/Hero.jsx'
import HeadStack from '../components/head-stack/HeadStack.jsx'

/*
 * Homepage (2026-09-13): hero, then one pinned block that carries the
 * statement line into the ten-head card pile (HeadStack renders Statement
 * inside itself), then the site footer. The older "What we do" stage and the
 * sections after it still exist under components/ for reuse.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <HeadStack />
    </>
  )
}
