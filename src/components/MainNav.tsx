import '../styles/nav.css'
import { ROUTE_PATHS, useRoute, type AppRoute } from '../lib/router'
import { AppLink } from './AppLink'

const ITEMS: readonly { route: AppRoute; label: string }[] = [
  { route: 'links', label: 'Links' },
  { route: 'analytics', label: 'Analytics' },
]

/** Top-level navigation between the link dashboard and the analytics view. */
export function MainNav() {
  const current = useRoute()
  return (
    <nav className="main-nav" aria-label="Main">
      <ul>
        {ITEMS.map((item) => (
          <li key={item.route}>
            <AppLink
              className="main-nav-link"
              to={ROUTE_PATHS[item.route]}
              aria-current={current === item.route ? 'page' : undefined}
            >
              {item.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
