import { addDays, formatDay, isDay } from './dates'

export type RangePreset = '7d' | '30d' | 'all' | 'custom'

export const PRESETS: readonly { id: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
]

export interface RangeSelection {
  preset: RangePreset
  /** Only used when preset is 'custom'. YYYY-MM-DD or ''. */
  from: string
  to: string
}

export interface ResolvedRange {
  /** What the date inputs show ('' = empty). */
  displayFrom: string
  displayTo: string
  /** What is sent to the API (null = let the server default). */
  requestFrom: string | null
  requestTo: string | null
  /** Set when the range can't be queried; analytics is not fetched. */
  error: string | null
  /** Gentle corrections applied to the request (clamping), shown as a hint. */
  notes: string[]
}

/**
 * Turns the selected preset or typed dates into the displayed values and the request, applying the same
 * bounds as the date inputs: nothing before the first link, nothing after today. Typed values are shown
 * as typed (never rewritten mid-keystroke); only the request is clamped.
 */
export function resolveRange(
  selection: RangeSelection,
  today: string,
  earliest: string | null,
  /** First day of the selected link (its creation day); null when viewing all links or not yet known. */
  scopeStart: string | null = null,
): ResolvedRange {
  let displayFrom: string
  let displayTo: string
  switch (selection.preset) {
    case '7d':
      displayFrom = addDays(today, -6)
      displayTo = today
      break
    case '30d':
      displayFrom = addDays(today, -29)
      displayTo = today
      break
    case 'all':
      displayFrom = scopeStart ?? earliest ?? ''
      displayTo = today
      break
    case 'custom':
      displayFrom = isDay(selection.from) ? selection.from : ''
      displayTo = isDay(selection.to) ? selection.to : ''
      break
  }

  const result: ResolvedRange = {
    displayFrom,
    displayTo,
    requestFrom: null,
    requestTo: null,
    error: null,
    notes: [],
  }

  // "All time" = from the first link (or the selected link's creation day) until now. Without a link
  // the server picks both ends itself.
  if (selection.preset === 'all') {
    result.requestFrom = scopeStart
    return result
  }

  let from = displayFrom
  let to = displayTo

  if (from && to && from > to) {
    result.error = 'The start date must be on or before the end date.'
    return result
  }
  if (from && from > today) {
    result.error = 'The start date can’t be in the future.'
    return result
  }
  if (to && to > today) {
    result.notes.push('The end date can’t be in the future, so results run through today.')
    to = today
  }
  if (from && earliest && from < earliest) {
    result.notes.push(`There’s no data before ${formatDay(earliest)}, when your first link was created, so results start there.`)
    from = earliest
  }
  if (from && to && from > to) {
    result.error = earliest
      ? `There’s no data before ${formatDay(earliest)}, when your first link was created. Choose a later end date.`
      : 'The start date must be on or before the end date.'
    result.notes = []
    return result
  }

  result.requestFrom = from || null
  result.requestTo = to || null
  return result
}
