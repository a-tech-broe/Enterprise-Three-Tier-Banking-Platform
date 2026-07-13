import { Router } from 'express';

const router = Router();

const ALTITUDES = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

interface WindLevel {
  altFt: number;
  dir: number | null;
  speed: number | null;
  tempC: number | null;
}

interface WindsResult {
  station: string | null;
  icao: string;
  validTime: string | null;
  levels: WindLevel[];
}

function parseGroup(raw: string, altFt: number): WindLevel {
  const t = raw.trim();
  const level: WindLevel = { altFt, dir: null, speed: null, tempC: null };
  if (!t) return level;

  if (t === '9900') { level.dir = 0; level.speed = 0; return level; }

  if (t.length === 4) {
    const dd = parseInt(t.slice(0, 2), 10);
    const ss = parseInt(t.slice(2, 4), 10);
    if (isNaN(dd) || isNaN(ss)) return level;
    let dir = dd * 10, spd = ss;
    if (dd > 36) { dir = (dd - 50) * 10; spd = ss + 100; }
    level.dir = dir; level.speed = spd;
    return level;
  }

  if (t.length === 6 && altFt >= 30000) {
    const dd = parseInt(t.slice(0, 2), 10);
    const ss = parseInt(t.slice(2, 4), 10);
    const tt = parseInt(t.slice(4, 6), 10);
    if (isNaN(dd) || isNaN(ss) || isNaN(tt)) return level;
    let dir = dd * 10, spd = ss;
    if (dd > 36) { dir = (dd - 50) * 10; spd = ss + 100; }
    level.dir = dir; level.speed = spd; level.tempC = -tt;
    return level;
  }

  if (t.length === 7) {
    const dd = parseInt(t.slice(0, 2), 10);
    const ss = parseInt(t.slice(2, 4), 10);
    const sign = t[4];
    const tt = parseInt(t.slice(5, 7), 10);
    if (isNaN(dd) || isNaN(ss) || isNaN(tt)) return level;
    let dir = dd * 10, spd = ss;
    if (dd > 36) { dir = (dd - 50) * 10; spd = ss + 100; }
    level.dir = dir; level.speed = spd;
    level.tempC = sign === '-' ? -tt : tt;
    return level;
  }

  return level;
}

function icaoToStation(icao: string): string {
  const u = icao.toUpperCase();
  return /^[KPA][A-Z]{3}$/.test(u) ? u.slice(1) : u;
}

function parseWindsText(text: string, station: string): WindsResult | null {
  const lines = text.split('\n');

  let validTime: string | null = null;
  for (const line of lines) {
    const m = line.match(/VALID\s+(\d{6}Z)/);
    if (m) { validTime = m[1]; break; }
  }

  let ftIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^FT\s/.test(lines[i])) { ftIdx = i; break; }
  }
  if (ftIdx === -1) return null;

  const ftLine = lines[ftIdx];
  const colPositions: Array<{ alt: number; pos: number }> = [];
  for (const alt of ALTITUDES) {
    const idx = ftLine.indexOf(String(alt));
    if (idx !== -1) colPositions.push({ alt, pos: idx });
  }
  if (colPositions.length === 0) return null;

  const stationUpper = station.toUpperCase();
  let dataLine: string | null = null;
  for (let i = ftIdx + 1; i < lines.length; i++) {
    const lineStation = lines[i].slice(0, 3).trim();
    if (/^[A-Z]{2,3}$/.test(lineStation) && lineStation === stationUpper) {
      dataLine = lines[i]; break;
    }
  }
  if (!dataLine) return null;

  const levels: WindLevel[] = [];
  for (let i = 0; i < colPositions.length; i++) {
    const { alt, pos } = colPositions[i];
    const nextPos = i + 1 < colPositions.length ? colPositions[i + 1].pos : pos + 9;
    levels.push(parseGroup(dataLine.slice(pos, nextPos), alt));
  }

  return { station: stationUpper, icao: '', validTime, levels };
}

router.get('/:icao', async (req, res, next) => {
  try {
    const icao = req.params.icao.toUpperCase();
    const station = icaoToStation(icao);
    const url = 'https://aviationweather.gov/api/data/windtemp?region=us&fcst=06';
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`windtemp fetch error: ${response.status}`);
    const text = await response.text();
    const result = parseWindsText(text, station);
    if (!result) return res.json({ station: null, icao, validTime: null, levels: [] });
    result.icao = icao;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
