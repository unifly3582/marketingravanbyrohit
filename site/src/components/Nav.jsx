import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo-mark.png'
import { openRavan } from '../lib/ravan.js'

/*
 * The header: logo on the left, one "Talk to Ravan" action on the right.
 * No page links and no menu — the site is a single page. It turns solid
 * once past the top, hides while scrolling down and returns on the first
 * scroll back up.
 */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false) // slid up out of view

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      const dy = y - last
      if (y < 80) setHidden(false)
      else if (dy > 6) setHidden(true)
      else if (dy < -6) setHidden(false)
      if (Math.abs(dy) > 6) last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color] duration-300 ease-out ${
        scrolled ? 'bg-ground/85 backdrop-blur-md border-b border-line' : 'bg-transparent'
      } ${hidden ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <nav className="container-x flex items-center justify-between py-1 md:py-3">
        <Link to="/" className="flex items-center gap-2 md:gap-3">
          <img src={logo} alt="Marketing Ravan" className="h-7 w-7 rounded-full object-cover object-top md:h-11 md:w-11" />
          <span className="font-display text-xs font-bold tracking-wide md:text-sm">
            MARKETING <span className="text-gold">RAVAN</span>
          </span>
        </Link>

        <button type="button" className="btn-ghost !py-1.5 !text-[0.66rem] md:!py-2 md:!text-[0.72rem]" onClick={openRavan}>
          Talk to Ravan
        </button>
      </nav>
    </header>
  )
}
