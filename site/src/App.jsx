import { Suspense, lazy, useEffect, useState } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import { RAVAN_OPEN, openRavan } from './lib/ravan.js'
import { usePage } from './lib/page.js'

/*
 * The agent panel (Motion, the WhatsApp demos, the audio client) is the
 * heaviest code on the page and nobody needs it to see the hero. It is
 * fetched after the page has loaded and the browser is idle, or at once if a
 * visitor asks for it first. Until then a look-alike corner button stands in.
 */
const VoiceAgent = lazy(() => import('./components/VoiceAgent.jsx'))

/* the one other page: the Website Development story, its own chunk */
const WebsiteDev = lazy(() => import('./pages/WebsiteDev.jsx'))
const isWebsiteDev = (path) => /^\/(website-development|heads\/uiux)\/?$/.test(path)

/* the Meta Ads story, told like a monochrome reel, at /heads/ads (and /ads) */
const AdsStory = lazy(() => import('./pages/AdsStory.jsx'))
const isAdsStory = (path) => /^\/(heads\/)?ads\/?$/.test(path)

const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1200))

/* the corner button as it looks before the agent's code has arrived */
function LauncherFallback() {
  return (
    <button
      type="button"
      onClick={openRavan}
      aria-label="Ask Ravan"
      className="fixed right-4 bottom-4 z-50 inline-flex h-12 items-center gap-2.5 rounded-full pr-4 pl-2 font-display text-sm font-bold text-[#1a0d05] shadow-[0_10px_32px_rgba(226,87,30,0.4)] md:right-6 md:bottom-6"
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-gold to-ember" />
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#1a0d05]/15">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </span>
      <span className="relative">Ask Ravan</span>
    </button>
  )
}

export default function App() {
  const [agent, setAgent] = useState(false) // the agent's code is wanted
  const [wantOpen, setWantOpen] = useState(false) // ...and its panel open on arrival
  const { pathname } = usePage()

  // Smooth wheel scrolling is a mouse-and-trackpad nicety: phones scroll
  // natively, so they never download Lenis at all.
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let lenis = null
    let raf = 0
    let gone = false
    import('lenis').then(({ default: Lenis }) => {
      if (gone) return
      lenis = new Lenis({ lerp: 0.12, smoothWheel: true })
      const loop = (time) => {
        lenis.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => {
      gone = true
      cancelAnimationFrame(raf)
      lenis?.destroy()
    }
  }, [])

  useEffect(() => {
    let id = 0
    const wake = () => {
      if (id) ('cancelIdleCallback' in window ? cancelIdleCallback : clearTimeout)(id)
      id = idle(() => setAgent(true))
    }
    const onOpen = () => {
      setWantOpen(true)
      setAgent(true)
    }
    window.addEventListener(RAVAN_OPEN, onOpen)
    // the first sign of a visitor (a scroll, a touch, a key) fetches the
    // code in the background; a quiet visitor gets it after a while anyway
    const opts = { passive: true, once: true }
    window.addEventListener('scroll', wake, opts)
    window.addEventListener('pointerdown', wake, opts)
    window.addEventListener('touchstart', wake, opts)
    window.addEventListener('keydown', wake, opts)
    const timer = setTimeout(wake, 15000)
    return () => {
      window.removeEventListener(RAVAN_OPEN, onOpen)
      window.removeEventListener('scroll', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('touchstart', wake)
      window.removeEventListener('keydown', wake)
      clearTimeout(timer)
      if (id) ('cancelIdleCallback' in window ? cancelIdleCallback : clearTimeout)(id)
    }
  }, [])

  return (
    <>
      <Nav />
      <main>
        {isWebsiteDev(pathname) ? (
          <Suspense fallback={<div style={{ height: '100vh' }} />}>
            <WebsiteDev />
          </Suspense>
        ) : isAdsStory(pathname) ? (
          <Suspense fallback={<div style={{ height: '100vh' }} />}>
            <AdsStory />
          </Suspense>
        ) : (
          <Home />
        )}
      </main>
      <Footer />
      {agent ? (
        <Suspense fallback={<LauncherFallback />}>
          <VoiceAgent initialOpen={wantOpen} />
        </Suspense>
      ) : (
        <LauncherFallback />
      )}
    </>
  )
}
