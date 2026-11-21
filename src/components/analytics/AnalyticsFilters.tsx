import { useId } from 'react'
import type { Link } from '../../../shared/api'
import { PRESETS, type RangePreset, type ResolvedRange } from '../../lib/analyticsRange'

export type LinksStatus = 'loading' | 'ready' | 'error'

/** "https://www.example.com/a/long/path/" -> "example.com/a/long/pa…" */
function describeDestination(url: string, max = 44): string {
  const bare = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare
}

interface AnalyticsFiltersProps {
  links: readonly Link[]
  linksStatus: LinksStatus
  onReloadLinks: () => void
  code: string | null
  onCodeChange: (code: string | null) => void
  preset: RangePreset
  onPresetChange: (preset: Exclude<RangePreset, 'custom'>) => void
  range: ResolvedRange
  /** Bounds for the date pickers. */
  minDay: string | null
  maxDay: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  includeBots: boolean
  onIncludeBotsChange: (value: boolean) => void
}

/** One row of controls that scopes everything below it. */
export function AnalyticsFilters({
  links,
  linksStatus,
  onReloadLinks,
  code,
  onCodeChange,
  preset,
  onPresetChange,
  range,
  minDay,
  maxDay,
  onFromChange,
  onToChange,
  includeBots,
  onIncludeBotsChange,
}: AnalyticsFiltersProps) {
  const id = useId()
  const scopeId = `${id}-scope`
  const fromId = `${id}-from`
  const toId = `${id}-to`
  const dateHintId = `${id}-date-hint`
  const dateErrorId = `${id}-date-error`
  const linksHintId = `${id}-links-hint`

  const knownCode = code === null || links.some((link) => link.code === code)
  const dateDescribedBy = [dateHintId, range.error ? dateErrorId : null].filter(Boolean).join(' ')

  return (
    <section className="card filters" aria-label="Analytics filters">
      <div className="filters-grid">
        <div className="field filters-scope">
          <label className="field-label" htmlFor={scopeId}>
            Link
          </label>
          <select
            id={scopeId}
            className="input select"
            value={code ?? ''}
            onChange={(event) => onCodeChange(event.target.value || null)}
            aria-describedby={linksStatus === 'error' ? linksHintId : undefined}
          >
            <option value="">All links</option>
            {!knownCode && code && <option value={code}>{code}</option>}
            {links.map((link) => (
              <option key={link.code} value={link.code}>
                {link.code} · {describeDestination(link.url)}
              </option>
            ))}
          </select>
          {linksStatus === 'error' && (
            <p className="field-hint" id={linksHintId}>
              Couldn’t load your links, so only the total is available.{' '}
              <button type="button" className="btn-link" onClick={onReloadLinks}>
                Try again
              </button>
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={fromId}>
            From
          </label>
          <input
            id={fromId}
            className="input"
            type="date"
            value={range.displayFrom}
            min={minDay ?? undefined}
            max={maxDay}
            onChange={(event) => onFromChange(event.target.value)}
            aria-invalid={range.error ? true : undefined}
            aria-describedby={dateDescribedBy}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={toId}>
            To
          </label>
          <input
            id={toId}
            className="input"
            type="date"
            value={range.displayTo}
            min={minDay ?? undefined}
            max={maxDay}
            onChange={(event) => onToChange(event.target.value)}
            aria-invalid={range.error ? true : undefined}
            aria-describedby={dateDescribedBy}
          />
        </div>
      </div>

      <div className="filters-row">
        <div className="segmented" role="group" aria-label="Quick date ranges">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn btn--secondary btn--small segmented-btn"
              aria-pressed={preset === item.id}
              onClick={() => onPresetChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="check">
          <input type="checkbox" checked={includeBots} onChange={(event) => onIncludeBotsChange(event.target.checked)} />
          <span>Include bots</span>
        </label>
      </div>

      <div className="filters-messages" aria-live="polite">
        {range.error ? (
          <p className="field-error" id={dateErrorId}>
            {range.error}
          </p>
        ) : (
          range.notes.map((note) => (
            <p className="field-hint" key={note}>
              {note}
            </p>
          ))
        )}
        <p className="field-hint" id={dateHintId}>
          {minDay ? 'Days are in UTC, starting from your first link.' : 'Days are in UTC.'}
        </p>
      </div>
    </section>
  )
}
