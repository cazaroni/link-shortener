import { CODE_PATTERN, MAX_URL_LENGTH } from '../../shared/api.ts';
import type { ApiErrorCode } from '../../shared/api.ts';
import { isReservedCode } from './codes.ts';

export type Validation<T> = { ok: true; value: T } | { ok: false; code: ApiErrorCode; message: string };

const fail = (code: ApiErrorCode, message: string): { ok: false; code: ApiErrorCode; message: string } => ({
  ok: false,
  code,
  message,
});

// ---------------------------------------------------------------------------
// Destination URL
// ---------------------------------------------------------------------------

/** Hostnames that only ever mean "this machine / this network". */
const LOCAL_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

function isPrivateIPv4(octets: readonly number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 ("this network", includes 0.0.0.0)
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 carrier-grade NAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local (cloud metadata lives here)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    a >= 224 // multicast, reserved and broadcast
  );
}

/** Expands a canonical (URL-serialised) IPv6 literal, without brackets, into eight 16-bit groups. */
function parseIPv6(address: string): number[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill('0'), ...tail].map((group) =>
    /^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN,
  );
  return groups.some(Number.isNaN) ? null : groups;
}

function isPrivateIPv6(address: string): boolean {
  const groups = parseIPv6(address);
  if (!groups) return true; // can't make sense of it: don't allow it
  const embeddedIPv4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
  const firstFiveZero = groups.slice(0, 5).every((group) => group === 0);
  return (
    groups.every((group) => group === 0) || // :: (unspecified)
    (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) || // ::1 (loopback)
    (firstFiveZero && (groups[5] === 0xffff || groups[5] === 0) && isPrivateIPv4(embeddedIPv4)) || // IPv4-mapped / -compatible
    (groups[0] === 0x64 && groups[1] === 0xff9b && isPrivateIPv4(embeddedIPv4)) || // NAT64
    (groups[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (groups[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (groups[0] & 0xffc0) === 0xfec0 || // fec0::/10 site-local (deprecated)
    (groups[0] & 0xff00) === 0xff00 // ff00::/8 multicast
  );
}

/**
 * True for hosts that are not on the public internet: localhost, loopback, private,
 * link-local and similar ranges. `hostname` is the already-normalised `URL.hostname`, so
 * tricks like `http://2130706433/` or `http://0x7f.1/` have been turned into `127.0.0.1`.
 *
 * This is about not publishing links that are useless or abusive to share. It is not an
 * SSRF defence: the server never fetches destination URLs, it only redirects browsers.
 */
function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') && host.endsWith(']')) {
    return isPrivateIPv6(host.slice(1, -1));
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    return isPrivateIPv4(ipv4.slice(1).map(Number));
  }
  // Single-label names ("localhost", "intranet", "router") only resolve on a local network.
  if (!host.includes('.')) return true;
  return LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

const normalizeHost = (hostname: string): string => hostname.toLowerCase().replace(/\.$/, '');

/**
 * True if `hostname` is served by this app, so a redirect to it could loop back here: the
 * app's own hostname and, on Cloudflare Pages, every preview/branch alias of the same project
 * (`<anything>.<project>.pages.dev`), which share the same D1 database.
 */
export function isOwnHost(hostname: string, ownHostname: string): boolean {
  const host = normalizeHost(hostname);
  const own = normalizeHost(ownHostname);
  if (host === own) return true;
  const labels = own.split('.');
  if (own.endsWith('.pages.dev') && labels.length >= 3) {
    const project = labels.slice(-3).join('.');
    return host === project || host.endsWith(`.${project}`);
  }
  return false;
}

/**
 * Validates and normalises a destination URL. Returns the normalised `URL.href` on success.
 * `ownHostname` is this app's hostname; links back to it are refused to avoid redirect loops.
 */
export function validateDestinationUrl(input: unknown, ownHostname: string): Validation<string> {
  if (typeof input !== 'string' || input.trim() === '') {
    return fail('INVALID_URL', 'Please enter a web address to shorten.');
  }

  const raw = input.trim();
  const tooLong = fail(
    'URL_TOO_LONG',
    `That web address is too long. Please use one that is ${MAX_URL_LENGTH} characters or fewer.`,
  );
  if (raw.length > MAX_URL_LENGTH) return tooLong;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(
      'INVALID_URL',
      "That doesn't look like a valid web address. Please enter the full link, starting with http:// or https://.",
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('UNSAFE_URL', 'Only web addresses starting with http:// or https:// can be shortened.');
  }
  if (url.username !== '' || url.password !== '') {
    return fail(
      'UNSAFE_URL',
      "Web addresses that contain a username or password can't be shortened. Please remove the login details and try again.",
    );
  }

  const hostname = normalizeHost(url.hostname);
  if (isOwnHost(hostname, ownHostname)) {
    return fail(
      'UNSAFE_URL',
      'That link already points to this site, so shortening it would create a redirect loop. Please enter a different web address.',
    );
  }
  if (isLocalOrPrivateHost(hostname)) {
    return fail(
      'UNSAFE_URL',
      "Links to local or private network addresses can't be shortened. Please enter a public web address.",
    );
  }

  // Normalisation (punycode, percent-encoding) can make the URL longer than what was typed.
  if (url.href.length > MAX_URL_LENGTH) return tooLong;
  return { ok: true, value: url.href };
}

/**
 * Re-checks a stored destination before redirecting to it (defence in depth). With
 * `ownHostname`, destinations served by this app are refused too: a link created on one
 * hostname (e.g. production) can point at another alias of the app and loop.
 */
export function isSafeRedirectTarget(stored: string, ownHostname?: string): boolean {
  try {
    const { protocol, hostname } = new URL(stored);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return ownHostname === undefined || !isOwnHost(hostname, ownHostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Custom alias
// ---------------------------------------------------------------------------

/**
 * Validates an optional custom alias. Missing, null or blank means "generate one" (value: null).
 * Existence is checked separately, against the database.
 */
export function validateAlias(input: unknown): Validation<string | null> {
  if (input === undefined || input === null) return { ok: true, value: null };
  if (typeof input !== 'string') {
    return fail('INVALID_ALIAS', 'The custom alias must be text. Please enter a different alias or leave it blank.');
  }

  const alias = input.trim();
  if (alias === '') return { ok: true, value: null };

  if (!CODE_PATTERN.test(alias)) {
    return fail(
      'INVALID_ALIAS',
      'Custom aliases must be 3 to 32 characters long and can only use letters, numbers, hyphens (-) and underscores (_).',
    );
  }
  if (isReservedCode(alias)) {
    return fail('INVALID_ALIAS', `"${alias}" is reserved by this site. Please choose a different alias.`);
  }
  return { ok: true, value: alias };
}
