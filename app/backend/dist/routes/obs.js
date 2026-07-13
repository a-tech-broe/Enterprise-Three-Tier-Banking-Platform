"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aviationWeather_1 = require("../services/aviationWeather");
const router = (0, express_1.Router)();
// Batch METAR fetch for a list of ICAOs — returns { [icao]: MetarData | null }
router.post('/stations', async (req, res, next) => {
    try {
        const { icaos } = req.body;
        if (!Array.isArray(icaos) || icaos.length === 0) {
            return res.status(400).json({ error: 'icaos must be a non-empty array' });
        }
        const capped = icaos.slice(0, 30).map(ic => ic.toUpperCase());
        const results = await Promise.allSettled(capped.map(ic => aviationWeather_1.aviationWeather.metar(ic)));
        const data = {};
        capped.forEach((ic, i) => {
            const r = results[i];
            data[ic] = r.status === 'fulfilled' ? (r.value[0] ?? null) : null;
        });
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// Global SIGMET/AIRMET and TFR counts
router.get('/counts', async (_req, res, next) => {
    try {
        const [sigmets, tfrs] = await Promise.allSettled([
            aviationWeather_1.aviationWeather.airsigmetGeoJSON(),
            aviationWeather_1.aviationWeather.tfrGeoJSON(),
        ]);
        function featureCount(r) {
            if (r.status === 'rejected')
                return 0;
            const d = r.value;
            return d?.type === 'FeatureCollection' && Array.isArray(d.features) ? d.features.length : 0;
        }
        res.json({ sigmets: featureCount(sigmets), tfrs: featureCount(tfrs) });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
