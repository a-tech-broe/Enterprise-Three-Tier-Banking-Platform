import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DB_URL });

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      last_login    TIMESTAMPTZ
    );

    -- Heal databases provisioned under an older "users" schema (e.g. one that
    -- shipped a NOT NULL "name" column and no password_hash/last_login). The
    -- CREATE above is a no-op when the table already exists, so repair in place.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login    TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
      ) THEN
        ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS flight_logs (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
      date                 DATE NOT NULL,
      departure            CHAR(4) NOT NULL,
      destination          CHAR(4) NOT NULL,
      aircraft_type        TEXT NOT NULL,
      aircraft_reg         TEXT NOT NULL,
      total_time           NUMERIC(5,1) NOT NULL,
      pic_time             NUMERIC(5,1) DEFAULT 0,
      night_time           NUMERIC(5,1) DEFAULT 0,
      actual_instrument    NUMERIC(5,1) DEFAULT 0,
      simulated_instrument NUMERIC(5,1) DEFAULT 0,
      day_landings         INT DEFAULT 0,
      night_landings       INT DEFAULT 0,
      instrument_approaches INT DEFAULT 0,
      remarks              TEXT,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_flight_logs_user_date ON flight_logs(user_id, date DESC);

    CREATE TABLE IF NOT EXISTS aircraft (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
      registration TEXT NOT NULL,
      make_model   TEXT NOT NULL,
      empty_weight NUMERIC(8,2) NOT NULL,
      empty_cg     NUMERIC(6,2) NOT NULL,
      max_gross    NUMERIC(8,2) NOT NULL,
      stations     JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id    TEXT NOT NULL,
      icao         TEXT NOT NULL,
      search_type  TEXT NOT NULL,
      searched_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_search_history_device
      ON search_history (device_id, search_type, searched_at DESC);

    CREATE TABLE IF NOT EXISTS tracked_airports (
      icao     TEXT PRIMARY KEY,
      added_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS obs_snapshots (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      icao         TEXT NOT NULL,
      captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      flight_rules TEXT NOT NULL,
      raw_metar    TEXT,
      wdir         TEXT,
      wspd         SMALLINT,
      wgst         SMALLINT,
      visib        TEXT,
      temp         NUMERIC(5,1),
      altim        NUMERIC(6,2)
    );
    CREATE INDEX IF NOT EXISTS obs_snapshots_icao_time
      ON obs_snapshots (icao, captured_at DESC);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens (token);
  `);
}
