import { pool } from '../db/pool';
import { aviationWeather } from './aviationWeather';
import { parseFlightRules } from '../utils/flightRules';

const INTERVAL_MS    = 15 * 60 * 1000; // snapshot every 15 minutes
const RETENTION_DAYS = 7;              // purge snapshots older than 7 days

async function collectOnce(): Promise<void> {
  try {
    const { rows } = await pool.query<{ icao: string }>('SELECT icao FROM tracked_airports');
    if (rows.length === 0) return;

    await Promise.allSettled(rows.map(async ({ icao }) => {
      try {
        const metars = await aviationWeather.metar(icao);
        const m = metars[0];
        if (!m?.rawOb) return;
        await pool.query(
          `INSERT INTO obs_snapshots
             (icao, flight_rules, raw_metar, wdir, wspd, wgst, visib, temp, altim)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            icao,
            parseFlightRules(m.rawOb),
            m.rawOb,
            String(m.wdir),
            m.wspd  ?? null,
            m.wgst  ?? null,
            m.visib ?? null,
            m.temp  ?? null,
            m.altim ?? null,
          ]
        );
      } catch { /* individual airport failure is non-fatal */ }
    }));

    // Purge old data to keep the table lean
    await pool.query(
      `DELETE FROM obs_snapshots WHERE captured_at < NOW() - ($1 * INTERVAL '1 day')`,
      [RETENTION_DAYS]
    );
  } catch { /* never crash the server */ }
}

export function startSnapshotCollector(): void {
  collectOnce();
  setInterval(collectOnce, INTERVAL_MS);
}
