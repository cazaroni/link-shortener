/**
 * Analytics API contract (feature/analytics). Shared by functions/ and src/.
 * Keep dependency-free.
 */

/** Coarse device class derived from the User-Agent. */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

/** One bucket of a breakdown, e.g. { key: 'US', count: 12 }. Sorted by count desc. */
export interface BreakdownItem {
  key: string;
  count: number;
}

/** One day of the clicks-over-time series (UTC day, YYYY-MM-DD). Every day in range is present, zero-filled. */
export interface TimeseriesPoint {
  date: string;
  count: number;
}

/**
 * GET /api/analytics?code=<optional>&from=<ISO>&to=<ISO>&includeBots=<optional "true">
 * - code omitted  -> totals across all links; code given -> that link only (404 NOT_FOUND if unknown).
 * - from omitted  -> earliest link's createdAt. from earlier than that is clamped up to it.
 * - to omitted    -> now. from > to or unparseable dates -> 400 INVALID_RANGE (ApiErrorCode in api.ts).
 * - bots are excluded from every number unless includeBots=true.
 */
export interface AnalyticsResponse {
  /** Echo of the scope: null = all links. */
  code: string | null;
  /** The effective (clamped) range actually queried, ISO-8601 UTC. */
  range: { from: string; to: string };
  /** createdAt of the first link ever created (minimum selectable `from`); null if no links exist. */
  earliest: string | null;
  totalClicks: number;
  /** ISO 3166-1 alpha-2 country codes; 'XX' when unknown. */
  countries: BreakdownItem[];
  /** Keys are DeviceType values. */
  devices: BreakdownItem[];
  /** e.g. 'Chrome', 'Safari', 'Firefox', 'Edge', 'Other'. */
  browsers: BreakdownItem[];
  /** e.g. 'Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Other'. */
  os: BreakdownItem[];
  /** Referrer hostnames; '(direct)' when no Referer header. Useful for seeing which channel drove clicks. */
  referrers: BreakdownItem[];
  timeseries: TimeseriesPoint[];
}
