-- One row per counted click (GET redirects only), so analytics can slice by time, country,
-- device and referrer. `links.clicks` stays as the cheap raw counter and counts every row here,
-- bots included. Clicks counted before this migration have no row (there is nothing to backfill).
CREATE TABLE clicks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL REFERENCES links (code),
  clicked_at  TEXT NOT NULL,              -- ISO-8601 UTC with milliseconds, e.g. 2026-11-21T09:00:00.000Z
  country     TEXT NOT NULL,              -- ISO 3166-1 alpha-2 from Cloudflare; 'XX' unknown, 'T1' Tor
  device_type TEXT NOT NULL,              -- 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  browser     TEXT NOT NULL,              -- 'Chrome', 'Safari', ... or the crawler's name for bots
  os          TEXT NOT NULL,              -- 'Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Other'
  referrer    TEXT NOT NULL,              -- Referer hostname only; '(direct)' when there is none
  ip          TEXT,                       -- CF-Connecting-IP (raw: acceptable for this prototype only)
  user_agent  TEXT,                       -- truncated raw User-Agent
  is_bot      INTEGER NOT NULL DEFAULT 0  -- 1 = crawler / link-preview fetcher / script
);

-- Per-link analytics over a time range.
CREATE INDEX idx_clicks_code_clicked_at ON clicks (code, clicked_at);
-- Totals across all links over a time range.
CREATE INDEX idx_clicks_clicked_at ON clicks (clicked_at);
