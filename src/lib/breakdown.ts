import type { BreakdownItem } from '../../shared/analytics'

export interface BarRow {
  key: string
  label: string
  count: number
  /** Share of the breakdown's total, 0-1. */
  share: number
  /** Set on the "Other" rollup row, e.g. "5 more" (shown in the tooltip). */
  detail?: string
  isOther?: boolean
}

export interface RollupOptions {
  /** Max rows before the tail is folded into "Other". */
  limit?: number
  /** Turns a key into display text. */
  labelFor?: (key: string) => string
  /** A key the data already uses for "everything unrecognised" (e.g. 'Other' for browsers); folded into the rollup. */
  otherKey?: string
}

export const DEFAULT_LIMIT = 8

/**
 * Prepares a breakdown for a ranked bar list: keeps the top rows and folds the long tail into one "Other" row.
 * A tail of a single row is not worth hiding, so the fold only happens when it would hide two or more.
 */
export function toBarRows(items: readonly BreakdownItem[], options: RollupOptions = {}): BarRow[] {
  const { limit = DEFAULT_LIMIT, labelFor = (key) => key, otherKey } = options
  const positive = items.filter((item) => item.count > 0)
  const total = positive.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return []

  const ranked = positive.filter((item) => item.key !== otherKey).sort((a, b) => b.count - a.count)
  const existingOther = positive.find((item) => item.key === otherKey)

  const head = ranked.length > limit + 1 ? ranked.slice(0, limit) : ranked
  const tail = ranked.slice(head.length)

  const rows: BarRow[] = head.map((item) => ({
    key: item.key,
    label: labelFor(item.key),
    count: item.count,
    share: item.count / total,
  }))

  const otherCount = tail.reduce((sum, item) => sum + item.count, 0) + (existingOther?.count ?? 0)
  if (otherCount > 0) {
    rows.push({
      key: otherKey ?? '__other__',
      label: 'Other',
      count: otherCount,
      share: otherCount / total,
      detail: tail.length > 0 ? `${tail.length + (existingOther ? 1 : 0)} more` : undefined,
      isOther: true,
    })
  }
  return rows
}

/** "42%", or "<1%" when a non-zero share would round down to nothing. */
export function formatShare(share: number): string {
  const percent = share * 100
  if (percent > 0 && percent < 1) return '<1%'
  return `${Math.round(percent)}%`
}

const countFormat = new Intl.NumberFormat()

export function formatCount(count: number): string {
  return countFormat.format(count)
}

export function clicksLabel(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'click' : 'clicks'}`
}

// --- labels -----------------------------------------------------------------

let regionNames: Intl.DisplayNames | null | undefined

/** 'US' -> "United States". 'XX' (and anything the browser can't name) is handled gracefully. */
export function countryName(code: string): string {
  const upper = code.toUpperCase()
  if (upper === 'XX' || upper === '') return 'Unknown'
  if (upper === 'T1') return 'Tor network'
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(undefined, { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  try {
    return regionNames?.of(upper) ?? upper
  } catch {
    return upper
  }
}

const DEVICE_NAMES: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
  bot: 'Bot',
  unknown: 'Unknown',
}

export function deviceName(key: string): string {
  return DEVICE_NAMES[key] ?? key
}

/** '(direct)' is the API's placeholder for "no Referer header". */
export function referrerName(key: string): string {
  return key === '(direct)' ? 'Direct / none' : key
}
