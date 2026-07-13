import { Router } from 'express';
import { aviationWeather } from '../services/aviationWeather';

const router = Router();

router.get('/metars', async (req, res, next) => {
  try {
    const bbox = req.query.bbox as string;
    if (!bbox) return res.status(400).json({ error: 'bbox required (south,west,north,east)' });
    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be four numbers: south,west,north,east' });
    }
    const [south, west, north, east] = parts;
    const data = await aviationWeather.metarBbox(south, west, north, east);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/sigmets', async (_req, res, next) => {
  try {
    const data = await aviationWeather.airsigmetGeoJSON();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/tfrs', async (_req, res, next) => {
  try {
    const data = await aviationWeather.tfrGeoJSON();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
