-- RealH Postgres schema.
--
-- Applied once per fresh database. Runs idempotently via IF NOT EXISTS so
-- it's safe to execute repeatedly (e.g. in container-entrypoint bootstrap).
--
-- Apply with:
--   psql "$DATABASE_URL" -f packages/server/src/data/postgres.schema.sql
--
-- Schema evolution notes: keep this file as the canonical schema. Once there
-- is more than one version in the wild, add a proper migration tool
-- (node-pg-migrate or Prisma Migrate); do NOT edit tables here in-place.

CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  email                   TEXT NOT NULL,
  is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  human_id                TEXT,
  verified_at             TIMESTAMPTZ,
  verification_provider   TEXT,
  credential_count        INTEGER NOT NULL DEFAULT 0,
  joined_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup by humanId is on the hot path for the public /verify/human endpoint.
-- Partial index to skip un-verified rows outright.
CREATE INDEX IF NOT EXISTS users_verified_humanid_idx
  ON users (human_id)
  WHERE is_verified = TRUE AND human_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS verification_sessions (
  session_id      TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id     TEXT NOT NULL,
  state           JSONB NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ
);

-- Expire pending sessions server-side: a periodic sweep can DELETE FROM
-- verification_sessions WHERE expires_at < NOW() AND status = 'pending'.
CREATE INDEX IF NOT EXISTS verification_sessions_expiry_idx
  ON verification_sessions (expires_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS credentials (
  credential_id   TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  human_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  content_hash    TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credential      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS credentials_user_idx ON credentials (user_id);
CREATE INDEX IF NOT EXISTS credentials_humanid_idx ON credentials (human_id);
