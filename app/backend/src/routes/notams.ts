import { Router } from 'express';

const router = Router();

const FAA_BASE = 'https://external-api.faa.gov/notamapi/v1/notams';

router.get('/:icao', async (req, res, next) => {
  try {
    const clientId = process.env.FAA_CLIENT_ID;
    const clientSecret = process.env.FAA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(503).json({
        error: 'NOTAM service unavailable — FAA API credentials not configured.',
        hint: 'Set FAA_CLIENT_ID and FAA_CLIENT_SECRET in your .env file. Register at https://api.faa.gov/',
      });
    }

    const url = `${FAA_BASE}?icaoLocation=${req.params.icao.toUpperCase()}&pageSize=50`;
    const upstream = await fetch(url, {
      headers: {
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    if (upstream.status === 404) {
      return res.json({ pageSize: 0, pageNum: 1, totalCount: 0, items: [] });
    }

    if (!upstream.ok) {
      throw new Error(`FAA API error: ${upstream.status}`);
    }

    const text = await upstream.text();
    const data = text && text.trim() ? JSON.parse(text) : { pageSize: 0, pageNum: 1, totalCount: 0, items: [] };
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
