import type { Link } from '../../shared/api.ts';
import { generateCode, isReservedCode } from './codes.ts';

interface LinkRow {
  code: string;
  url: string;
  clicks: number;
  created_at: string;
}

/** How many random codes to try before giving up (collisions are astronomically unlikely). */
const MAX_GENERATION_ATTEMPTS = 5;

export function toLink(row: LinkRow, origin: string): Link {
  return {
    code: row.code,
    url: row.url,
    shortUrl: `${origin}/${row.code}`,
    clicks: row.clicks,
    createdAt: row.created_at,
  };
}

/** Every link, newest first (`rowid` breaks ties between links created in the same millisecond). */
export async function listLinks(db: D1Database, origin: string): Promise<Link[]> {
  const { results } = await db
    .prepare('SELECT code, url, clicks, created_at FROM links ORDER BY created_at DESC, rowid DESC')
    .all<LinkRow>();
  return results.map((row) => toLink(row, origin));
}

/** Inserts a link unless the code exists. Returns the row, or null if the code is taken. */
async function insertLink(db: D1Database, code: string, url: string): Promise<LinkRow | null> {
  const createdAt = new Date().toISOString();
  // The primary key makes this race-free: a concurrent insert of the same code changes 0 rows.
  const result = await db
    .prepare('INSERT INTO links (code, url, clicks, created_at) VALUES (?, ?, 0, ?) ON CONFLICT(code) DO NOTHING')
    .bind(code, url, createdAt)
    .run();
  return result.meta.changes > 0 ? { code, url, clicks: 0, created_at: createdAt } : null;
}

export type CreateLinkResult =
  | { status: 'created'; link: Link }
  | { status: 'alias_taken' }
  | { status: 'exhausted' };

/** Creates a link with the given alias, or with a freshly generated code when `alias` is null. */
export async function createLink(
  db: D1Database,
  url: string,
  alias: string | null,
  origin: string,
): Promise<CreateLinkResult> {
  if (alias !== null) {
    const row = await insertLink(db, alias, url);
    return row ? { status: 'created', link: toLink(row, origin) } : { status: 'alias_taken' };
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateCode();
    if (isReservedCode(code)) continue;
    const row = await insertLink(db, code, url);
    if (row) return { status: 'created', link: toLink(row, origin) };
  }
  return { status: 'exhausted' };
}

/** Destination URL for a code, or null if there is no such link. Codes are case-sensitive. */
export async function findDestination(db: D1Database, code: string): Promise<string | null> {
  const row = await db.prepare('SELECT url FROM links WHERE code = ?').bind(code).first<{ url: string }>();
  return row?.url ?? null;
}

/** Atomically bumps the click counter (a single UPDATE, so concurrent clicks are never lost). */
export async function recordClick(db: D1Database, code: string): Promise<void> {
  await db.prepare('UPDATE links SET clicks = clicks + 1 WHERE code = ?').bind(code).run();
}
