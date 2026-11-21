import type { Link } from '../../shared/api'
import { daysUp, formatDateTime, safeHttpUrl, splitShortUrl } from '../lib/format'
import { CopyButton } from './CopyButton'
import { RefreshIcon } from './icons'

interface LinksListProps {
  links: Link[] | null
  /** Reference time for "days up" (when the list was fetched). */
  now: number
  error: string | null
  fetching: boolean
  onRefresh: () => void
  onCreateClick: () => void
}

export function LinksList({ links, now, error, fetching, onRefresh, onCreateClick }: LinksListProps) {
  const count = links?.length ?? 0

  return (
    <div className="stack">
      <div className="list-toolbar">
        <p className="list-count" aria-live="polite">
          {links ? `${count.toLocaleString('en-US')} ${count === 1 ? 'link' : 'links'}` : ' '}
        </p>
        <button type="button" className="btn btn--secondary btn--small" onClick={onRefresh} disabled={fetching}>
          <RefreshIcon />
          {fetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert--error alert--with-action" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--small" onClick={onRefresh} disabled={fetching}>
            Retry
          </button>
        </div>
      )}

      {links === null ? (
        !error && (
          <div className="state" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading your links&hellip;
          </div>
        )
      ) : links.length === 0 ? (
        <div className="state state--empty">
          <p className="state-title">No links yet &mdash; create your first one</p>
          <p className="state-text">Short links you create will show up here with their click counts.</p>
          <button type="button" className="btn btn--primary" onClick={onCreateClick}>
            Create a link
          </button>
        </div>
      ) : (
        <LinksTable links={links} now={now} />
      )}
    </div>
  )
}

function LinksTable({ links, now }: { links: Link[]; now: number }) {
  return (
    <div className="table-wrap">
      <table className="links-table">
        <caption className="sr-only">Your short links, newest first</caption>
        <thead>
          <tr>
            <th scope="col" className="col-short">
              Short link
            </th>
            <th scope="col" className="col-url">
              Original URL
            </th>
            <th scope="col" className="col-clicks">
              Clicks
            </th>
            <th scope="col" className="col-age">
              Up for
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <LinkRow key={link.code} link={link} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinkRow({ link, now }: { link: Link; now: number }) {
  const shortHref = safeHttpUrl(link.shortUrl)
  const destination = safeHttpUrl(link.url)
  const { prefix, code } = splitShortUrl(link.shortUrl, link.code)
  const shortLabel = (
    <>
      <span className="short-prefix">{prefix}</span>
      <span className="short-code">{code}</span>
    </>
  )

  return (
    <tr>
      <td className="cell-short">
        <div className="short">
          {shortHref ? (
            <a
              className="short-link"
              href={shortHref}
              target="_blank"
              rel="noopener noreferrer"
              title={link.shortUrl}
              aria-label={`${link.shortUrl} (opens in a new tab)`}
            >
              {shortLabel}
            </a>
          ) : (
            <span className="short-link">{shortLabel}</span>
          )}
          <CopyButton text={link.shortUrl} ariaLabel={`Copy short link ${link.code}`} size="small" />
        </div>
      </td>
      <td className="cell-url" data-label="Original URL">
        {destination ? (
          <a className="url-text" href={destination} target="_blank" rel="noopener noreferrer" title={link.url}>
            {link.url}
          </a>
        ) : (
          <span className="url-text" title={link.url}>
            {link.url}
          </span>
        )}
      </td>
      <td className="cell-clicks" data-label="Clicks">
        {link.clicks.toLocaleString('en-US')}
      </td>
      <td className="cell-age" data-label="Up for">
        <time dateTime={link.createdAt} title={`Created ${formatDateTime(link.createdAt)}`}>
          {daysUp(link.createdAt, now)}
        </time>
      </td>
    </tr>
  )
}
