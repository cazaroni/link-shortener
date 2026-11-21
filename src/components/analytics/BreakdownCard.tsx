import { useId } from 'react'
import type { BreakdownItem } from '../../../shared/analytics'
import { clicksLabel, formatCount, formatShare, toBarRows, type RollupOptions } from '../../lib/breakdown'

interface BreakdownCardProps extends RollupOptions {
  title: string
  items: readonly BreakdownItem[]
  /** Layout hook: lets the page grid decide how wide this card is. */
  className?: string
}

/**
 * A ranked list of horizontal bars: one hue (nominal categories get one color, not a ramp),
 * count and share printed at the bar's end, long tails folded into a muted "Other" row.
 * The list itself is the text alternative: every name, count and share is real text.
 */
export function BreakdownCard({ title, items, className, ...options }: BreakdownCardProps) {
  const headingId = useId()
  const rows = toBarRows(items, options)
  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0)

  return (
    <section className={`card chart-card${className ? ` ${className}` : ''}`} aria-labelledby={headingId}>
      <h2 className="chart-title" id={headingId}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="chart-empty">No data in this range.</p>
      ) : (
        <ul className="bar-list">
          {rows.map((row) => {
            const share = formatShare(row.share)
            return (
              <li
                key={row.key}
                className={`bar-row${row.isOther ? ' is-other' : ''}`}
                title={`${row.label}: ${clicksLabel(row.count)} (${share})${row.detail ? `, ${row.detail}` : ''}`}
              >
                <span className="bar-label">{row.label}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(row.count / maxCount) * 100}%` }} />
                </span>
                <span className="bar-value">
                  <span className="bar-count">
                    {formatCount(row.count)}
                    <span className="sr-only"> clicks,</span>
                  </span>
                  <span className="bar-share">
                    {share}
                    <span className="sr-only"> of total</span>
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
