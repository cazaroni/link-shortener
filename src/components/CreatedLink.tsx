import { useRef } from 'react'
import type { Link } from '../../shared/api'
import { safeHttpUrl } from '../lib/format'
import { CopyButton } from './CopyButton'
import { ExternalIcon } from './icons'

interface CreatedLinkProps {
  link: Link
  onViewLinks: () => void
}

/** Success card shown after a link is created. If the browser blocks copying, the short URL gets selected so it can be copied by hand. */
export function CreatedLink({ link, onViewLinks }: CreatedLinkProps) {
  const urlText = useRef<HTMLDivElement>(null)
  const href = safeHttpUrl(link.shortUrl)
  const destination = safeHttpUrl(link.url)

  function selectUrl() {
    const node = urlText.current
    const selection = window.getSelection()
    if (!node || !selection) return
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return (
    <section className="result" aria-labelledby={`result-${link.code}`}>
      <h3 className="result-title" id={`result-${link.code}`}>
        Your short link is ready
      </h3>
      <div className="result-row">
        <div className="result-url" ref={urlText}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${link.shortUrl} (opens in a new tab)`}>
              {link.shortUrl}
            </a>
          ) : (
            link.shortUrl
          )}
        </div>
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
