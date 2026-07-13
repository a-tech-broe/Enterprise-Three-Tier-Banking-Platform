import { Router } from 'express';
import { aviationWeather } from '../services/aviationWeather';

const router = Router();

router.get('/metar/:icao', async (req, res, next) => {
  try {
    const data = await aviationWeather.metar(req.params.icao);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/taf/:icao', async (req, res, next) => {
  try {
    const data = await aviationWeather.taf(req.params.icao);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/pireps/:icao', async (req, res, next) => {
  try {
    const dist = Number(req.query.distance) || 100;
    const data = await aviationWeather.pireps(req.params.icao, dist);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/sigmets', async (_req, res, next) => {
  try {
    const [sigmets, airmets] = await Promise.all([
      aviationWeather.sigmets(),
      aviationWeather.airmets(),
    ]);
    res.json({ sigmets, airmets });
  } catch (err) {
    next(err);
  }
});

export default router;
