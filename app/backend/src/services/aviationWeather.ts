const BASE = 'https://aviationweather.gov/api/data';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`AviationWeather API error: ${res.status}`);
  const text = await res.text();
  if (!text || !text.trim()) return [] as unknown as T;
  return JSON.parse(text) as T;
}

export type CloudLayer = { cover: string; base: number };

export interface Metar {
  icaoId: string;
  name: string;
  obsTime: number;
  temp: number;
  dewp: number;
  wdir: number | 'VRB';
  wspd: number;
  wgst: number | null;
  visib: string;
  altim: number;
  wxString: string | null;
  clouds: CloudLayer[];
  rawOb: string;
  lat: number;
  lon: number;
  elev: number;
}

export interface Taf {
  icaoId: string;
  rawTAF: string;
  issueTime: string;
  validTimeFrom: string;
  validTimeTo: string;
}

export interface Pirep {
  pirepType: string;
  obsTime: number;
  acType: string | null;
  altitude: number;
  icaoId: string | null;
  rawOb: string;
  lat: number;
  lon: number;
}

export interface Sigmet {
  id: string;
  icaoId: string | null;
  alphaChar: string;
  hazard: string;
  qualifier: string;
  validTimeFrom: string;
  validTimeTo: string;
  rawAirSigmet: string;
}

export const aviationWeather = {
  metar: (icao: string) =>
    get<Metar[]>(`/metar?ids=${icao.toUpperCase()}&format=json`),

  taf: (icao: string) =>
    get<Taf[]>(`/taf?ids=${icao.toUpperCase()}&format=json`),

  pireps: (icao: string, distanceSm = 100) =>
    get<Pirep[]>(`/pirep?format=json&distance=${distanceSm}&icaoID=${icao.toUpperCase()}`),

  sigmets: () =>
    get<Sigmet[]>(`/sigmet?format=json&type=S`),

  airmets: () =>
    get<Sigmet[]>(`/airmet?format=json`),

  airport: (icao: string) =>
    get<Record<string, unknown>[]>(`/airport?ids=${icao.toUpperCase()}&format=json`),

  airportBbox: (south: number, north: number, west: number, east: number) =>
    get<Record<string, unknown>[]>(`/airport?bbox=${south},${west},${north},${east}&format=json`),

  metarBbox: (south: number, west: number, north: number, east: number) =>
    get<Metar[]>(`/metar?bbox=${south},${west},${north},${east}&format=json`),

  airsigmetGeoJSON: () =>
    get<unknown>(`/airsigmet?format=geojson`),

  tfrGeoJSON: () =>
    get<unknown>(`/tfr?format=geojson`),
};
