PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor')),
 must_change INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('cafe','store','event')),
 slug TEXT NOT NULL, name TEXT NOT NULL, country_code TEXT NOT NULL DEFAULT 'JP',
 prefecture TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
 publication TEXT NOT NULL DEFAULT 'pending' CHECK(publication IN ('pending','public','private','deleted')),
 status TEXT NOT NULL DEFAULT 'unknown', store_id TEXT REFERENCES records(id),
 payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(kind,slug)
);
CREATE TABLE IF NOT EXISTS submissions (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 record_id TEXT REFERENCES records(id), revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS outbox (
 id INTEGER PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY, actor INTEGER, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS records_public ON records(kind,publication,status);
CREATE UNIQUE INDEX IF NOT EXISTS records_place_slug ON records(slug) WHERE kind IN ('cafe','store');
CREATE INDEX IF NOT EXISTS submissions_status ON submissions(status,created_at);
