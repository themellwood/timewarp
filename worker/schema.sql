-- Time Warp — D1 schema.
-- Apply once:
--   wrangler d1 execute timewarp_db --file=schema.sql

CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_id     TEXT    NOT NULL,
  ts          INTEGER NOT NULL,        -- unix seconds (server-stamped)
  stretch     REAL    NOT NULL,        -- clamp(-1..1)
  minutes     INTEGER NOT NULL,        -- felt duration of the last hour
  label       TEXT    NOT NULL,        -- 'Flew by' / 'Dragged' / ...
  tz          TEXT    NOT NULL,        -- IANA timezone
  hemisphere  TEXT    NOT NULL,        -- 'N' | 'S'
  age_bucket  TEXT,                    -- '<18' '18-24' '25-34' ...
  gender      TEXT,                    -- 'woman' 'man' 'non-binary' ...
  interests   TEXT                     -- JSON array of tags
);

CREATE INDEX IF NOT EXISTS idx_ts       ON submissions(ts);
CREATE INDEX IF NOT EXISTS idx_anon_day ON submissions(anon_id, ts);

-- Push subscriptions. One row per device that has opted in. The server
-- uses this to fire Web Push notifications at the user's scheduled times
-- (see the scheduler cron in src/index.ts).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  anon_id        TEXT PRIMARY KEY,
  endpoint       TEXT    NOT NULL,       -- push service URL
  p256dh         TEXT    NOT NULL,       -- base64url ECDH pubkey
  auth           TEXT    NOT NULL,       -- base64url auth secret
  mode           TEXT    NOT NULL,       -- 'daily' | 'hourly'
  wake_start     INTEGER NOT NULL,       -- local hour (0..23)
  wake_end       INTEGER NOT NULL,       -- local hour (1..24)
  tz             TEXT    NOT NULL,       -- IANA tz
  daily_hour     INTEGER,                -- deterministic daily ping hour (0..23)
  daily_minute   INTEGER,                -- deterministic daily ping minute (0..59)
  last_pinged_at INTEGER,                -- unix seconds — last successful push
  last_failed_at INTEGER,                -- unix seconds — last failed push
  fail_count     INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_updated ON push_subscriptions(updated_at);
