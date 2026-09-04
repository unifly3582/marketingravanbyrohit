import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Arrow } from './icons.jsx'
import logo from '../assets/logo-mark.png'

const LINKS = [
  { label: 'Services', href: '/#heads', anchor: true },
  { label: 'Work', href: '/works' },
  { label: 'About', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkCls =
    'text-[0.78rem] font-semibold tracking-widest text-cream/80 uppercase transition-colors hover:text-gold'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-ground/85 backdrop-blur-md border-b border-line' : 'bg-transparent'
      }`}
    >
      <nav className="container-x flex items-center justify-between py-3">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Marketing Ravan" className="h-11 w-11 rounded-full object-cover object-top" />
          <span className="font-display text-sm font-bold tracking-wide">
            MARKETING <span className="text-gold">RAVAN</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) =>
            l.anchor ? (
              <a key={l.href} href={l.href} className={linkCls}>{l.label}</a>
            ) : (
              <NavLink
                key={l.href}
                to={l.href}
                className={({ isActive }) => `${linkCls} ${isActive ? '!text-gold' : ''}`}
              >
                {l.label}
              </NavLink>
            ),
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/contact" className="btn-primary hidden !py-2.5 !px-5 text-xs md:inline-flex">
            Let's Talk <Arrow className="h-3.5 w-3.5" />
          </Link>
          <button
            className="btn-ghost !p-2.5 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-ground/95 px-6 py-4 backdrop-blur-md md:hidden">
          {LINKS.map((l) =>
            l.anchor ? (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-semibold uppercase tracking-widest text-cream/85"
              >
                {l.label}
              </a>
            ) : (
              <NavLink
                key={l.href}
                to={l.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-semibold uppercase tracking-widest text-cream/85"
              >
                {l.label}
              </NavLink>
            ),
          )}
          <Link to="/contact" onClick={() => setOpen(false)} className="btn-primary mt-3 w-full justify-center">
            Let's Talk
          </Link>
        </div>
      )}
    </header>
  )
}
