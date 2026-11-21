import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '../lib/router'

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }

/** A real <a href> that navigates client-side on a plain click, and keeps new-tab / copy-link behaviour otherwise. */
export function AppLink({ to, onClick, target, children, ...rest }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== '_self')
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a {...rest} href={to} target={target} onClick={handleClick}>
      {children}
    </a>
  )
}
