import type { AnalyticsResponse, BreakdownItem, TimeseriesPoint } from '../../shared/analytics'
import { ApiError, CONNECTION_ERROR_MESSAGE, request } from '../api'

export interface AnalyticsQuery {
  /** Short code to scope to; null = all links. */
  code: string | null
  /** YYYY-MM-DD (UTC day). null = let the server default to the earliest link. */
  from: string | null
  /** YYYY-MM-DD (UTC day). null = now. */
  to: string | null
  includeBots: boolean
}

export function analyticsPath(query: AnalyticsQuery): string {
  const params = new URLSearchParams()
  if (query.code) params.set('code', query.code)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.includeBots) params.set('includeBots', 'true')
  const search = params.toString()
  return search ? `/api/analytics?${search}` : '/api/analytics'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBreakdown(value: unknown): value is BreakdownItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.key === 'string' && typeof item.count === 'number')
  )
}

function isTimeseries(value: unknown): value is TimeseriesPoint[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.date === 'string' && typeof item.count === 'number')
  )
}

function isAnalyticsResponse(value: unknown): value is AnalyticsResponse {
  return (
    isRecord(value) &&
    isRecord(value.range) &&
    typeof value.range.from === 'string' &&
    typeof value.range.to === 'string' &&
    (value.earliest === null || typeof value.earliest === 'string') &&
    typeof value.totalClicks === 'number' &&
    isBreakdown(value.countries) &&
    isBreakdown(value.devices) &&
    isBreakdown(value.browsers) &&
    isBreakdown(value.os) &&
    isBreakdown(value.referrers) &&
    isTimeseries(value.timeseries)
  )
}

/** GET /api/analytics. Pass a signal to cancel a request whose answer is no longer wanted. */
export async function fetchAnalytics(query: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsResponse> {
  // no-store: new clicks arrive all the time, so never serve a cached copy.
  const body = await request(analyticsPath(query), { cache: 'no-store', signal })
  if (!isAnalyticsResponse(body)) throw new ApiError(CONNECTION_ERROR_MESSAGE, 'BAD_RESPONSE')
  return body
}
