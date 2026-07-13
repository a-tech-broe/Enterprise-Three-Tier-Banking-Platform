"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initDb = initDb;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({ connectionString: process.env.DB_URL });
async function initDb() {
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      last_login    TIMESTAMPTZ
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
