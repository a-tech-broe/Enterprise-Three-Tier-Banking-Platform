import { useState } from 'react';
import SearchInput from '../components/SearchInput';
import { api } from '../api/client';

interface WindLevel {
  altFt: number;
  dir: number | null;
  speed: number | null;
  tempC: number | null;
}

interface WindsData {
  station: string | null;
  icao: string;
  validTime: string | null;
  levels: WindLevel[];
}

function isaTemp(altFt: number): number {
  return 15 - 2 * (altFt / 1000);
}

export default function WindsAloftPage() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<WindsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSearch(id: string) {
    const upper = id.trim().toUpperCase();
    if (!upper) return;
    setQuery(upper);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await api.winds(upper) as WindsData;
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load winds data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Winds Aloft</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          6-hour FD forecast · US stations only
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          doSearch(query);
        }}
      >
        <SearchInput
          value={query}
          onChange={setQuery}
          onSelect={doSearch}
          searchType="airport"
          placeholder="ICAO (e.g. KLAX)"
          maxLength={4}
          loading={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-50 dark:bg-red-950 rounded-lg">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">{data.icao}</h2>
            {data.station && (
              <span className="text-slate-400 text-sm">Station: {data.station}</span>
            )}
            {data.validTime && (
              <span className="text-slate-400 text-sm">Valid: {data.validTime}</span>
            )}
          </div>

          {data.levels.length === 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
              <p className="text-slate-500 text-sm">
                No winds data found for <strong>{data.icao}</strong>.
              </p>
              <p className="text-slate-400 text-xs mt-1">
                FD winds use 3-letter station IDs. Try a major US hub: KDEN, KLAX, KJFK, KORD.
              </p>
            </div>
          ) : (
            <>
            {/* Desktop / tablet — table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    {['Altitude', 'Direction', 'Speed (kts)', 'Temp (°C)', 'ISA Dev'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.levels.map((lv) => {
                    const isa = isaTemp(lv.altFt);
                    const dev = lv.tempC !== null ? lv.tempC - isa : null;
                    const altLabel =
                      lv.altFt >= 18000
                        ? `FL${lv.altFt / 100}`
                        : `${lv.altFt.toLocaleString()} ft`;
                    return (
                      <tr key={lv.altFt} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono font-medium">{altLabel}</td>
                        <td className="px-4 py-2.5 font-mono">
                          {lv.dir === null
                            ? '—'
                            : lv.dir === 0 && lv.speed === 0
                            ? 'L & V'
                            : `${String(lv.dir).padStart(3, '0')}°`}
                        </td>
                        <td
                          className={`px-4 py-2.5 font-mono font-medium ${
                            lv.speed !== null && lv.speed >= 50
                              ? 'text-red-500'
                              : lv.speed !== null && lv.speed >= 30
                              ? 'text-orange-500'
                              : ''
                          }`}
                        >
                          {lv.speed === null ? '—' : lv.speed === 0 ? 'Calm' : lv.speed}
                        </td>
                        <td
                          className={`px-4 py-2.5 font-mono ${
                            lv.tempC !== null && lv.tempC < -40
                              ? 'text-blue-500'
                              : lv.tempC !== null && lv.tempC > 5
                              ? 'text-orange-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {lv.tempC !== null
                            ? `${lv.tempC > 0 ? '+' : ''}${lv.tempC}`
                            : '—'}
                        </td>
                        <td
                          className={`px-4 py-2.5 font-mono ${
                            dev !== null && dev > 5
                              ? 'text-orange-500 font-medium'
                              : dev !== null && dev < -5
                              ? 'text-blue-500 font-medium'
                              : 'text-slate-500'
                          }`}
                        >
                          {dev !== null ? `${dev > 0 ? '+' : ''}${dev.toFixed(0)}°C` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile — cards */}
            <div className="sm:hidden space-y-2">
              {data.levels.map((lv) => {
                const isa = isaTemp(lv.altFt);
                const dev = lv.tempC !== null ? lv.tempC - isa : null;
                const altLabel =
                  lv.altFt >= 18000 ? `FL${lv.altFt / 100}` : `${lv.altFt.toLocaleString()} ft`;
                const dir =
                  lv.dir === null ? '—'
                  : lv.dir === 0 && lv.speed === 0 ? 'L & V'
                  : `${String(lv.dir).padStart(3, '0')}°`;
                return (
                  <div key={lv.altFt} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-semibold">{altLabel}</span>
                      <span className="font-mono text-sm text-slate-500">{dir}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Speed</div>
                        <div className={`font-mono font-medium ${
                          lv.speed !== null && lv.speed >= 50 ? 'text-red-500'
                          : lv.speed !== null && lv.speed >= 30 ? 'text-orange-500' : ''
                        }`}>
                          {lv.speed === null ? '—' : lv.speed === 0 ? 'Calm' : `${lv.speed} kt`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Temp</div>
                        <div className={`font-mono ${
                          lv.tempC !== null && lv.tempC < -40 ? 'text-blue-500'
                          : lv.tempC !== null && lv.tempC > 5 ? 'text-orange-400'
                          : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {lv.tempC !== null ? `${lv.tempC > 0 ? '+' : ''}${lv.tempC}°` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">ISA Dev</div>
                        <div className={`font-mono ${
                          dev !== null && dev > 5 ? 'text-orange-500 font-medium'
                          : dev !== null && dev < -5 ? 'text-blue-500 font-medium'
                          : 'text-slate-500'
                        }`}>
                          {dev !== null ? `${dev > 0 ? '+' : ''}${dev.toFixed(0)}°C` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}

          <p className="text-xs text-slate-400">
            ISA deviation = actual temp − standard atmosphere temp at that altitude.
            Orange = warmer than ISA (density altitude higher than indicated).
          </p>
        </div>
      )}
    </div>
  );
}
