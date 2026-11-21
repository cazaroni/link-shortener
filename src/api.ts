import type {
  ApiErrorCode,
  ApiErrorResponse,
  CreateLinkRequest,
  CreateLinkResponse,
  Link,
  ListLinksResponse,
} from '../shared/api'

/** Shown when the request can't complete or the reply isn't something we can read. */
export const CONNECTION_ERROR_MESSAGE = "Couldn't reach the server. Please try again."

export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'BAD_RESPONSE'

/** Error thrown by the API client. `message` is always safe to show in the UI. */
export class ApiError extends Error {
  readonly code: ClientErrorCode
  readonly status: number | null

  constructor(message: string, code: ClientErrorCode, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiErrorBody(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) return false
  return typeof value.error.code === 'string' && typeof value.error.message === 'string'
}

function isLink(value: unknown): value is Link {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.url === 'string' &&
    typeof value.shortUrl === 'string' &&
    typeof value.clicks === 'number' &&
    typeof value.createdAt === 'string'
  )
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(CONNECTION_ERROR_MESSAGE, 'NETWORK')
  }

  let body: unknown
  try {
    body = JSON.parse(await response.text())
  } catch {
    // Empty or non-JSON body (proxy error page, HTML fallback, dropped connection...).
    throw new ApiError(CONNECTION_ERROR_MESSAGE, 'BAD_RESPONSE', response.status)
  }

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.message, body.error.code, response.status)
    }
    throw new ApiError('Something went wrong on our side. Please try again.', 'INTERNAL', response.status)
  }
  return body
}

export async function createLink(input: CreateLinkRequest): Promise<Link> {
  const body = await request('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const link = (body as Partial<CreateLinkResponse> | null)?.link
  if (!isLink(link)) throw new ApiError(CONNECTION_ERROR_MESSAGE, 'BAD_RESPONSE')
  return link
}

export async function listLinks(): Promise<Link[]> {
  // no-store: click counts change whenever a short link is opened, so never serve a cached copy.
  const body = await request('/api/links', { cache: 'no-store' })
  const links = (body as Partial<ListLinksResponse> | null)?.links
  if (!Array.isArray(links) || !links.every(isLink)) {
    throw new ApiError(CONNECTION_ERROR_MESSAGE, 'BAD_RESPONSE')
  }
  return links
}
