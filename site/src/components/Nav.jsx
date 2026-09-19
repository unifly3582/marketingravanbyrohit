import { useEffect, useRef, useState } from 'react'
import logo from '../assets/logo-mark.webp'
import logo64 from '../assets/logo-mark-64.webp'
import logo112 from '../assets/logo-mark-112.webp'
import { openRavan } from '../lib/ravan.js'

/*
 * The header: logo on the left, one "Talk to Ravan" action on the right.
 * No page links and no menu — the site is a single page. It turns solid
 * once past the top and rides the scroll: slides up with the page as you
 * scroll down, slides back down as you scroll up.
 */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef(null)

  /* the header rides with the scroll: every pixel scrolled down pushes it
     up by a pixel until it is fully out of view, every pixel scrolled up
     pulls it back down, so it moves as part of the page rather than
     snapping. Written straight to the element (no state, no transition)
     so it tracks the wheel with zero lag. */
  useEffect(() => {
    let last = window.scrollY
    let offset = 0 // 0 = fully shown, h = fully hidden
    let raf = 0
    const apply = () => {
      raf = 0
      const el = ref.current
      if (el) el.style.transform = `translateY(${-offset}px)`
    }
    const onScroll = () => {
      const y = window.scrollY
      const h = ref.current?.offsetHeight ?? 0
      setScrolled(y > 24)
      offset = y <= 0 ? 0 : Math.min(h, Math.max(0, offset + (y - last)))
      last = y
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const first = requestAnimationFrame(onScroll) // through a frame, not a forced layout mid-commit
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(first)
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header
      ref={ref}
      className={`fixed inset-x-0 top-0 z-50 will-change-transform transition-colors duration-300 ${
        scrolled ? 'bg-ground/85 backdrop-blur-md border-b border-line' : 'bg-transparent'
      }`}
    >
      <nav className="container-x flex items-center justify-between py-1 md:py-3">
        <a href="/" className="flex items-center gap-2 md:gap-3">
          <img
            src={logo}
            srcSet={`${logo64} 57w, ${logo112} 99w, ${logo} 149w`}
            sizes="(min-width: 768px) 43px, 28px"
            alt=""
            width="149"
            height="168"
            className="h-8 w-auto md:h-12"
          />
          <span className="font-display text-xs font-bold tracking-wide md:text-sm">
            MARKETING <span className="text-gold">RAVAN</span>
          </span>
        </a>

        <button type="button" className="btn-ghost !py-1.5 !text-[0.66rem] md:!py-2 md:!text-[0.72rem]" onClick={openRavan}>
          Talk to Ravan
        </button>
      </nav>
    </header>
  )
}
