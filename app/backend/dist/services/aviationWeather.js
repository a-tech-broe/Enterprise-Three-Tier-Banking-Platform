"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aviationWeather = void 0;
const BASE = 'https://aviationweather.gov/api/data';
async function get(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok)
        throw new Error(`AviationWeather API error: ${res.status}`);
    const text = await res.text();
    if (!text || !text.trim())
        return [];
    return JSON.parse(text);
}
exports.aviationWeather = {
    metar: (icao) => get(`/metar?ids=${icao.toUpperCase()}&format=json`),
    taf: (icao) => get(`/taf?ids=${icao.toUpperCase()}&format=json`),
    pireps: (icao, distanceSm = 100) => get(`/pirep?format=json&distance=${distanceSm}&icaoID=${icao.toUpperCase()}`),
    sigmets: () => get(`/sigmet?format=json&type=S`),
    airmets: () => get(`/airmet?format=json`),
    airport: (icao) => get(`/airport?ids=${icao.toUpperCase()}&format=json`),
    airportBbox: (south, north, west, east) => get(`/airport?bbox=${south},${west},${north},${east}&format=json`),
    metarBbox: (south, west, north, east) => get(`/metar?bbox=${south},${west},${north},${east}&format=json`),
    airsigmetGeoJSON: () => get(`/airsigmet?format=geojson`),
    tfrGeoJSON: () => get(`/tfr?format=geojson`),
};
