import { CODE_PATTERN, MAX_URL_LENGTH, RESERVED_CODES } from '../../shared/api'

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string }

/** Mirrors the {3,32} in CODE_PATTERN; only used to word the messages. CODE_PATTERN stays the source of truth. */
export const ALIAS_MIN_LENGTH = 3
export const ALIAS_MAX_LENGTH = 32

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
/** "example.com:8080/path" looks like a scheme to HAS_SCHEME but is a host and port. */
const HOST_WITH_PORT = /^[^/?#:@\s]+:\d+(?:[/?#]|$)/

const TOO_LONG = `That URL is too long. The limit is ${MAX_URL_LENGTH.toLocaleString('en-US')} characters.`

/**
 * Validates the destination URL and returns the string to send to the server.
 * A missing scheme ("example.com") gets https:// prepended; only http(s) is allowed.
 */
export function normalizeUrl(raw: string): Validation<string> {
  const input = raw.trim()
  if (!input) return fail('Enter the URL you want to shorten.')
  if (input.length > MAX_URL_LENGTH) return fail(TOO_LONG)
  if (/\s/.test(input)) return fail("URLs can't contain spaces. Check that you pasted just one link.")

  let candidate: string
  if (input.startsWith('//')) {
    candidate = `https:${input}`
  } else if (HAS_SCHEME.test(input) && !HOST_WITH_PORT.test(input)) {
    candidate = input
  } else {
    candidate = `https://${input}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return fail("That doesn't look like a valid URL. Try something like https://example.com/page.")
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail('Only http:// and https:// links can be shortened.')
  }
  if (!parsed.hostname.includes('.') && !parsed.hostname.startsWith('[')) {
    return fail('Enter a full web address, such as example.com.')
  }
  if (candidate.length > MAX_URL_LENGTH) return fail(TOO_LONG)

  return { ok: true, value: candidate }
}

function isReserved(code: string): boolean {
  return RESERVED_CODES.includes(code.toLowerCase())
}

/** Validates the optional custom alias. An empty alias is valid and resolves to undefined. */
export function validateAlias(raw: string): Validation<string | undefined> {
  const alias = raw.trim()
  if (!alias) return { ok: true, value: undefined }
  if (alias.length < ALIAS_MIN_LENGTH) return fail(`Alias must be at least ${ALIAS_MIN_LENGTH} characters.`)
  if (alias.length > ALIAS_MAX_LENGTH) return fail(`Alias can be at most ${ALIAS_MAX_LENGTH} characters.`)
  if (!CODE_PATTERN.test(alias)) return fail('Use only letters, numbers, hyphens (-) and underscores (_).')
  if (isReserved(alias)) return fail(`"${alias}" is reserved. Please choose a different alias.`)
  return { ok: true, value: alias }
}

/** Validates a short code someone typed in to look up (used on the "link not found" page). */
export function validateLookupCode(raw: string): Validation<string> {
  const code = raw.trim()
  if (!code) return fail('Enter the short code you want to open.')
  if (!CODE_PATTERN.test(code)) {
    return fail(
      `Codes are ${ALIAS_MIN_LENGTH}-${ALIAS_MAX_LENGTH} characters long and use only letters, numbers, hyphens and underscores.`,
    )
  }
  if (isReserved(code)) return fail("That isn't a short link code. Check the link and try again.")
  return { ok: true, value: code }
}
