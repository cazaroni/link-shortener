const DAY_MS = 24 * 60 * 60 * 1000

/** SQLite's datetime('now') gives "YYYY-MM-DD HH:MM:SS" (UTC, no zone). Treat it as UTC rather than local time. */
function parseTimestamp(value: string): number {
  const sqlite = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value)
  return Date.parse(sqlite ? `${sqlite[1]}T${sqlite[2]}Z` : value)
}

/** How long a link has existed: "Today" (under a day), "1 day", "N days". */
export function daysUp(createdAt: string, now: number = Date.now()): string {
  const created = parseTimestamp(createdAt)
  if (Number.isNaN(created)) return '—'
  const days = Math.floor((now - created) / DAY_MS)
  if (days < 1) return 'Today'
  if (days === 1) return '1 day'
  return `${days.toLocaleString('en-US')} days`
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Human-readable creation time for tooltips; falls back to the raw value if it can't be parsed. */
export function formatDateTime(value: string): string {
  const time = parseTimestamp(value)
  return Number.isNaN(time) ? value : dateTimeFormat.format(time)
}

/** Returns the URL only if it is http(s), so server data can never end up as a javascript: href. */
export function safeHttpUrl(value: string): string | null {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

/** Splits "https://host/abc" into a de-emphasised "host/" prefix and the code, for display. */
export function splitShortUrl(shortUrl: string, code: string): { prefix: string; code: string } {
  const bare = shortUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  return bare.endsWith(`/${code}`)
    ? { prefix: bare.slice(0, bare.length - code.length), code }
    : { prefix: '', code: bare }
}
