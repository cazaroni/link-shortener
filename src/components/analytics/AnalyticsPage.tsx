import '../../styles/analytics.css'
import { useId, useMemo, useState } from 'react'
import { CODE_PATTERN, type Link } from '../../../shared/api'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLinks } from '../../hooks/useLinks'
import { countryName, deviceName, referrerName } from '../../lib/breakdown'
import { resolveRange, type RangePreset, type RangeSelection } from '../../lib/analyticsRange'
import { dayOf, isDay, todayUtc } from '../../lib/dates'
import { AppLink } from '../AppLink'
import { RefreshIcon } from '../icons'
import { AnalyticsFilters, type LinksStatus } from './AnalyticsFilters'
import { BreakdownCard } from './BreakdownCard'
import { SummaryCard } from './SummaryCard'
import { TimeSeriesCard } from './TimeSeriesCard'

const NO_LINKS: readonly Link[] = []

interface ViewState extends RangeSelection {
  /** null = all links. */
  code: string | null
  includeBots: boolean
}

/**
 * Initial controls, read from the URL once so the view can be deep-linked:
 * /analytics?code=abc123&range=30d&bots=1  or  /analytics?from=2026-03-01&to=2026-03-15
 */
function readInitialView(): ViewState {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const range = params.get('range')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const hasDates = isDay(from) || isDay(to)

  let preset: RangePreset = 'all'
  if (range === '7d' || range === '30d' || range === 'all') preset = range
  else if (hasDates) preset = 'custom'

  return {
    code: code && CODE_PATTERN.test(code) ? code : null,
    preset,
    from: isDay(from) ? from : '',
    to: isDay(to) ? to : '',
    includeBots: params.get('bots') === '1' || params.get('bots') === 'true',
  }
}

export function AnalyticsPage() {
  useDocumentTitle('Analytics · Link Shortener')
  const resultsId = useId()
  const [view, setView] = useState(readInitialView)
  // The link list only feeds the scope selector; the analytics themselves don't depend on it.
  const { links, error: linksError, refresh: refreshLinks } = useLinks()
  const linksStatus: LinksStatus = links ? 'ready' : linksError ? 'error' : 'loading'

  const today = todayUtc()
  // `earliest` comes back with every response; it is both the lowest selectable day and the "All time" start.
  const [knownEarliest, setKnownEarliest] = useState<string | null>(null)
  const scopeStart = useMemo(() => {
    const link = view.code ? links?.find((item) => item.code === view.code) : undefined
    return link ? dayOf(link.createdAt) : null
  }, [view.code, links])
  const range = useMemo(
    () => resolveRange(view, today, knownEarliest, scopeStart),
    [view, today, knownEarliest, scopeStart],
  )

  const { data, error, pending, retry } = useAnalytics({
    enabled: range.error === null,
    code: view.code,
    from: range.requestFrom,
    to: range.requestTo,
    includeBots: view.includeBots,
  })

  const earliestFromData = data?.earliest ? dayOf(data.earliest) : null
  if (earliestFromData && earliestFromData !== knownEarliest) setKnownEarliest(earliestFromData)

  // Results are stale while a new request runs or while the controls hold an invalid range.
  const stale = pending || range.error !== null
  const topLevelError = error && range.error === null

  function setDates(next: { from?: string; to?: string }) {
    setView((prev) => ({
      ...prev,
      preset: 'custom',
      from: next.from ?? range.displayFrom,
      to: next.to ?? range.displayTo,
    }))
  }

  return (
    <>
      <div className="page-intro">
        <h1>Analytics</h1>
        <p>See where your clicks come from and which devices open your links. Pick one link or all of them, and any time range.</p>
      </div>

      <div className="analytics stack">
        <AnalyticsFilters
          links={links ?? NO_LINKS}
          linksStatus={linksStatus}
          onReloadLinks={() => void refreshLinks()}
          code={view.code}
          onCodeChange={(code) => setView((prev) => ({ ...prev, code }))}
          preset={view.preset}
          onPresetChange={(preset) => setView((prev) => ({ ...prev, preset }))}
          range={range}
          minDay={knownEarliest}
          maxDay={today}
          onFromChange={(from) => setDates({ from })}
          onToChange={(to) => setDates({ to })}
          includeBots={view.includeBots}
          onIncludeBotsChange={(includeBots) => setView((prev) => ({ ...prev, includeBots }))}
        />

        <div id={resultsId} className="analytics-results" aria-busy={stale} data-stale={stale || undefined}>
          {topLevelError ? (
            <div className="card state-card" role="alert">
              <p className="state-title">Couldn’t load analytics</p>
              <p className="state-text">{error.message}</p>
              <div className="state-actions">
                {error.code === 'NOT_FOUND' ? (
                  <button type="button" className="btn btn--secondary btn--small" onClick={() => setView((prev) => ({ ...prev, code: null }))}>
                    Show all links
                  </button>
                ) : (
                  <button type="button" className="btn btn--secondary btn--small" onClick={retry}>
                    <RefreshIcon />
                    Try again
                  </button>
                )}
              </div>
            </div>
          ) : !data ? (
            <div className="card state-card" role="status">
              {range.error ? (
                <p className="state-text">Fix the date range above to see results.</p>
              ) : (
                <p className="state-text state-text--loading">
                  <span className="spinner" aria-hidden="true" />
                  Loading analytics…
                </p>
              )}
            </div>
          ) : (
            <Results data={data} includeBots={view.includeBots} onShowAll={() => setView((prev) => ({ ...prev, preset: 'all' }))} />
          )}
        </div>
      </div>
    </>
  )
}

interface ResultsProps {
  data: NonNullable<ReturnType<typeof useAnalytics>['data']>
  includeBots: boolean
  onShowAll: () => void
}

function Results({ data, includeBots, onShowAll }: ResultsProps) {
  if (data.earliest === null) {
    return (
      <div className="card state-card">
        <p className="state-title">No links yet</p>
        <p className="state-text">Analytics appear here once you’ve created a link and it has been opened.</p>
        <div className="state-actions">
          <AppLink className="btn btn--primary btn--small" to="/">
            Create a link
          </AppLink>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="sr-only" role="status">
        {`${data.totalClicks.toLocaleString()} clicks. ${data.code ? `Link ${data.code}` : 'All links'}.`}
      </div>
      <SummaryCard data={data} includeBots={includeBots} />
      {data.totalClicks === 0 ? (
        <div className="card state-card">
          <p className="state-title">No clicks in this range yet</p>
          <p className="state-text">
            {includeBots
              ? 'Try a wider date range or another link.'
              : 'Try a wider date range or another link. Bots are excluded; turn on “Include bots” to count them.'}
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn--secondary btn--small" onClick={onShowAll}>
              Show all time
            </button>
          </div>
        </div>
      ) : (
        <div className="chart-grid-layout">
          <TimeSeriesCard points={data.timeseries} />
          <BreakdownCard className="chart-card--half chart-card--tall" title="Countries" items={data.countries} labelFor={countryName} />
          <BreakdownCard className="chart-card--half" title="Devices" items={data.devices} labelFor={deviceName} />
          <BreakdownCard className="chart-card--half" title="Browsers" items={data.browsers} otherKey="Other" />
          <BreakdownCard className="chart-card--half" title="Operating systems" items={data.os} otherKey="Other" />
          <BreakdownCard className="chart-card--half chart-card--last" title="Referrers" items={data.referrers} labelFor={referrerName} />
        </div>
      )}
    </>
  )
}
