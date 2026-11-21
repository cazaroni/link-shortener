import { useId } from 'react'
import type { TimeseriesPoint } from '../../../shared/analytics'
import { TimeSeriesChart } from './TimeSeriesChart'

export function TimeSeriesCard({ points }: { points: readonly TimeseriesPoint[] }) {
  const headingId = useId()
  return (
    <section className="card chart-card chart-card--wide" aria-labelledby={headingId}>
      <div className="chart-head">
        <h2 className="chart-title" id={headingId}>
          Clicks over time
        </h2>
        <p className="chart-note">Per day, UTC</p>
      </div>
      <TimeSeriesChart points={points} />
    </section>
  )
}
