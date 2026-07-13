"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSnapshotCollector = startSnapshotCollector;
const pool_1 = require("../db/pool");
const aviationWeather_1 = require("./aviationWeather");
const flightRules_1 = require("../utils/flightRules");
const INTERVAL_MS = 15 * 60 * 1000; // snapshot every 15 minutes
const RETENTION_DAYS = 7; // purge snapshots older than 7 days
async function collectOnce() {
    try {
        const { rows } = await pool_1.pool.query('SELECT icao FROM tracked_airports');
        if (rows.length === 0)
            return;
        await Promise.allSettled(rows.map(async ({ icao }) => {
            try {
                const metars = await aviationWeather_1.aviationWeather.metar(icao);
                const m = metars[0];
                if (!m?.rawOb)
                    return;
                await pool_1.pool.query(`INSERT INTO obs_snapshots
             (icao, flight_rules, raw_metar, wdir, wspd, wgst, visib, temp, altim)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
                    icao,
                    (0, flightRules_1.parseFlightRules)(m.rawOb),
                    m.rawOb,
                    String(m.wdir),
                    m.wspd ?? null,
                    m.wgst ?? null,
                    m.visib ?? null,
                    m.temp ?? null,
                    m.altim ?? null,
                ]);
            }
            catch { /* individual airport failure is non-fatal */ }
        }));
        // Purge old data to keep the table lean
        await pool_1.pool.query(`DELETE FROM obs_snapshots WHERE captured_at < NOW() - ($1 * INTERVAL '1 day')`, [RETENTION_DAYS]);
    }
    catch { /* never crash the server */ }
}
function startSnapshotCollector() {
    collectOnce();
    setInterval(collectOnce, INTERVAL_MS);
}
