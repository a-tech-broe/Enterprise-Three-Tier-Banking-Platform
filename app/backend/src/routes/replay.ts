import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

// List tracked airports — must come before /:icao
router.get('/tracked', async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{ icao: string }>(
      'SELECT icao FROM tracked_airports ORDER BY icao'
    );
    res.json(rows.map(r => r.icao));
  } catch (err) { next(err); }
});

// Add an airport to the tracking list
router.post('/track', async (req, res, next) => {
  try {
    const { icao } = req.body as { icao: string };
    if (!icao || !/^[A-Z0-9]{3,4}$/.test(icao.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid ICAO identifier' });
    }
    await pool.query(
      'INSERT INTO tracked_airports (icao) VALUES ($1) ON CONFLICT DO NOTHING',
      [icao.toUpperCase()]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Remove an airport from tracking
router.delete('/track/:icao', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tracked_airports WHERE icao = $1', [
      req.params.icao.toUpperCase(),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Get snapshots for an airport over the last N hours (max 168 = 7 days)
router.get('/:icao', async (req, res, next) => {
  try {
    const icao  = req.params.icao.toUpperCase();
    const hours = Math.min(Math.max(parseInt(req.query.hours as string) || 24, 1), 168);
    const { rows } = await pool.query(
      `SELECT captured_at, flight_rules, raw_metar, wdir, wspd, wgst, visib, temp, altim
       FROM obs_snapshots
       WHERE icao = $1 AND captured_at > NOW() - ($2 * INTERVAL '1 hour')
       ORDER BY captured_at ASC`,
      [icao, hours]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
