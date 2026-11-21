import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.25A1.25 1.25 0 0 0 9.25 2h-6A1.25 1.25 0 0 0 2 3.25v6A1.25 1.25 0 0 0 3.25 10.5h.25" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Svg>
  )
}

export function ExternalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v2.75a1.25 1.25 0 0 1-1.25 1.25h-6.5A1.25 1.25 0 0 1 2.5 12.25v-6.5A1.25 1.25 0 0 1 3.75 4.5H6.5" />
    </Svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" />
    </Svg>
  )
}
