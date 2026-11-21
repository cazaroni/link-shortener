import { useId, useRef, useState, type FormEvent } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH, validateLookupCode } from '../lib/validation'

const MAX_SHOWN_LENGTH = 64

interface NotFoundProps {
  /** What the visitor tried to open, without the leading slash. Rendered as text only. */
  attempted: string
}

export function NotFound({ attempted }: NotFoundProps) {
  useDocumentTitle('Link not found – Link Shortener')
  const id = useId()
  const inputId = `${id}-code`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const shown = attempted.length > MAX_SHOWN_LENGTH ? `${attempted.slice(0, MAX_SHOWN_LENGTH)}…` : attempted

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateLookupCode(code)
    if (!result.ok) {
      setError(result.message)
      input.current?.focus()
      return
    }
    setError(null)
    // A full navigation on purpose: the server decides whether this code redirects somewhere.
    window.location.assign(`/${encodeURIComponent(result.value)}`)
  }

  return (
    <section className="card notfound" aria-labelledby={`${id}-heading`}>
      <h1 id={`${id}-heading`}>We couldn&rsquo;t find that link</h1>
      <p className="notfound-text">
        {shown ? (
          <>
            Something went wrong while opening <code className="attempted">{shown}</code>.
          </>
        ) : (
          'Something went wrong while opening that link.'
        )}{' '}
        It may have been mistyped, removed, or never created. Please check the address and try again.
      </p>

      <div className="notfound-actions">
        <a className="btn btn--primary" href="/">
          Go to the dashboard
        </a>
      </div>

      <form className="notfound-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={inputId}>
          Try a different short code
        </label>
        <div className="notfound-row">
          <div className={`input-group${error ? ' is-invalid' : ''}`}>
            <span className="input-prefix" aria-hidden="true">
              {window.location.host}/
            </span>
            <input
              ref={input}
              id={inputId}
              className="input input--bare"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="abc1234"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                if (error) setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            />
          </div>
          <button type="submit" className="btn btn--secondary">
            Open link
          </button>
        </div>
        <p className="field-hint" id={hintId}>
          {ALIAS_MIN_LENGTH}&ndash;{ALIAS_MAX_LENGTH} letters, numbers, hyphens or underscores.
        </p>
        {error && (
          <p className="field-error" id={errorId}>
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
