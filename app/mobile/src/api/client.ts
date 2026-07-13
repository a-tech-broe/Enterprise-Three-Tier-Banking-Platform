const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  weather: {
    metar: (icao: string) => get(`/weather/metar/${icao}`),
    taf: (icao: string) => get(`/weather/taf/${icao}`),
  },
  notams: (icao: string) => get(`/notams/${icao}`),
  airports: (icao: string) => get(`/airports/${icao}`),
};
