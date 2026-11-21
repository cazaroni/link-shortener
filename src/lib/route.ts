/** The links dashboard lives at "/". (The other app view, "/analytics", is routed in lib/router.ts.) */
export function isDashboardPath(pathname: string): boolean {
  return pathname === '/'
}

/** The short code (or path) a visitor tried, as plain text: "/abc123" -> "abc123", "/foo/bar" -> "foo/bar". */
export function attemptedCode(pathname: string): string {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // Malformed escape sequence: show the raw path instead.
  }
  return decoded.replace(/^\/+|\/+$/g, '')
}
