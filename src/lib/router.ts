import { useSyncExternalStore } from 'react'

/**
 * Minimal client-side router: two top-level views and pushState navigation.
 * The server answers every reserved single-segment path (including /analytics) with the SPA shell,
 * so a direct load or a reload of any of these paths works.
 */
export type AppRoute = 'links' | 'analytics'

export const ROUTE_PATHS: Record<AppRoute, string> = {
  links: '/',
  analytics: '/analytics',
}

/** Anything that is not a known section falls back to the links dashboard. */
export function routeForPath(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === ROUTE_PATHS.analytics ? 'analytics' : 'links'
}

const NAVIGATE_EVENT = 'app:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

function getPathname() {
  return window.location.pathname
}

/** Current top-level view; re-renders on pushState navigation and on back/forward. */
export function useRoute(): AppRoute {
  return routeForPath(useSyncExternalStore(subscribe, getPathname, () => '/'))
}

/** Moves keyboard and screen-reader focus to the new view's heading once it has rendered. */
function focusMainHeading() {
  window.requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>('#main h1')
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  })
}

/** pushState navigation to a path (optionally with a query string). */
export function navigate(to: string) {
  const current = window.location.pathname + window.location.search
  if (to === current) return
  window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
  focusMainHeading()
}
