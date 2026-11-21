#!/usr/bin/env node
/**
 * Seeds the LOCAL D1 database with sample analytics data so the Analytics tab has something to show.
 *
 *   npm run db:migrate:local   # once, so the `clicks` table exists
 *   npm run db:seed:local      # add clicks (and sample links if there are none)
 *
 * Options (pass after `--`, e.g. `npm run db:seed:local -- --fresh`):
 *   --fresh      first delete ALL local links and clicks, then recreate the sample links
 *   --persist-to <dir>  use that wrangler state directory (the one you pass to `wrangler pages dev --persist-to`)
 *   --seed <n>   random seed (default: time based, so re-runs add different clicks); the same seed
 *                gives the same data, relative to today
 *
 * What it does:
 *   - If the local DB has no links, creates a handful of sample links backdated across the last ~60 days.
 *     Otherwise it only adds clicks to the existing links (never before a link's own creation time).
 *   - Generates a few hundred clicks with varied countries, devices, browsers, OS and referrers, with
 *     weekday patterns, a launch burst and ~6% bots. Device/browser/OS come from the app's own
 *     User-Agent parser (functions/_lib/useragent.ts), so the data matches what the redirect records.
 *   - Bumps links.clicks by the number of rows inserted (bots included, like the real counter), so the
 *     counter and the click rows stay consistent.
 *
 * It only ever touches the local database (`--local`); it cannot reach the remote one.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { fresh: false, seed: Date.now() % 2 ** 31, persistTo: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fresh') options.fresh = true;
    else if (arg === '--seed') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) fail('--seed needs a positive whole number.');
      options.seed = value;
    } else if (arg === '--persist-to') {
      if (!argv[i + 1]) fail('--persist-to needs a directory.');
      options.persistTo = resolve(argv[++i]);
    } else fail(`Unknown option "${arg}". Options: --fresh, --seed <n>, --persist-to <dir>.`);
  }
  return options;
}

function fail(message) {
  console.error(`seed-analytics: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// wrangler (always --local)
// ---------------------------------------------------------------------------

/** State directory given with --persist-to (absolute), or null for wrangler's default `.wrangler/state`. */
let persistTo = null;

function wrangler(args) {
  const persist = persistTo ? ['--persist-to', persistTo] : [];
  return execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Runs one query and returns its rows. */
function query(sql) {
  const output = wrangler(['--json', '--command', sql]);
  return JSON.parse(output)[0].results;
}

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a key from `{ key: weight }`. */
function pick(weights, random) {
  const entries = Object.entries(weights);
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

function poisson(lambda, random) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(random)));
  const limit = Math.exp(-lambda);
  let count = 0;
  for (let product = random(); product > limit; product *= random()) count++;
  return count;
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

/** Each link has its own audience, so per-link analytics differ from the totals. */
const SAMPLE_LINKS = [
  {
    code: 'launch-post',
    url: 'https://example.com/blog/launching-our-community-hub',
    daysAgo: 58,
    rate: 3.2,
    launchBoost: 5,
    referrers: { 'twitter.com': 36, 't.co': 10, 'news.ycombinator.com': 9, 'reddit.com': 11, 'linkedin.com': 10, '(direct)': 24 },
    countries: { US: 34, GB: 10, DE: 8, IN: 11, CA: 6, BR: 5, FR: 5, AU: 4, NL: 3, JP: 3, XX: 1 },
  },
  {
    code: 'discord-invite',
    url: 'https://example.com/community/join',
    daysAgo: 44,
    rate: 2.6,
    spike: { daysAgo: 20, factor: 5 },
    referrers: { 'discord.com': 56, '(direct)': 18, 'reddit.com': 10, 'twitter.com': 9, 'youtube.com': 7 },
    countries: { US: 28, BR: 14, MX: 8, GB: 8, ES: 6, DE: 6, PH: 6, CA: 5, AR: 4, PL: 3, T1: 1, XX: 1 },
  },
  {
    code: 'weekly-news',
    url: 'https://example.com/newsletter/archive',
    daysAgo: 31,
    rate: 1.7,
    referrers: { '(direct)': 58, 'mail.google.com': 16, 'outlook.live.com': 8, 'linkedin.com': 10, 'substack.com': 8 },
    countries: { US: 40, GB: 14, CA: 8, AU: 7, DE: 6, NL: 5, SE: 4, IE: 3, SG: 3, XX: 1 },
  },
  {
    code: 'yt-demo',
    url: 'https://example.com/videos/product-demo',
    daysAgo: 22,
    rate: 2.3,
    referrers: { 'youtube.com': 62, '(direct)': 14, 'twitter.com': 10, 'facebook.com': 9, 'instagram.com': 5 },
    countries: { US: 26, IN: 16, BR: 9, ID: 7, GB: 7, MX: 6, DE: 5, TR: 4, JP: 4, KR: 3, VN: 3, XX: 1 },
  },
  {
    code: 'docs-start',
    url: 'https://example.com/docs/getting-started',
    daysAgo: 13,
    rate: 1.5,
    referrers: { 'github.com': 34, 'google.com': 26, '(direct)': 22, 'stackoverflow.com': 10, 'news.ycombinator.com': 8 },
    countries: { US: 30, DE: 12, IN: 12, GB: 9, FR: 7, CA: 6, NL: 5, PL: 4, UA: 3, XX: 1 },
  },
  {
    code: 'press-kit',
    url: 'https://example.com/press/media-kit',
    daysAgo: 6,
    rate: 0.9,
    referrers: { '(direct)': 50, 'linkedin.com': 24, 'twitter.com': 16, 'techcrunch.com': 10 },
    countries: { US: 44, GB: 14, DE: 9, FR: 7, CA: 6, AU: 5, JP: 4, XX: 1 },
  },
];

