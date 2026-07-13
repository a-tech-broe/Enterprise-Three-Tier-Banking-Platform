import { useState } from 'react';
import { api } from '../api/client';
import { parseMetarFlightRules, flightRulesColor } from '../utils/aviation';

interface StationRow {
  icao: string;
  metar: string | null;
  flightRules: string;
  wind: string;
  vis: string;
  ceiling: string;
  temp: string;
  altim: string;
}

function parseWind(metar: string): string {
  const m = metar.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  if (!m) return '—';
  const dir = m[1];
  const spd = parseInt(m[2]);
  const gust = m[3] ? `G${m[3]}` : '';
  return `${dir}@${spd}${gust}`;
}

function parseVis(metar: string): string {
  const m = metar.match(/\b(\d+(?:\/\d+)?)\s*SM\b/);
  return m ? `${m[1]} SM` : '—';
}

function parseCeiling(metar: string): string {
  const layers = metar.match(/\b(BKN|OVC)(\d{3})\b/g) ?? [];
  if (layers.length === 0) return 'SKC';
  const lowest = layers
    .map((l) => parseInt(l.slice(-3)) * 100)
    .sort((a, b) => a - b)[0];
  return `${lowest.toLocaleString()} ft`;
}

function parseTemp(metar: string): string {
  const m = metar.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  if (!m) return '—';
  const t = m[1].replace('M', '-');
  const d = m[2].replace('M', '-');
  return `${t}/${d}°C`;
}

function parseAltim(metar: string): string {
  const m = metar.match(/\bA(\d{4})\b/);
  return m ? `${m[1].slice(0, 2)}.${m[1].slice(2)}"` : '—';
}

const frBg: Record<string, string> = {
  VFR:  'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
  MVFR: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  IFR:  'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
  LIFR: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
};

export default function DispatchPage() {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDispatch() {
    const icaos = input
      .toUpperCase()
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^[A-Z]{4}$/.test(s));

    if (icaos.length === 0) {
      setError('Enter one or more ICAO codes separated by spaces or commas.');
      return;
    }

    setLoading(true);
    setError(null);

    const results = await Promise.all(
      icaos.map(async (icao) => {
        const res = await (api.weather.metar(icao) as Promise<{ rawOb: string }[]>).catch(
          () => [] as { rawOb: string }[]
        );
        const raw = res?.[0]?.rawOb ?? null;
        return {
          icao,
          metar: raw,
          flightRules: raw ? parseMetarFlightRules(raw) : 'UNKN',
          wind: raw ? parseWind(raw) : '—',
          vis: raw ? parseVis(raw) : '—',
          ceiling: raw ? parseCeiling(raw) : '—',
          temp: raw ? parseTemp(raw) : '—',
          altim: raw ? parseAltim(raw) : '—',
        };
      })
    );

    setRows(results);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dispatch Strip</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Multi-station weather at a glance for route planning and ops
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="KDEP KDST KALT  (space or comma separated)"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && runDispatch()}
        />
        <button onClick={runDispatch} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-50 dark:bg-red-950 rounded-lg">{error}</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  {['Station', 'Category', 'Wind', 'Vis', 'Ceiling', 'Temp/Dew', 'Altim'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.icao} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold">{r.icao}</td>
                    <td className={`px-4 py-3 font-bold text-sm ${flightRulesColor(r.flightRules)}`}>
                      {r.flightRules}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.wind}</td>
                    <td className="px-4 py-3">{r.vis}</td>
                    <td className="px-4 py-3">{r.ceiling}</td>
                    <td className="px-4 py-3 font-mono">{r.temp}</td>
                    <td className="px-4 py-3 font-mono">{r.altim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {rows.map((r) => (
              <div
                key={r.icao}
                className={`rounded-xl border p-4 ${frBg[r.flightRules] ?? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-lg">{r.icao}</span>
                  <span className={`font-bold text-sm ${flightRulesColor(r.flightRules)}`}>
                    {r.flightRules}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-400">Wind</span>
                  <span className="font-mono">{r.wind}</span>
                  <span className="text-slate-400">Vis</span>
                  <span>{r.vis}</span>
                  <span className="text-slate-400">Ceiling</span>
                  <span>{r.ceiling}</span>
                  <span className="text-slate-400">Temp/Dew</span>
                  <span className="font-mono">{r.temp}</span>
                  <span className="text-slate-400">Altimeter</span>
                  <span className="font-mono">{r.altim}</span>
                </div>
                {r.metar && (
                  <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400 break-all">
                    {r.metar}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
