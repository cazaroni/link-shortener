import type { AnalyticsResponse, BreakdownItem, TimeseriesPoint } from '../../shared/analytics.ts';
import type { Validation } from './validation.ts';

const DAY_MS = 86_400_000;

/** The daily series never covers more days than this (older days are dropped from the start of the range). */
export const MAX_TIMESERIES_DAYS = 366 * 5;

/** Each breakdown returns at most this many buckets (referrers and bot names are attacker-controlled). */
export const MAX_BREAKDOWN_ITEMS = 100;

// ---------------------------------------------------------------------------
// Dates and ranges
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD`, optionally followed by `THH:MM[:SS[.fff]]` and a `Z` / `+hh:mm` offset (none = UTC). */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+\- ]\d{2}:?\d{2})?)?$/i;

/**
 * Strictly parses an ISO-8601 date or timestamp to epoch milliseconds, or null if it isn't one.
 * A date-only value means the whole UTC day: its first millisecond for `start`, its last for `end`.
 * (A space in front of the offset is accepted because "+" in an unencoded query string decodes to one.)
 */
export function parseInstant(input: string, edge: 'start' | 'end'): number | null {
  const match = ISO_INSTANT.exec(input.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction, offset] = match;

  const dateOnly = hour === undefined;
  const parts = {
    hour: dateOnly ? (edge === 'end' ? 23 : 0) : Number(hour),
    minute: dateOnly ? (edge === 'end' ? 59 : 0) : Number(minute),
    second: dateOnly ? (edge === 'end' ? 59 : 0) : Number(second ?? 0),
    ms: dateOnly ? (edge === 'end' ? 999 : 0) : Number(((fraction ?? '') + '000').slice(0, 3)),
  };

  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.ms);
  // Reject values the Date constructor would silently roll over (Feb 30, hour 25, minute 61, ...).
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== parts.hour ||
    date.getUTCMinutes() !== parts.minute ||
    date.getUTCSeconds() !== parts.second
  ) {
    return null;
  }

  let epoch = date.getTime();
  if (offset !== undefined && offset.toUpperCase() !== 'Z') {
    const digits = offset.slice(1).replace(':', '');
    const offsetHours = Number(digits.slice(0, 2));
    const offsetMinutes = Number(digits.slice(2));
    if (offsetHours > 23 || offsetMinutes > 59) return null;
    const offsetMs = (offsetHours * 60 + offsetMinutes) * 60_000;
    epoch += offset.startsWith('-') ? offsetMs : -offsetMs;
  }
  return Number.isFinite(epoch) ? epoch : null;
}

const startOfUtcDay = (epoch: number): number => Math.floor(epoch / DAY_MS) * DAY_MS;

const dayLabel = (epoch: number): string => new Date(epoch).toISOString().slice(0, 10);

export interface ResolvedRange {
  /** Epoch milliseconds, inclusive on both ends. */
  from: number;
  to: number;
}

/**
 * Turns the raw `from` / `to` query values into the range that is actually queried:
 * - `from` defaults to (and is never earlier than) the first link's creation time, `to` defaults to now
 *   and is never in the future;
 * - unparseable dates, `from` after `to`, a range entirely in the future or one that ends before the
 *   first link existed are all INVALID_RANGE;
 * - the range is shortened from the start if it would span more than MAX_TIMESERIES_DAYS days.
 * With no links at all (`earliest` null) there is nothing to clamp against; the range collapses to `to`.
 */
export function resolveRange(
  rawFrom: string | null,
  rawTo: string | null,
  earliest: number | null,
  now: number,
): Validation<ResolvedRange> {
  const invalid = (message: string): { ok: false; code: 'INVALID_RANGE'; message: string } => ({
    ok: false,
    code: 'INVALID_RANGE',
    message,
  });
  const hint = 'Please use a date like 2026-11-01 or a full timestamp like 2026-11-01T09:00:00Z.';

  const requestedFrom = rawFrom === null ? null : parseInstant(rawFrom, 'start');
  if (rawFrom !== null && requestedFrom === null) return invalid(`We couldn't read the start date. ${hint}`);
  const requestedTo = rawTo === null ? null : parseInstant(rawTo, 'end');
  if (rawTo !== null && requestedTo === null) return invalid(`We couldn't read the end date. ${hint}`);

  if (requestedFrom !== null && requestedTo !== null && requestedFrom > requestedTo) {
    return invalid('The start date must be before the end date.');
  }

  const to = Math.min(requestedTo ?? now, now);
  if (earliest === null) return { ok: true, value: { from: to, to } };

  let from = Math.max(requestedFrom ?? earliest, earliest);
  if (from > to) {
    if (requestedFrom === null) {
      from = to; // only possible when the clock of the writer of `created_at` ran slightly ahead
    } else if (requestedFrom > now) {
      return invalid('The start date is in the future. Please choose a date that has already passed.');
    } else {
      return invalid(
        `That date range ends before your first link was created (${dayLabel(earliest)}). Please choose a later end date.`,
      );
    }
  }

  const oldestAllowed = startOfUtcDay(to) - (MAX_TIMESERIES_DAYS - 1) * DAY_MS;
  return { ok: true, value: { from: Math.max(from, oldestAllowed), to } };
}

