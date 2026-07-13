"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aviationWeather_1 = require("../services/aviationWeather");
const charts_1 = require("../services/charts");
function distNm(lat1, lon1, lat2, lon2) {
    const r1 = (lat1 * Math.PI) / 180;
    const r2 = (lat2 * Math.PI) / 180;
    const v = Math.sin(r1) * Math.sin(r2) +
        Math.cos(r1) * Math.cos(r2) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
    return Math.acos(Math.min(1, Math.max(-1, v))) * 3440.065;
}
const router = (0, express_1.Router)();
router.get('/:icao', async (req, res, next) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const [airportRes, metarRes] = await Promise.allSettled([
            aviationWeather_1.aviationWeather.airport(icao),
            aviationWeather_1.aviationWeather.metar(icao),
        ]);
        const airport = airportRes.status === 'fulfilled' ? (airportRes.value[0] ?? null) : null;
        if (!airport)
            return res.json(null);
        if (metarRes.status === 'fulfilled' && metarRes.value[0]) {
            airport.metar = metarRes.value[0].rawOb;
        }
        res.json(airport);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:icao/charts', async (req, res, next) => {
    try {
        const { icao } = req.params;
        const upper = icao.toUpperCase();
        // FAA d-TPP only covers US/territories — K, P, A prefixes
        if (!/^[KPA]/i.test(upper)) {
            return res.json({ cycle: null, charts: [], international: true });
        }
        const { charts, cycle } = await (0, charts_1.getAirportCharts)(upper);
        res.json({ cycle, charts });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:icao/alternates', async (req, res, next) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const radiusNm = Math.min(Number(req.query.radius) || 50, 150);
        const airportData = await aviationWeather_1.aviationWeather.airport(icao);
        const apt = airportData[0];
        if (!apt)
            return res.status(404).json({ error: 'Airport not found' });
        const lat = apt.lat;
        const lon = apt.lon;
        const latDeg = radiusNm / 60;
        const lonDeg = radiusNm / (60 * Math.cos((lat * Math.PI) / 180));
        const nearby = await aviationWeather_1.aviationWeather.airportBbox(lat - latDeg, lat + latDeg, lon - lonDeg, lon + lonDeg);
        const candidates = nearby
            .filter((a) => {
            const id = a.icaoId?.toUpperCase();
            return id && id !== icao;
        })
            .map((a) => ({ ...a, _dist: distNm(lat, lon, a.lat, a.lon) }))
            .filter((a) => a._dist <= radiusNm)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 8);
        const metarResults = await Promise.allSettled(candidates.map((a) => aviationWeather_1.aviationWeather.metar(a.icaoId.toUpperCase())));
        const result = candidates.map((a, i) => {
            const mr = metarResults[i];
            const rawOb = mr.status === 'fulfilled' && mr.value[0]
                ? mr.value[0].rawOb
                : null;
            return {
                icaoId: a.icaoId,
                name: a.name,
                lat: a.lat,
                lon: a.lon,
                elev: a.elev,
                distNm: Math.round(a._dist * 10) / 10,
                metar: rawOb,
            };
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
