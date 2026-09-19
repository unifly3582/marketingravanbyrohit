import { Suspense, lazy, startTransition, useEffect, useState } from 'react'
import Hero from '../components/Hero.jsx'
import { STACK_BUDGET } from '../components/head-stack/stackBudget.js'
import './home-transition.css'

const HeadStack = lazy(() => import('../components/head-stack/HeadStack.jsx'))

/*
 * The hero blends into the statement and service cards.
 *
 * The head stack is the bulk of the page (ten cards, the statement's letters,
 * the wordmark column, four live pieces) and none of it is above the fold on
 * a phone. It is its own chunk, fetched once the hero has mounted and
 * rendered inside a transition, so the first paint carries only the hero and
 * React builds the rest in small slices instead of one long task. Until it
 * arrives a same-height placeholder keeps the page's length, so nothing
 * below shifts.
 */
const Placeholder = () => <section id="heads" className="hs-wrap" style={{ '--hs-budget': STACK_BUDGET }} aria-hidden="true" />

export default function Home() {
  const [stack, setStack] = useState(false)
  useEffect(() => {
    startTransition(() => setStack(true))
  }, [])
  return (
    <div className="home-connected">
      <Hero />
      {stack ? (
        <Suspense fallback={<Placeholder />}>
          <HeadStack />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </div>
  )
}