/** One point per UTC day from `from` to `to` inclusive; days without clicks are zero. */
export function fillTimeseries(from: number, to: number, countsByDay: ReadonlyMap<string, number>): TimeseriesPoint[] {
  const points: TimeseriesPoint[] = [];
  for (let day = startOfUtcDay(from); day <= to; day += DAY_MS) {
    const date = dayLabel(day);
    points.push({ date, count: countsByDay.get(date) ?? 0 });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Link scope for the first lookup: when did the first link appear, and does the requested link exist. */
export async function loadLinkScope(
  db: D1Database,
  code: string | null,
): Promise<{ earliest: string | null; codeExists: boolean }> {
  const statements = [db.prepare('SELECT MIN(created_at) AS earliest FROM links')];
  if (code !== null) statements.push(db.prepare('SELECT 1 AS found FROM links WHERE code = ?').bind(code));

  const [earliestResult, codeResult] = await db.batch(statements);
  const earliest = (earliestResult.results[0] as { earliest: string | null } | undefined)?.earliest ?? null;
  return { earliest, codeExists: code === null || (codeResult?.results.length ?? 0) > 0 };
}

export interface AnalyticsQuery {
  /** null = all links. */
  code: string | null;
  /** ISO-8601 UTC, inclusive. Compared as text, which sorts like time for the fixed-width values we store. */
  from: string;
  to: string;
  includeBots: boolean;
}

/** Whitelisted `clicks` columns that can be broken down (never taken from user input). */
type Dimension = 'country' | 'device_type' | 'browser' | 'os' | 'referrer';

type Counts = Pick<AnalyticsResponse, 'totalClicks' | 'countries' | 'devices' | 'browsers' | 'os' | 'referrers'> & {
  countsByDay: Map<string, number>;
};

/**
 * Totals, breakdowns and per-day counts for one scope and range. All statements run in a single D1
 * batch (one round trip, one consistent snapshot) and use GROUP BY, so the work scales with the
 * number of distinct values, not with the number of clicks returned.
 */
export async function loadCounts(db: D1Database, query: AnalyticsQuery): Promise<Counts> {
  const conditions = ['clicked_at >= ?', 'clicked_at <= ?'];
  const params: (string | number)[] = [query.from, query.to];
  if (query.code !== null) {
    conditions.push('code = ?');
    params.push(query.code);
  }
  if (!query.includeBots) conditions.push('is_bot = 0');
  const where = `WHERE ${conditions.join(' AND ')}`;

  const breakdown = (column: Dimension) =>
    db
      .prepare(
        `SELECT ${column} AS key, COUNT(*) AS count FROM clicks ${where}
         GROUP BY ${column} ORDER BY count DESC, key ASC LIMIT ${MAX_BREAKDOWN_ITEMS}`,
      )
      .bind(...params);

  const [total, countries, devices, browsers, os, referrers, days] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS count FROM clicks ${where}`).bind(...params),
    breakdown('country'),
    breakdown('device_type'),
    breakdown('browser'),
    breakdown('os'),
    breakdown('referrer'),
    db
      .prepare(`SELECT substr(clicked_at, 1, 10) AS day, COUNT(*) AS count FROM clicks ${where} GROUP BY day`)
      .bind(...params),
  ]);

  const items = (result: D1Result): BreakdownItem[] =>
    (result.results as { key: string; count: number }[]).map(({ key, count }) => ({ key, count }));

  return {
    totalClicks: (total.results[0] as { count: number } | undefined)?.count ?? 0,
    countries: items(countries),
    devices: items(devices),
    browsers: items(browsers),
    os: items(os),
    referrers: items(referrers),
    countsByDay: new Map((days.results as { day: string; count: number }[]).map(({ day, count }) => [day, count])),
  };
}
