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
