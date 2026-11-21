import { AnalyticsPage } from './components/analytics/AnalyticsPage'
import { Dashboard } from './components/Dashboard'
import { SiteHeader } from './components/SiteHeader'
import { useRoute } from './lib/router'

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
          {route === 'analytics' ? <AnalyticsPage /> : <Dashboard />}
        </div>
      </main>
    </>
  )
}
