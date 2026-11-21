import { useCallback, useEffect, useRef, useState } from 'react'
import { listLinks } from '../api'
import type { Link } from '../../shared/api'

export interface LinksState {
  /** null until the first successful load. */
  links: Link[] | null
  /** When `links` was fetched (ms since epoch); the reference time for "days up". */
  loadedAt: number
  /** Message from the most recent failed load, cleared when a new load starts. */
  error: string | null
  /** True while a request is in flight (first load or refresh). */
  fetching: boolean
}

/** Loads the link list on mount and exposes `refresh`. Stale responses are ignored so the newest request wins. */
export function useLinks() {
  const [state, setState] = useState<LinksState>({ links: null, loadedAt: 0, error: null, fetching: true })
  const latestRequest = useRef(0)

  const load = useCallback(() => {
    const requestId = ++latestRequest.current
    const isStale = () => requestId !== latestRequest.current
    return listLinks().then(
      (links) => {
        if (!isStale()) setState({ links, loadedAt: Date.now(), error: null, fetching: false })
      },
      (error: unknown) => {
        if (isStale()) return
        const message = error instanceof Error ? error.message : "Couldn't load your links. Please try again."
        setState((prev) => ({ ...prev, error: message, fetching: false }))
      },
    )
  }, [])

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, fetching: true }))
    return load()
  }, [load])

  // The initial state already says "fetching", so the first load doesn't set state before the request.
  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh }
}
