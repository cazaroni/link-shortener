import type { ApiErrorCode, ApiErrorResponse } from '../../shared/api.ts';

/** HTTP status for each API error code. */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_JSON: 400,
  INVALID_URL: 400,
  UNSAFE_URL: 400,
  URL_TOO_LONG: 400,
  INVALID_ALIAS: 400,
  ALIAS_TAKEN: 409,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL: 500,
};

/** JSON response that is never cached (the data changes with every click). */
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json');
  responseHeaders.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

/** Error response in the shared ApiErrorResponse shape. `message` is shown verbatim in the UI. */
export function apiError(code: ApiErrorCode, message: string, headers?: HeadersInit): Response {
  const body: ApiErrorResponse = { error: { code, message } };
  return json(body, STATUS_BY_CODE[code], headers);
}
