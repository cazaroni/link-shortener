/**
 * Calendar-day helpers. Analytics buckets by UTC day, so every "day" in the UI is a UTC day
 * written as YYYY-MM-DD, and dates are formatted in UTC so a label never drifts by a day.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: string): boolean {
  return DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** Today's UTC day. */
export function todayUtc(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** The UTC day part of an ISO timestamp (or SQLite datetime); null if it doesn't start with one. */
export function dayOf(timestamp: string): string | null {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(timestamp)
  return match && isDay(match[0]) ? match[0] : null
}

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10)
}

const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const shortDayYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const mediumDay = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
const longDay = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' })

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

/** "Mar 3", or "Mar 3, 2026" when the chart spans several years. */
export function formatAxisDay(day: string, withYear: boolean): string {
  return (withYear ? shortDayYear : shortDay).format(utcDate(day))
}

/** "Mar 3, 2026" */
export function formatDay(day: string): string {
  return mediumDay.format(utcDate(day))
}

/** "Tuesday, March 3, 2026" */
export function formatDayLong(day: string): string {
  return longDay.format(utcDate(day))
}

/** "Mar 3 – 30, 2026" (the shortest unambiguous form). */
export function formatDayRange(from: string, to: string): string {
  if (from === to) return formatDay(from)
  return mediumDay.formatRange(utcDate(from), utcDate(to))
}
