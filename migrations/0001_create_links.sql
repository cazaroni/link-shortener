-- Short links. `code` is the public short code (case-sensitive) and the primary key,
-- so uniqueness is enforced by the database even under concurrent inserts.
CREATE TABLE links (
  code       TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  clicks     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL -- ISO-8601 UTC, e.g. 2026-11-21T09:00:00.000Z
);

-- Supports "newest first" listing.
CREATE INDEX idx_links_created_at ON links (created_at);
