# Link Shortener

A small link shortener that runs on Cloudflare Pages. Paste a long URL and get back a short code (for example `/abc123`). Visiting the short link redirects to the original URL and counts the click. A dashboard lets you create links and, in a second tab, see every link with its click count and how many days it has been up.

Unknown or malformed short codes return a real HTTP 404, and the page asks you politely to check your link.

## Tech stack

- **Frontend:** React 19 and TypeScript, built with Vite
- **Backend:** Cloudflare Pages Functions, written in TypeScript
- **Storage:** Cloudflare D1 (SQLite); data survives restarts
- **Tooling:** Wrangler (installed as a project dependency, so run it with `npx wrangler`), oxlint

## Project layout

```
src/          React app (dashboard and "link not found" page)
functions/    Pages Functions
  api/        JSON API: POST/GET /api/links
  [code].ts   Short-link redirect and click counting
  _lib/       Shared server helpers: URL validation, code generation, responses
shared/       API types and constants imported by both frontend and backend
migrations/   D1 schema migrations
wrangler.toml Pages and D1 configuration
```

## Getting started

Requires Node.js 22 or later.

```bash
npm install
npm start
```

`npm start` builds the frontend, applies the database migrations to a local D1 database, and serves the whole app at http://localhost:8788. No Cloudflare account is needed for local development.

### Working on the UI with hot reload

Run these in two terminals:

```bash
npm run db:migrate:local   # first time only
npm run dev:api            # API and functions on :8788
npm run dev                # Vite dev server on :5173, proxies /api to :8788
```

Open http://localhost:5173. Short-link redirects only happen through Wrangler (port 8788), not through the Vite dev server.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Build, migrate the local DB, and serve the full app on :8788 |
| `npm run dev` | Vite dev server for the UI (port 5173) |
| `npm run dev:api` | `wrangler pages dev` for functions and the API (port 8788) |
| `npm run build` | Type-check and build the frontend into `dist/` |
| `npm run lint` | Run oxlint |
| `npm run db:migrate:local` | Apply D1 migrations to the local database |
| `npm run db:migrate:remote` | Apply D1 migrations to the Cloudflare D1 database |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Deploying to Cloudflare

1. `npx wrangler login`
2. `npx wrangler d1 create link-shortener-db`, then copy the printed `database_id` into `wrangler.toml`
3. `npm run db:migrate:remote`
4. `npm run deploy`

## API

| Method and path | Description |
| --- | --- |
| `POST /api/links` | Body `{ "url": "https://…", "alias": "optional" }`. Returns `201 { link }`, or a 4xx error `{ error: { code, message } }` |
| `GET /api/links` | Returns `{ links: [...] }`, newest first |
| `GET /:code` | Redirects with a 302 to the original URL and adds one to its click count; unknown codes return 404 |

The server only accepts `http`/`https` URLs. It rejects URLs that contain credentials, point to localhost or private network addresses, or point back at the shortener itself. Custom aliases must be 3–32 characters from `A–Z a–z 0–9 _ -`, and some names are reserved.
