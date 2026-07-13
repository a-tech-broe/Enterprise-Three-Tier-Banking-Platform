import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

const VALID_TYPES = new Set(['airport', 'weather', 'notam']);

// GET /api/history?deviceId=xxx&type=airport
router.get('/', async (req, res, next) => {
  try {
    const { deviceId, type } = req.query as Record<string, string>;
    if (!deviceId || !type || !VALID_TYPES.has(type)) return res.json([]);

    // Deduplicate by ICAO — keep most recent hit per airport, return top 10
    const result = await pool.query<{ icao: string }>(
      `SELECT DISTINCT ON (icao) icao, searched_at
       FROM search_history
       WHERE device_id = $1 AND search_type = $2
       ORDER BY icao, searched_at DESC`,
      [deviceId, type]
    );

    const sorted = result.rows
      .sort((a: any, b: any) =>
        new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime()
      )
      .slice(0, 10)
      .map((r) => r.icao);

    res.json(sorted);
  } catch (err) {
    next(err);
  }
});

// POST /api/history  { deviceId, icao, type }
router.post('/', async (req, res, next) => {
  try {
    const { deviceId, icao, type } = req.body as Record<string, string>;
    if (!deviceId || !icao || !type || !VALID_TYPES.has(type)) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    await pool.query(
      `INSERT INTO search_history (device_id, icao, search_type) VALUES ($1, $2, $3)`,
      [deviceId, icao.toUpperCase().slice(0, 6), type]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
