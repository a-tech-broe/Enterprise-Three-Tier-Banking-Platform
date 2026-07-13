"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aviationWeather_1 = require("../services/aviationWeather");
const router = (0, express_1.Router)();
router.get('/metars', async (req, res, next) => {
    try {
        const bbox = req.query.bbox;
        if (!bbox)
            return res.status(400).json({ error: 'bbox required (south,west,north,east)' });
        const parts = bbox.split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) {
            return res.status(400).json({ error: 'bbox must be four numbers: south,west,north,east' });
        }
        const [south, west, north, east] = parts;
        const data = await aviationWeather_1.aviationWeather.metarBbox(south, west, north, east);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/sigmets', async (_req, res, next) => {
    try {
        const data = await aviationWeather_1.aviationWeather.airsigmetGeoJSON();
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/tfrs', async (_req, res, next) => {
    try {
        const data = await aviationWeather_1.aviationWeather.tfrGeoJSON();
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
