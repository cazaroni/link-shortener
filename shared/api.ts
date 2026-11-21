/**
 * Shared API contract between the Cloudflare Pages Functions backend (functions/)
 * and the React frontend (src/). Both sides import from here — change it in one
 * place only, and keep it dependency-free (no DOM or Workers types).
 */

/** Allowed short-code characters and length (used for custom aliases and lookups). */
export const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

/** Length of auto-generated codes. */
export const GENERATED_CODE_LENGTH = 7;

/** Max accepted length of a destination URL. */
export const MAX_URL_LENGTH = 2048;

/**
 * Single-segment, case-sensitive paths that are views of the React app. The server answers them
 * with the app shell and a 200 (every other unknown path is a real 404); the client router must
 * render a view for each one. Also reserved, so they can never be short codes.
 */
export const SPA_ROUTES: readonly string[] = ['analytics'];

/**
 * Single-segment paths that must never be treated as short codes
 * (SPA routes, API prefix, etc.). Aliases matching these (case-insensitive) are rejected.
 */
export const RESERVED_CODES = ['api', ...SPA_ROUTES, 'assets', 'admin', 'dashboard', 'links', 'not-found', 'index', 'static'];

export interface Link {
  code: string;
  /** Destination URL (always http: or https:). */
  url: string;
  /** Absolute short URL, e.g. https://example.pages.dev/abc123 */
  shortUrl: string;
  clicks: number;
  /** ISO-8601 timestamp (UTC). */
  createdAt: string;
}

/** POST /api/links request body. */
export interface CreateLinkRequest {
  url: string;
  /** Optional custom code; must match CODE_PATTERN and not be reserved/taken. */
  alias?: string;
}

/** POST /api/links -> 201 */
export interface CreateLinkResponse {
  link: Link;
}

/** GET /api/links -> 200 (newest first) */
export interface ListLinksResponse {
  links: Link[];
}

export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_URL'
  | 'UNSAFE_URL'
  | 'URL_TOO_LONG'
  | 'INVALID_ALIAS'
  | 'ALIAS_TAKEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_RANGE'
  | 'INTERNAL';

/** Every non-2xx JSON response from /api/* has this shape. */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    /** Human-readable, safe to show directly in the UI. */
    message: string;
  };
}
