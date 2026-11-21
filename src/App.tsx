import { Dashboard } from './components/Dashboard'
import { SiteHeader } from './components/SiteHeader'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main className="page" id="main">
        <div className="container">
          <Dashboard />
        </div>
      </main>
    </>
  )
}
