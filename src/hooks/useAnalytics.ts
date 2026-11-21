import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalyticsResponse } from '../../shared/analytics'
import { ApiError, CONNECTION_ERROR_MESSAGE } from '../api'
import { fetchAnalytics } from '../lib/analyticsApi'

/** Wait for date typing / rapid control changes to settle before hitting the API. */
const DEBOUNCE_MS = 200

export interface UseAnalyticsParams {
  /** False while the controls hold an invalid combination; nothing is fetched. */
  enabled: boolean
  code: string | null
  from: string | null
  to: string | null
  includeBots: boolean
}

interface Settled {
  /** The request this outcome belongs to. */
  key: string
  /** Most recent successful response (kept across errors, so `earliest` survives a failed refetch). */
  data: AnalyticsResponse | null
  error: ApiError | null
}

export interface UseAnalyticsResult {
  /** Latest successful response; may be for an older request while `pending`. */
  data: AnalyticsResponse | null
  /** Error for the current request, if it failed. */
  error: ApiError | null
  /** A request for the current controls is debouncing or in flight. */
  pending: boolean
  retry: () => void
}

/**
 * Loads analytics for the given controls. Changes are debounced, a superseded request is aborted so
 * a slow stale answer can never overwrite a newer one, and the previous data stays available while loading.
 */
export function useAnalytics({ enabled, code, from, to, includeBots }: UseAnalyticsParams): UseAnalyticsResult {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const hasRequested = useRef(false)

  const key = `${attempt}|${code ?? ''}|${from ?? ''}|${to ?? ''}|${includeBots}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    // The first request goes out immediately; later ones wait for the controls to settle.
    const delay = hasRequested.current ? DEBOUNCE_MS : 0
    const timer = window.setTimeout(async () => {
      hasRequested.current = true
      try {
        const data = await fetchAnalytics({ code, from, to, includeBots }, controller.signal)
        if (!controller.signal.aborted) setSettled({ key, data, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        const apiError = error instanceof ApiError ? error : new ApiError(CONNECTION_ERROR_MESSAGE, 'NETWORK')
        setSettled((previous) => ({ key, data: previous?.data ?? null, error: apiError }))
      }
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, key, code, from, to, includeBots])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const current = settled?.key === key
  return {
    data: settled?.data ?? null,
    error: current ? (settled?.error ?? null) : null,
    pending: enabled && !current,
    retry,
  }
}
