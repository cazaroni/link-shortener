import { useId } from 'react'
import type { AnalyticsResponse } from '../../../shared/analytics'
import { formatCount } from '../../lib/breakdown'
import { dayOf, formatDay, formatDayRange } from '../../lib/dates'

const averageFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** "Mar 3 – 30, 2026" from the API's effective (clamped) range. */
function describeRange(data: AnalyticsResponse): string {
  const from = dayOf(data.range.from)
  const to = dayOf(data.range.to)
  return from && to ? formatDayRange(from, to) : ''
}

/** The headline number for the current scope, range and bot setting. */
export function SummaryCard({ data, includeBots }: { data: AnalyticsResponse; includeBots: boolean }) {
  const headingId = useId()
  const days = data.timeseries.length
  const busiest = data.timeseries.reduce<{ date: string; count: number } | null>(
    (best, point) => (point.count > (best?.count ?? 0) ? point : best),
    null,
  )
  const range = describeRange(data)
  const context = [data.code ? `Link ${data.code}` : 'All links', range, includeBots ? 'Bots included' : 'Bots excluded']
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="card summary" aria-labelledby={headingId}>
      <div className="summary-main">
        <h2 className="summary-label" id={headingId}>
          Total clicks
        </h2>
        <p className="summary-value">{formatCount(data.totalClicks)}</p>
        <p className="summary-context">{context}</p>
      </div>
      {data.totalClicks > 0 && days > 0 && (
        <dl className="summary-stats">
          <div>
            <dt>Average per day</dt>
            <dd>{averageFormat.format(data.totalClicks / days)}</dd>
          </div>
          {busiest && (
            <div>
              <dt>Busiest day</dt>
              <dd>
                {formatCount(busiest.count)} <span className="summary-stat-note">on {formatDay(busiest.date)}</span>
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
