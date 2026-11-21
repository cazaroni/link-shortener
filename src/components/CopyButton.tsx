import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { CheckIcon, CopyIcon } from './icons'

type CopyState = 'idle' | 'copied' | 'failed'

interface CopyButtonProps {
  text: string
  /** Accessible name, should start with the visible word "Copy". */
  ariaLabel: string
  size?: 'default' | 'small'
  /** Called when the browser refuses to copy, so the caller can select the text for manual copying. */
  onFailure?: () => void
}

const RESET_AFTER_MS = 2200

export function CopyButton({ text, ariaLabel, size = 'default', onFailure }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function handleClick() {
    const ok = await copyText(text)
    if (!ok) onFailure?.()
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), RESET_AFTER_MS)
  }

  const label = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : 'Copy'
  const announcement =
    state === 'copied' ? 'Copied to clipboard.' : state === 'failed' ? "Couldn't copy. Select the link and copy it manually." : ''

  return (
    <>
      <button
        type="button"
        className={`btn btn--secondary copy-btn${size === 'small' ? ' btn--small' : ''}${state === 'copied' ? ' is-copied' : ''}`}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
        <span aria-hidden="true">{label}</span>
      </button>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </>
  )
}
