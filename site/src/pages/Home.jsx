import Hero from '../components/Hero.jsx'
import Statement from '../components/Statement.jsx'

/*
 * Homepage, stripped back (2026-09-13): hero and the statement line only,
 * then the site footer. The "What we do" stage and every section after it
 * were removed; the components still exist under components/ for reuse.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Statement />
    </>
  )
}
