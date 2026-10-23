CREATE TABLE IF NOT EXISTS admin_login_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_version INTEGER NOT NULL,
 csrf TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_login_sessions_user ON admin_login_sessions(user_id);
CREATE INDEX IF NOT EXISTS admin_login_sessions_expiry ON admin_login_sessions(expires_at);
