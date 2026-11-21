import type { CreateLinkResponse, ListLinksResponse } from '../../shared/api.ts';
import type { Env } from '../_lib/env.ts';
import { apiError, json } from '../_lib/http.ts';
import { createLink, listLinks } from '../_lib/links.ts';
import { validateAlias, validateDestinationUrl } from '../_lib/validation.ts';

const ALLOWED_METHODS = 'GET, HEAD, POST';

/** GET /api/links: every link, newest first. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const body: ListLinksResponse = { links: await listLinks(env.DB, new URL(request.url).origin) };
  return json(body);
};

/** POST /api/links: create a short link from { url, alias? }. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_JSON', 'We couldn\'t read that request. Please send valid JSON, like {"url": "https://example.com"}.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return apiError('INVALID_JSON', 'The request must be a JSON object, like {"url": "https://example.com"}.');
  }
  const { url: rawUrl, alias: rawAlias } = body as Record<string, unknown>;

  const { origin, hostname } = new URL(request.url);

  const url = validateDestinationUrl(rawUrl, hostname);
  if (!url.ok) return apiError(url.code, url.message);

  const alias = validateAlias(rawAlias);
  if (!alias.ok) return apiError(alias.code, alias.message);

  const result = await createLink(env.DB, url.value, alias.value, origin);
  switch (result.status) {
    case 'created': {
      const response: CreateLinkResponse = { link: result.link };
      return json(response, 201);
    }
    case 'alias_taken':
      return apiError('ALIAS_TAKEN', `The alias "${alias.value}" is already taken. Please choose a different one.`);
    case 'exhausted':
      // Practically unreachable; surfaced as a retryable server error rather than a validation error.
      console.error('Could not generate a unique short code after several attempts.');
      return apiError('INTERNAL', "We couldn't create your short link just now. Please try again.");
  }
};

/** Everything else on /api/links. HEAD is answered like GET (the runtime drops the body). */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'HEAD') {
    return onRequestGet(context);
  }
  return apiError('METHOD_NOT_ALLOWED', 'That request method is not supported here. Use GET to list links or POST to create one.', {
    Allow: ALLOWED_METHODS,
  });
};
