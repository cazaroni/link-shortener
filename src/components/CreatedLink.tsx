import { useRef } from 'react'
import type { Link } from '../../shared/api'
import { safeHttpUrl } from '../lib/format'
import { CopyButton } from './CopyButton'
import { ExternalIcon } from './icons'

interface CreatedLinkProps {
  link: Link
  onViewLinks: () => void
}

/** Success card shown after a link is created. The short URL sits in a read-only input so it can be selected by hand if copying is blocked. */
export function CreatedLink({ link, onViewLinks }: CreatedLinkProps) {
  const input = useRef<HTMLInputElement>(null)
  const href = safeHttpUrl(link.shortUrl)
  const destination = safeHttpUrl(link.url)

  function selectUrl() {
    input.current?.focus()
    input.current?.select()
  }

  return (
    <section className="result" aria-labelledby={`result-${link.code}`}>
      <h3 className="result-title" id={`result-${link.code}`}>
        Your short link is ready
      </h3>
      <div className="result-row">
        <input
          ref={input}
          className="input result-input"
          type="text"
          readOnly
          value={link.shortUrl}
          aria-label="Short link"
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="result-actions">
          <CopyButton text={link.shortUrl} ariaLabel="Copy short link" onFailure={selectUrl} />
          {href && (
            <a className="btn btn--secondary" href={href} target="_blank" rel="noopener noreferrer">
              <ExternalIcon />
              Open
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
      <p className="result-meta">
        Redirects to{' '}
        {destination ? (
          <a className="url-truncate" href={destination} target="_blank" rel="noopener noreferrer" title={link.url}>
            {link.url}
          </a>
        ) : (
          <span className="url-truncate" title={link.url}>
            {link.url}
          </span>
        )}
      </p>
      <button type="button" className="btn-link" onClick={onViewLinks}>
        View all my links
      </button>
    </section>
  )
}
