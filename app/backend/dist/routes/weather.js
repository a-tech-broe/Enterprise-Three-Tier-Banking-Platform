"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aviationWeather_1 = require("../services/aviationWeather");
const router = (0, express_1.Router)();
router.get('/metar/:icao', async (req, res, next) => {
    try {
        const data = await aviationWeather_1.aviationWeather.metar(req.params.icao);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/taf/:icao', async (req, res, next) => {
    try {
        const data = await aviationWeather_1.aviationWeather.taf(req.params.icao);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/pireps/:icao', async (req, res, next) => {
    try {
        const dist = Number(req.query.distance) || 100;
        const data = await aviationWeather_1.aviationWeather.pireps(req.params.icao, dist);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/sigmets', async (_req, res, next) => {
    try {
        const [sigmets, airmets] = await Promise.all([
            aviationWeather_1.aviationWeather.sigmets(),
            aviationWeather_1.aviationWeather.airmets(),
        ]);
        res.json({ sigmets, airmets });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
