import { Dashboard } from './components/Dashboard'
import { NotFound } from './components/NotFound'
import { SiteHeader } from './components/SiteHeader'
import { attemptedCode, isDashboardPath } from './lib/route'

/**
 * No router library: the app has one real page ("/"). The backend serves this same HTML with a 404
 * for unknown short codes, so any other path renders the friendly "link not found" page.
 */
export default function App() {
  const { pathname } = window.location

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main className="page" id="main">
        <div className="container">
          {isDashboardPath(pathname) ? <Dashboard /> : <NotFound attempted={attemptedCode(pathname)} />}
        </div>
      </main>
    </>
  )
}