/** Real-world User-Agent strings and how common they are among human visitors. */
const BROWSER_UAS = [
  [22, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'],
  [4, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'],
  [3, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.9.100 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 646000000)'],
  [11, 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36'],
  [9, 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36'],
  [4, 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'],
  [1, 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'],
  [3, 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'],
  [2, 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'],
  [16, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'],
  [7, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'],
  [3, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'],
  [1, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0'],
  [7, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'],
  [6, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'],
  [1, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0'],
  [2, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'],
  [2, 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'],
  [1, 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'],
];

/** Crawlers, link-preview fetchers and scripts: about 6% of all clicks. */
const BOT_UAS = [
  [4, 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
  [3, 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  [3, 'Twitterbot/1.0'],
  [2, 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  [2, 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  [1, 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  [1, 'WhatsApp/2.24.20.85 A'],
  [1, 'curl/8.5.0'],
  [1, 'python-requests/2.32.3'],
  [1, 'Go-http-client/2.0'],
  [1, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36'],
  [1, 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
];
const BOT_SHARE = 0.06;
const BOT_COUNTRIES = { US: 50, DE: 15, IE: 10, SG: 10, NL: 8, FR: 7 };

/** Relative traffic per UTC hour: quiet at night, busy in the evening. */
const HOUR_WEIGHTS = Object.fromEntries(
  [1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 8, 8, 8, 9, 10, 11, 11, 10, 7, 4, 2].map((weight, hour) => [hour, weight]),
);

/** `[[weight, value], ...]` -> `{ index: weight }` for `pick`. */
const weighted = (entries) => Object.fromEntries(entries.map(([weight], index) => [index, weight]));

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function randomIp(random) {
  const prefix = ['203.0.113', '198.51.100', '192.0.2'][Math.floor(random() * 3)]; // documentation ranges
  return `${prefix}.${1 + Math.floor(random() * 254)}`;
}

function describeVisitor(link, random, parseUserAgent) {
  const isBot = random() < BOT_SHARE;
  const pool = isBot ? BOT_UAS : BROWSER_UAS;
  const userAgent = pool[Number(pick(weighted(pool), random))][1];
  const { deviceType, browser, os, isBot: parsedBot } = parseUserAgent(userAgent);
  return {
    country: pick(isBot ? BOT_COUNTRIES : link.countries, random),
    deviceType,
    browser,
    os,
    isBot: parsedBot,
    referrer: isBot ? '(direct)' : pick(link.referrers, random),
    ip: randomIp(random),
    userAgent,
  };
}

/** Expected clicks on a day: weekday rhythm, a decaying launch burst and an optional one-off spike. */
function dailyRate(link, dayStart, now) {
  const created = Date.parse(link.created_at);
  const ageDays = (dayStart - created) / DAY_MS;
  const weekday = new Date(dayStart).getUTCDay();
  const weekdayFactor = weekday === 0 ? 0.75 : weekday === 6 ? 0.7 : 1;
  const boost = 1 + (link.launchBoost ?? 2) * Math.exp(-Math.max(ageDays, 0) / 3);
  const spikeDay = link.spike ? Math.floor((now - link.spike.daysAgo * DAY_MS) / DAY_MS) * DAY_MS : null;
  const spike = spikeDay === dayStart ? link.spike.factor : 1;
  return link.rate * weekdayFactor * boost * spike * 0.9; // tuned so the default sample lands at roughly 450 clicks
}

function generateClicks(links, now, random, parseUserAgent) {
  const clicks = [];
  for (const link of links) {
    const created = Date.parse(link.created_at);
    for (let day = Math.floor(created / DAY_MS) * DAY_MS; day <= now; day += DAY_MS) {
      const count = poisson(dailyRate(link, day, now), random);
      for (let n = 0; n < count; n++) {
        const timestamp = day + (Number(pick(HOUR_WEIGHTS, random)) + random()) * 3_600_000;
        if (timestamp < created || timestamp > now) continue; // not before the link existed, not in the future
        clicks.push({ code: link.code, clickedAt: new Date(timestamp).toISOString(), ...describeVisitor(link, random, parseUserAgent) });
      }
    }
  }
  return clicks.sort((a, b) => (a.clickedAt < b.clickedAt ? -1 : a.clickedAt > b.clickedAt ? 1 : 0));
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const sql = (value) => (value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`);

function buildSql({ fresh, newLinks, clicks }) {
  const lines = [];
  if (fresh) lines.push('DELETE FROM clicks;', 'DELETE FROM links;');

  for (const link of newLinks) {
    lines.push(
      `INSERT INTO links (code, url, clicks, created_at) VALUES (${sql(link.code)}, ${sql(link.url)}, 0, ${sql(link.created_at)});`,
    );
  }

  const COLUMNS = 'code, clicked_at, country, device_type, browser, os, referrer, ip, user_agent, is_bot';
  for (let i = 0; i < clicks.length; i += 50) {
    const rows = clicks.slice(i, i + 50).map(
      (c) =>
        `(${[c.code, c.clickedAt, c.country, c.deviceType, c.browser, c.os, c.referrer, c.ip, c.userAgent].map(sql).join(', ')}, ${c.isBot ? 1 : 0})`,
    );
    lines.push(`INSERT INTO clicks (${COLUMNS}) VALUES\n${rows.join(',\n')};`);
  }

  const perCode = new Map();
  for (const click of clicks) perCode.set(click.code, (perCode.get(click.code) ?? 0) + 1);
  for (const [code, count] of perCode) {
    lines.push(`UPDATE links SET clicks = clicks + ${count} WHERE code = ${sql(code)};`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadParser() {
  try {
    return (await import('../functions/_lib/useragent.ts')).parseUserAgent;
  } catch (error) {
    fail(
      `Could not load the User-Agent parser (${error.message}). This script imports TypeScript directly, ` +
        'which needs Node 22.18 or newer.',
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  persistTo = options.persistTo;
  const parseUserAgent = await loadParser();
  const random = mulberry32(options.seed);
  console.log(`Using random seed ${options.seed}.`);
  const now = Date.now();

  try {
    query('SELECT 1 FROM clicks LIMIT 1');
  } catch {
    fail('The local database has no `clicks` table. Run `npm run db:migrate:local` first.');
  }

  let links = options.fresh ? [] : query('SELECT code, created_at FROM links ORDER BY created_at');
  const newLinks = [];
  if (links.length === 0) {
    for (const sample of SAMPLE_LINKS) {
      newLinks.push({
        ...sample,
        created_at: new Date(now - sample.daysAgo * DAY_MS - random() * 6 * 3_600_000).toISOString(),
      });
    }
    links = newLinks;
  } else {
    // Existing links keep their codes and creation times; give each a plausible audience.
    links = links.map((link, index) => ({ ...SAMPLE_LINKS[index % SAMPLE_LINKS.length], ...link }));
  }

  const clicks = generateClicks(links, now, random, parseUserAgent);
  if (clicks.length === 0) {
    console.log('No clicks generated: the existing links are too new. Re-run with --fresh to start from sample links.');
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'seed-analytics-'));
  try {
    const file = join(dir, 'seed.sql');
    writeFileSync(file, buildSql({ fresh: options.fresh, newLinks, clicks }));
    wrangler(['--file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const bots = clicks.filter((click) => click.isBot).length;
  console.log(
    `Seeded ${clicks.length} clicks (${bots} bots) across ${links.length} links` +
      `${newLinks.length ? ` (${newLinks.length} new sample links)` : ''}, ${clicks[0].clickedAt.slice(0, 10)} to ${clicks.at(-1).clickedAt.slice(0, 10)}.`,
  );

  const rows = query(
    'SELECT l.code, l.clicks AS counter, (SELECT COUNT(*) FROM clicks c WHERE c.code = l.code) AS stored FROM links l ORDER BY l.created_at',
  );
  console.table(rows);
  const drift = rows.filter((row) => row.counter !== row.stored);
  if (drift.length > 0) {
    console.log(
      `Note: ${drift.map((row) => row.code).join(', ')} had clicks counted before click rows were stored, ` +
        'so counter and rows differ. `--fresh` resets everything.',
    );
  }
}

main().catch((error) => fail(error.stderr?.toString().trim() || error.message));
