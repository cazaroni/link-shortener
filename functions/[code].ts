import { CODE_PATTERN } from '../shared/api.ts';
import type { Env } from './_lib/env.ts';
import { isReservedCode } from './_lib/codes.ts';
import { trackClick } from './_lib/clicks.ts';
import { findDestination } from './_lib/links.ts';
import { isSafeRedirectTarget } from './_lib/validation.ts';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

/** Small self-contained HTML page, for when the React app's shell can't be used. */
function simplePage(status: number, title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
         font: 16px/1.5 system-ui, sans-serif; color: #1f2933; background: #f7f8fa; text-align: center; }
  a { color: #2563eb; }
  @media (prefers-color-scheme: dark) { body { color: #e5e7eb; background: #111418; } a { color: #8ab4ff; } }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${message}</p>
  <p><a href="/">Go to the home page</a></p>
</main>
</body>
</html>`;
  return new Response(html, { status, headers: HTML_HEADERS });
}

/**
 * A real 404 whose body is the React app's HTML shell, so the SPA can render its own
 * "link not found" page. Falls back to a small static page if the shell can't be loaded.
 */
async function notFound(request: Request, env: Env & { ASSETS: { fetch: typeof fetch } }): Promise<Response> {
  try {
    const shell = await env.ASSETS.fetch(new URL('/', request.url));
    if (shell.ok) {
      return new Response(shell.body, { status: 404, headers: HTML_HEADERS });
    }
    console.error(`Could not load the app shell for the 404 page (status ${shell.status}).`);
  } catch (error) {
    console.error('Could not load the app shell for the 404 page:', error);
  }
  return simplePage(404, 'Link not found', "We couldn't find that short link. Please check the link and try again.");
}

async function handle(context: EventContext<Env, 'code', Record<string, unknown>>): Promise<Response> {
  const { request, env } = context;
  const code = String(context.params.code);

  // Static files at the site root (/favicon.svg, /icons.svg, ...) are served by Pages.
  if (code.includes('.')) return context.next();

  // Names reserved for the app itself (SPA routes etc.) are never short links; let Pages serve them.
  if (isReservedCode(code)) return context.next();

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (!CODE_PATTERN.test(code)) return notFound(request, env);

  const destination = await findDestination(env.DB, code);
  if (destination === null || !isSafeRedirectTarget(destination)) {
    return notFound(request, env);
  }

  // Count after responding so the redirect isn't delayed: the counter bump and the telemetry row
  // are written in one batch, and a failure there is logged but never affects the redirect.
  // HEAD requests (link previews, uptime checks) are answered but not counted.
  if (request.method === 'GET') {
    context.waitUntil(trackClick(env.DB, code, request));
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      // Never cached, so every click reaches this function and is counted.
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/** GET /:code: redirect to the destination and count the click. */
export const onRequest: PagesFunction<Env, 'code'> = async (context) => {
  try {
    return await handle(context);
  } catch (error) {
    console.error(`Unhandled error redirecting ${new URL(context.request.url).pathname}:`, error);
    return simplePage(500, 'Something went wrong', 'Please try again in a moment.');
  }
};
