import { useState } from 'react';
import { api } from '../api/client';
import SearchInput from '../components/SearchInput';
import VoiceButton from '../components/VoiceButton';
import { parseMetarFlightRules, flightRulesColor } from '../utils/aviation';

interface StationBrief {
  icao: string;
  role: 'DEP' | 'DEST' | 'ALT';
  metar: string | null;
  taf: string | null;
  flightRules: string;
  notamCount: number;
}

const roleBadge: Record<string, string> = {
  DEP: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  DEST: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  ALT: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
};

export default function RouteBriefingPage() {
  const [dep, setDep] = useState('');
  const [dest, setDest] = useState('');
  const [alt, setAlt] = useState('');
  const [stations, setStations] = useState<StationBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runBriefing() {
    const stops: { icao: string; role: 'DEP' | 'DEST' | 'ALT' }[] = [
      { icao: dep.trim().toUpperCase(), role: 'DEP' as const },
      { icao: dest.trim().toUpperCase(), role: 'DEST' as const },
      ...(alt.trim() ? [{ icao: alt.trim().toUpperCase(), role: 'ALT' as const }] : []),
    ].filter((s) => /^[A-Z]{4}$/.test(s.icao));

    if (stops.length < 2) {
      setError('Enter at least a departure and destination (4-letter ICAO codes).');
      return;
    }

    setLoading(true);
    setError(null);

    const results = await Promise.all(
      stops.map(async ({ icao, role }) => {
        const [metarRes, tafRes, notamRes] = await Promise.allSettled([
          api.weather.metar(icao) as Promise<{ rawOb: string }[]>,
          api.weather.taf(icao) as Promise<{ rawTAF: string }[]>,
          api.notams(icao) as Promise<unknown[]>,
        ]);

        const metarRaw =
          metarRes.status === 'fulfilled' && metarRes.value?.[0]?.rawOb
            ? metarRes.value[0].rawOb
            : null;
        const tafRaw =
          tafRes.status === 'fulfilled' && tafRes.value?.[0]?.rawTAF
            ? tafRes.value[0].rawTAF
            : null;
        const notamCount =
          notamRes.status === 'fulfilled' && Array.isArray(notamRes.value)
            ? notamRes.value.length
            : 0;

        return {
          icao,
          role,
          metar: metarRaw,
          taf: tafRaw,
          flightRules: metarRaw ? parseMetarFlightRules(metarRaw) : 'UNKN',
          notamCount,
        };
      })
    );

    setStations(results);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Route Briefing</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Preflight weather and NOTAM strip for your route
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(
            [
              { label: 'Departure', value: dep, set: setDep, placeholder: 'KDEP' },
              { label: 'Destination', value: dest, set: setDest, placeholder: 'KDST' },
              { label: 'Alternate (optional)', value: alt, set: setAlt, placeholder: 'KALT' },
            ] as const
          ).map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                {label}
              </label>
              <SearchInput
                value={value}
                onChange={set}
                onSelect={set}
                searchType="airport"
                placeholder={placeholder}
                maxLength={4}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={runBriefing} disabled={loading} className="btn-primary">
            {loading ? 'Loading…' : 'Get Briefing'}
          </button>
          {stations.length > 0 && (
            <VoiceButton type="route" data={{ stations }} disabled={loading} />
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-50 dark:bg-red-950 rounded-lg">{error}</div>
      )}

      {stations.length > 0 && (
        <div className="space-y-4">
          {stations.map((s) => (
            <div
              key={s.icao}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${roleBadge[s.role]}`}
                >
                  {s.role}
                </span>
                <span className="font-bold font-mono text-lg">{s.icao}</span>
                <span className={`ml-auto text-sm font-bold ${flightRulesColor(s.flightRules)}`}>
                  {s.flightRules}
                </span>
                {s.notamCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded font-medium">
                    {s.notamCount} NOTAM{s.notamCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="px-5 py-4 space-y-4">
                {s.metar ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      METAR
                    </p>
                    <p className="font-mono text-sm break-all text-slate-800 dark:text-slate-100">
                      {s.metar}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No METAR available</p>
                )}

                {s.taf && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      TAF
                    </p>
                    <pre className="font-mono text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">
                      {s.taf}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
