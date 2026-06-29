-- LocalEscape — Postgres schema. Run once against your DATABASE_URL.
-- psql "$DATABASE_URL" -f src/db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT ('u_' || gen_random_uuid()),
  handle        TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- whole-app data blob per user (cross-device sync)
CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blob       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shared "roam together" plans + RSVPs
CREATE TABLE IF NOT EXISTS shared_plans (
  id         TEXT PRIMARY KEY DEFAULT ('p_' || gen_random_uuid()),
  title      TEXT NOT NULL,
  items      JSONB NOT NULL DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plan_rsvps (
  plan_id TEXT NOT NULL REFERENCES shared_plans(id) ON DELETE CASCADE,
  who     TEXT NOT NULL,
  PRIMARY KEY (plan_id, who)
);

CREATE TABLE IF NOT EXISTS calendar_items (
  id      TEXT PRIMARY KEY DEFAULT ('c_' || gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title   TEXT NOT NULL,
  sub     TEXT,
  type    TEXT,                       -- plan | big | event | group
  date    DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_user_date ON calendar_items(user_id, date);

-- AI-generated, community-owned events (not created by any organisation)
CREATE TABLE IF NOT EXISTS community_events (
  id         TEXT PRIMARY KEY DEFAULT ('m_' || gen_random_uuid()),
  title      TEXT NOT NULL,
  venue      TEXT,
  starts_at  TIMESTAMPTZ NOT NULL,
  vibe       TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rsvps (
  event_id TEXT NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Cache of provider results (maps/stays/events/social) to cut API cost & latency
CREATE TABLE IF NOT EXISTS provider_cache (
  key        TEXT PRIMARY KEY,        -- e.g. 'maps:trail:nature:surrey'
  payload    JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
