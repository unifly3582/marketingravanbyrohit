import Hero from '../components/Hero.jsx'
import HeadStack from '../components/head-stack/HeadStack.jsx'
import './home-transition.css'

/*
 * The hero blends into the statement and service cards.
 */
export default function Home() {
  return (
    <div className="home-connected">
      <Hero />
      <HeadStack />
    </div>
  )
}
