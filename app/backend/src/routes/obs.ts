import { Router } from 'express';
import { aviationWeather } from '../services/aviationWeather';

const router = Router();

// Batch METAR fetch for a list of ICAOs — returns { [icao]: MetarData | null }
router.post('/stations', async (req, res, next) => {
  try {
    const { icaos } = req.body as { icaos: string[] };
    if (!Array.isArray(icaos) || icaos.length === 0) {
      return res.status(400).json({ error: 'icaos must be a non-empty array' });
    }
    const capped = icaos.slice(0, 30).map(ic => ic.toUpperCase());
    const results = await Promise.allSettled(capped.map(ic => aviationWeather.metar(ic)));
    const data: Record<string, unknown> = {};
    capped.forEach((ic, i) => {
      const r = results[i];
      data[ic] = r.status === 'fulfilled' ? (r.value[0] ?? null) : null;
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Global SIGMET/AIRMET and TFR counts
router.get('/counts', async (_req, res, next) => {
  try {
    const [sigmets, tfrs] = await Promise.allSettled([
      aviationWeather.airsigmetGeoJSON(),
      aviationWeather.tfrGeoJSON(),
    ]);

    function featureCount(r: PromiseSettledResult<unknown>): number {
      if (r.status === 'rejected') return 0;
      const d = r.value as { type?: string; features?: unknown[] };
      return d?.type === 'FeatureCollection' && Array.isArray(d.features) ? d.features.length : 0;
    }

    res.json({ sigmets: featureCount(sigmets), tfrs: featureCount(tfrs) });
  } catch (err) {
    next(err);
  }
});

export default router;
