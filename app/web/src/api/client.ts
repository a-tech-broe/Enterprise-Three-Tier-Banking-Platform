import { getDeviceId } from '../utils/deviceId';

export interface Snapshot {
  captured_at:  string;
  flight_rules: string;
  raw_metar:    string | null;
  wdir:         string | null;
  wspd:         number | null;
  wgst:         number | null;
  visib:        string | null;
  temp:         number | null;
  altim:        number | null;
}

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('skybroe_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      post<{ token: string; user: { id: string; email: string } }>('/auth/register', { email, password }),
    login: (email: string, password: string) =>
      post<{ token: string; user: { id: string; email: string } }>('/auth/login', { email, password }),
    me: () =>
      get<{ user: { id: string; email: string } }>('/auth/me'),
    forgotPassword: (email: string) =>
      post<{ message: string }>('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      post<{ message: string }>('/auth/reset-password', { token, password }),
  },
  weather: {
    metar: (icao: string) => get(`/weather/metar/${icao}`),
    taf: (icao: string) => get(`/weather/taf/${icao}`),
    pireps: (icao: string) => get(`/weather/pireps/${icao}`),
    sigmets: () => get(`/weather/sigmets`),
  },
  notams: (icao: string) => get(`/notams/${icao}`),
  airports: {
    info: (icao: string) => get(`/airports/${icao}`),
    charts: (icao: string) => get(`/airports/${icao}/charts`),
    alternates: (icao: string, radiusNm = 50) =>
      get(`/airports/${icao}/alternates?radius=${radiusNm}`),
  },
  winds: (icao: string) => get(`/winds/${icao}`),
  history: {
    get: (type: string) =>
      get<string[]>(`/history?deviceId=${getDeviceId()}&type=${type}`),
    record: (icao: string, type: string) => {
      request(`/history`, {
        method: 'POST',
        body: JSON.stringify({ deviceId: getDeviceId(), icao, type }),
      }).catch(() => {});
    },
  },
  map: {
    metars: (bbox: string) => get(`/map/metars?bbox=${bbox}`),
    sigmets: () => get(`/map/sigmets`),
    tfrs: () => get(`/map/tfrs`),
  },
  voice: {
    brief: (type: string, data: unknown) =>
      post<{ text: string }>('/voice/brief', { type, data }),
  },
  obs: {
    stations: (icaos: string[]) =>
      post<Record<string, unknown>>('/obs/stations', { icaos }),
    counts: () =>
      get<{ sigmets: number; tfrs: number }>('/obs/counts'),
  },
  replay: {
    tracked:   () =>
      get<string[]>('/replay/tracked'),
    track:     (icao: string) =>
      post<{ ok: boolean }>('/replay/track', { icao }),
    untrack:   (icao: string) =>
      del<{ ok: boolean }>(`/replay/track/${icao}`),
    snapshots: (icao: string, hours = 24) =>
      get<Snapshot[]>(`/replay/${icao}?hours=${hours}`),
  },
};
