import { MainNav } from './MainNav'

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-45 16 16)">
        <rect x="3.5" y="10.5" width="15" height="11" rx="5.5" />
        <rect x="13.5" y="10.5" width="15" height="11" rx="5.5" />
      </g>
    </svg>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <a className="brand" href="/">
          <LogoMark />
          Link Shortener
        </a>
        <MainNav />
      </div>
    </header>
  )
}
