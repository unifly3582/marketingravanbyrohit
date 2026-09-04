import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import VoiceAgent from './components/VoiceAgent.jsx'
import Home from './pages/Home.jsx'
import WorksPage from './pages/WorksPage.jsx'
import CaseNova from './pages/CaseNova.jsx'
import AboutPage from './pages/AboutPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import BlogPage from './pages/BlogPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import HeadAgents from './pages/HeadAgents.jsx'
// Code-split: React Flow is ~150kB and only this route needs it.
const AgentWorkflows = lazy(() => import('./pages/AgentWorkflows.jsx'))
// The other nine head pages each carry their own demo; split per route.
const HEAD_PAGES = {
  sdr: lazy(() => import('./pages/heads/HeadSdr.jsx')),
  voice: lazy(() => import('./pages/heads/HeadVoice.jsx')),
  geo: lazy(() => import('./pages/heads/HeadGeo.jsx')),
  erp: lazy(() => import('./pages/heads/HeadErp.jsx')),
  ads: lazy(() => import('./pages/heads/HeadAds.jsx')),
  bi: lazy(() => import('./pages/heads/HeadBi.jsx')),
  uiux: lazy(() => import('./pages/heads/HeadUiux.jsx')),
  api: lazy(() => import('./pages/heads/HeadApi.jsx')),
  shield: lazy(() => import('./pages/heads/HeadShield.jsx')),
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}

export default function App() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true })
    let raf
    function loop(time) {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/case/aurora-robotics" element={<CaseNova />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/heads/agents" element={<HeadAgents />} />
          {Object.entries(HEAD_PAGES).map(([slug, Page]) => (
            <Route
              key={slug}
              path={`/heads/${slug}`}
              element={
                <Suspense fallback={<div className="min-h-[60vh]" />}>
                  <Page />
                </Suspense>
              }
            />
          ))}
          <Route
            path="/live"
            element={
              <Suspense fallback={<div className="min-h-[60vh]" />}>
                <AgentWorkflows />
              </Suspense>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <VoiceAgent />
    </>
  )
}
