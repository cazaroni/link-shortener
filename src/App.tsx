import { AnalyticsPage } from './components/analytics/AnalyticsPage'
import { Dashboard } from './components/Dashboard'
import { NotFound } from './components/NotFound'
import { SiteHeader } from './components/SiteHeader'
import { attemptedCode } from './lib/route'
import { useRoute } from './lib/router'

/**
 * Three views and no router library: the links dashboard ("/"), analytics ("/analytics") and a friendly
 * "link not found" page for every other path (the backend serves this same HTML with a 404 for unknown
 * short codes). See lib/router.ts for how paths map to views.
 */
export default function App() {
  const route = useRoute()

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main className="page" id="main">
        <div className="container">
          {route === 'links' && <Dashboard />}
          {route === 'analytics' && <AnalyticsPage />}
          {route === 'not-found' && <NotFound attempted={attemptedCode(window.location.pathname)} />}
        </div>
      </main>
    </>
  )
}
