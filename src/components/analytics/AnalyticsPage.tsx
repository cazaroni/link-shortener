import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function AnalyticsPage() {
  useDocumentTitle('Analytics · Link Shortener')

  return (
    <div className="page-intro">
      <h1>Analytics</h1>
      <p>See where clicks come from and which devices open your links.</p>
    </div>
  )
}
