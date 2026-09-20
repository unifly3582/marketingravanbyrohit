import { useCallback, useEffect, useState } from 'react'

/*
 * The site is a single page, so it carries no router. "Navigating" keeps the
 * URL honest (the agent's page-awareness and the launcher label read it) and
 * scrolls to the section a hash names, which is what the agent's
 * navigate_site tool amounts to on a one-page site.
 */
export function usePage() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const on = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])

  const navigate = useCallback((to) => {
    const url = new URL(to, window.location.href)
    if (url.pathname !== window.location.pathname || url.hash !== window.location.hash) {
      history.pushState(null, '', url.pathname + url.search + url.hash)
      // every usePage instance (the App's page switch included) follows
      window.dispatchEvent(new Event('popstate'))
    }
    setPathname(url.pathname)
    const target = url.hash ? document.getElementById(url.hash.slice(1)) : null
    if (target) target.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return { pathname, navigate }
}
