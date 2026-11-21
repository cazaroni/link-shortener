import { useSyncExternalStore } from 'react'
import { SPA_ROUTES } from '../../shared/api'
import { isDashboardPath } from './route'

/**
 * Minimal client-side router: the app's views and pushState navigation. This is the one place that maps
 * a path to a view; "/" is decided by `isDashboardPath` (lib/route.ts) so the two can't disagree.
 * The server answers /analytics with the SPA shell, so a direct load or a reload works.
 */
export type NavRoute = 'links' | 'analytics'
export type AppRoute = NavRoute | 'not-found'

/** Paths of the views that appear in the main navigation. */
export const ROUTE_PATHS: Record<NavRoute, string> = {
  links: '/',
  // The server serves SPA_ROUTES with 200 (functions/[code].ts); keep the client path derived from it.
  analytics: `/${SPA_ROUTES[0]}`,
}

/** "/" is the links dashboard, "/analytics" the analytics view, anything else is a short code that wasn't found. */
export function routeForPath(pathname: string): AppRoute {
  if (isDashboardPath(pathname)) return 'links'
  // One optional trailing slash, matching the server (which 404s on "/analytics//"). Case-sensitive, like the server.
  const normalized = pathname.replace(/\/$/, '')
  return normalized === ROUTE_PATHS.analytics ? 'analytics' : 'not-found'
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
