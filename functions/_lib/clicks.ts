import type { DeviceType } from '../../shared/analytics.ts';
import { MAX_USER_AGENT_LENGTH, parseUserAgent } from './useragent.ts';

/** What is stored for one counted click (one row of the `clicks` table). */
export interface ClickDetails {
  clickedAt: string;
  country: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
  referrer: string;
  ip: string | null;
  userAgent: string | null;
  isBot: boolean;
}

export const UNKNOWN_COUNTRY = 'XX';
export const DIRECT_REFERRER = '(direct)';

const MAX_REFERRER_LENGTH = 253; // longest valid hostname

/**
 * Two-letter Cloudflare country value, uppercased: ISO 3166-1 alpha-2, or 'XX' (unknown) /
 * 'T1' (Tor) which Cloudflare also uses. Returns null when the value isn't usable.
 */
export function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const country = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9]$/.test(country) ? country : null;
}

/** True when the app is being served from this machine (`wrangler pages dev`, `vite`), never on a real domain. */
function isLocalDev(request: Request): boolean {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

/**
 * Country of the visitor: Cloudflare's `request.cf.country`, else the `CF-IPCountry` header (which
 * Cloudflare sets itself in production), else 'XX'.
 *
 * `wrangler pages dev` fills `request.cf` with a fixed sample location for every request, so when
 * serving from localhost the header is read first. That lets curl simulate visitors from any
 * country (`-H 'CF-IPCountry: DE'`). On a real domain the header can never override Cloudflare's value.
 */
export function countryOf(request: Request): string {
  const fromCf = normalizeCountry(request.cf?.country);
  const fromHeader = normalizeCountry(request.headers.get('CF-IPCountry'));
  const country = isLocalDev(request) ? (fromHeader ?? fromCf) : (fromCf ?? fromHeader);
  return country ?? UNKNOWN_COUNTRY;
}

/**
 * Hostname of the page that linked here (lowercased, without a leading "www."), or '(direct)' when
 * there is no usable Referer. Paths and queries are deliberately dropped.
 */
export function referrerOf(request: Request): string {
  const header = request.headers.get('Referer');
  if (!header) return DIRECT_REFERRER;
  try {
    const hostname = new URL(header).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return hostname === '' ? DIRECT_REFERRER : hostname.slice(0, MAX_REFERRER_LENGTH);
  } catch {
    return DIRECT_REFERRER;
  }
}

/** Everything we keep about a click, extracted from the incoming request. */
export function describeClick(request: Request, now: Date = new Date()): ClickDetails {
  const userAgent = request.headers.get('User-Agent')?.slice(0, MAX_USER_AGENT_LENGTH) || null;
  const { deviceType, browser, os, isBot } = parseUserAgent(userAgent);
  return {
    clickedAt: now.toISOString(),
    country: countryOf(request),
    deviceType,
    browser,
    os,
    referrer: referrerOf(request),
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent,
    isBot,
  };
}

/**
 * Records one click: bumps the raw `links.clicks` counter and stores the telemetry row in a
 * single D1 batch (one transaction, so the counter and the rows never disagree).
 */
export async function recordClick(db: D1Database, code: string, click: ClickDetails): Promise<void> {
  await db.batch([
    // A single UPDATE, so concurrent clicks are never lost.
    db.prepare('UPDATE links SET clicks = clicks + 1 WHERE code = ?').bind(code),
    db
      .prepare(
        `INSERT INTO clicks (code, clicked_at, country, device_type, browser, os, referrer, ip, user_agent, is_bot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        code,
        click.clickedAt,
        click.country,
        click.deviceType,
        click.browser,
        click.os,
        click.referrer,
        click.ip,
        click.userAgent,
        click.isBot ? 1 : 0,
      ),
  ]);
}

/**
 * Fire-and-forget click tracking for `context.waitUntil`. Never rejects (and never throws
 * synchronously): a telemetry failure must not delay or break the redirect, so it is only logged.
 */
export async function trackClick(db: D1Database, code: string, request: Request): Promise<void> {
  try {
    await recordClick(db, code, describeClick(request));
  } catch (error) {
    console.error(`Failed to record a click for "${code}":`, error);
  }
}
