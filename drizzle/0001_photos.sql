-- Profile photos stored in D1 when no R2 bucket is bound (max 400 KB per photo, enforced by the API).
CREATE TABLE IF NOT EXISTS photos (
  key TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
