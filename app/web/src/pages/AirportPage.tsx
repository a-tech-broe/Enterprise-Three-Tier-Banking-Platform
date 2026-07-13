import { useState } from 'react';
import { api } from '../api/client';
import SearchInput from '../components/SearchInput';
import VoiceButton from '../components/VoiceButton';
import { getSunTimes, formatUtc } from '../utils/sun';
import { densityAltitude, parseFrequencies } from '../utils/aviation';

interface RunwayInfo {
  id: string;         // "06L/24R"
  dimension: string;  // "8926x150"
  surface: string;    // "A"=asphalt, "C"=concrete, "G"=gravel, "T"=turf
  alignment: number;  // magnetic heading from the low-numbered end
}

interface AirportData {
  icaoId: string;
  iataId: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  elev: number;
  runways: RunwayInfo[];
  metar?: string;
  freqs?: string;
}

interface Chart {
  code: string;
  name: string;
  pdfUrl: string;
}

interface ChartsResponse {
  cycle: string | null;
  charts: Chart[];
  international?: boolean;
}

type Tab = 'overview' | 'runways' | 'charts';

interface AlternateApt {
  icaoId: string;
  name: string;
  distNm: number;
  metar: string | null;
}

const CHART_ORDER: Record<string, number> = { APD: 0, IAP: 1, DP: 2, STAR: 3, MIN: 4, HOT: 5 };

const SURFACE_LABELS: Record<string, string> = {
  A: 'Asphalt', C: 'Concrete', G: 'Gravel', T: 'Turf', D: 'Dirt',
};

interface RwyEnd {
  id: string;       // "06L" or "24R"
  pairId: string;   // "06L/24R"
  heading: number;  // degrees
  lengthFt: number;
  surface: string;
}

function expandRunways(runways: RunwayInfo[]): RwyEnd[] {
  const ends: RwyEnd[] = [];
  for (const rwy of runways) {
    const [endA, endB] = rwy.id.split('/');
    const lengthFt = parseInt(rwy.dimension?.split('x')[0] ?? '0', 10) || 0;
    const headingA = rwy.alignment;
    const headingB = (rwy.alignment + 180) % 360;
    ends.push({ id: endA, pairId: rwy.id, heading: headingA, lengthFt, surface: rwy.surface });
    ends.push({ id: endB, pairId: rwy.id, heading: headingB, lengthFt, surface: rwy.surface });
  }
  return ends;
}

function parseMetarWind(metar: string): { dir: number; speed: number } | null {
  if (!metar) return null;
  const m = metar.match(/\b(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?KT\b/);
  if (!m || m[1] === 'VRB') return null;
  return { dir: parseInt(m[1], 10), speed: parseInt(m[2], 10) };
}

function parseMetarFlightRules(metar: string): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  if (!metar) return 'VFR';

  let vis = Infinity;
  const visMixed = metar.match(/\b(\d+)\s+(\d+)\/(\d+)SM\b/);
  const visFrac = metar.match(/\bM?(\d+)\/(\d+)SM\b/);
  const visFull = metar.match(/\bM?(\d+(?:\.\d+)?)SM\b/);
  if (visMixed) vis = parseInt(visMixed[1]) + parseInt(visMixed[2]) / parseInt(visMixed[3]);
  else if (visFrac) vis = parseInt(visFrac[1]) / parseInt(visFrac[2]);
  else if (visFull) vis = parseFloat(visFull[1]);

  let ceiling = Infinity;
  const ceilRe = /\b(BKN|OVC|OVX)(\d{3})\b/g;
  let cm: RegExpExecArray | null;
  while ((cm = ceilRe.exec(metar)) !== null) {
    ceiling = Math.min(ceiling, parseInt(cm[2], 10) * 100);
  }

  if (ceiling < 500 || vis < 1) return 'LIFR';
  if (ceiling < 1000 || vis < 3) return 'IFR';
  if (ceiling < 3000 || vis < 5) return 'MVFR';
  return 'VFR';
}

// Extract the airport diagram chart (APD code)
function getApdChart(charts: Chart[] | undefined): Chart | null {
  return charts?.find((c) => c.code === 'APD') ?? null;
}

// Match IAP charts whose name references a specific runway end (e.g. "24R", "06L", "18")
function getApproachesForRunway(charts: Chart[] | undefined, runwayId: string): Chart[] {
  if (!charts) return [];
  // Strip leading zero so "06L" → "6L" then "0*6L" matches both "6L" and "06L" in chart names
  const stripped = runwayId.replace(/^0+/, '');
  const re = new RegExp(`\\bRWY\\s+0*${stripped}\\b`, 'i');
  return charts.filter((c) => c.code === 'IAP' && re.test(c.name));
}

function headingDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function groupCharts(charts: Chart[]): Record<string, Chart[]> {
  const groups: Record<string, Chart[]> = {};
  for (const chart of charts) {
    const key = chart.code || 'OTHER';
    if (!groups[key]) groups[key] = [];
    groups[key].push(chart);
  }
  return groups;
}

const CODE_LABELS: Record<string, string> = {
  APD: 'Airport Diagram',
  IAP: 'Instrument Approaches',
  DP: 'Departure Procedures (SIDs)',
  STAR: 'Arrival Procedures (STARs)',
  MIN: 'Takeoff Minimums',
  HOT: 'Airport Hot Spots',
};

interface ApproachKind {
  label: string;
  priority: number;
  color: string;
}

function classifyApproach(name: string): ApproachKind {
  const n = name.toUpperCase();
  if (n.includes('ILS') && !n.includes('LOC ONLY'))
    return { label: 'ILS', priority: 0, color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' };
  if (n.includes('(RNP)') || n.includes('RNP AR'))
    return { label: 'RNP AR', priority: 1, color: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' };
  if (n.includes('RNAV') || n.includes('GPS'))
    return { label: 'RNAV', priority: 2, color: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300' };
  if (n.includes('VOR'))
    return { label: 'VOR', priority: 3, color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' };
  if (n.includes('LOC'))
    return { label: 'LOC', priority: 4, color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' };
  if (n.includes('NDB'))
    return { label: 'NDB', priority: 5, color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' };
  return { label: 'IAP', priority: 6, color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' };
}

export default function AirportPage() {
  const [icao, setIcao] = useState('');
  const [airport, setAirport] = useState<AirportData | null>(null);
  const [charts, setCharts] = useState<ChartsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [highlightIap, setHighlightIap] = useState(false);
  const [altimInput, setAltimInput] = useState('29.92');
  const [oatInput, setOatInput] = useState('');
  const [alternates, setAlternates] = useState<AlternateApt[] | null>(null);
  const [altLoading, setAltLoading] = useState(false);

  async function loadAlternates(airportIcao: string) {
    setAltLoading(true);
    try {
      const result = await api.airports.alternates(airportIcao) as AlternateApt[];
      setAlternates(result);
    } catch {
      setAlternates([]);
    } finally {
      setAltLoading(false);
    }
  }

  async function doSearch(id: string) {
    if (!id) return;

    setIcao(id);
    setLoading(true);
    setError('');
    setAirport(null);
    setCharts(null);
    setTab('overview');
    setHighlightIap(false);
    setAlternates(null);
    api.history.record(id, 'airport');

    try {
      const [info, chartData] = await Promise.all([
        api.airports.info(id) as Promise<AirportData>,
        api.airports.charts(id) as Promise<ChartsResponse>,
      ]);
      if (!info) throw new Error(`Airport ${id} not found.`);
      setAirport(info);
      setCharts(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch airport.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(icao.trim().toUpperCase());
  }

  const metar = airport?.metar ?? '';
  const wind = parseMetarWind(metar);
  const flightRules = airport ? parseMetarFlightRules(metar) : null;
  const isIfr = flightRules === 'IFR' || flightRules === 'LIFR';

  const sunTimes = airport ? getSunTimes(new Date(), airport.lat, airport.lon) : null;
  const freqs = airport?.freqs ? parseFrequencies(airport.freqs) : [];
  const altim = parseFloat(altimInput) || 29.92;
  const oat = parseFloat(oatInput);
  const da = airport && !isNaN(oat) ? densityAltitude(airport.elev, altim, oat) : null;

  const rwyEnds = airport?.runways ? expandRunways(airport.runways) : [];
  const rankedEnds = wind
    ? rwyEnds
        .map((r) => ({ ...r, diff: headingDiff(r.heading, wind.dir) }))
        .sort((a, b) => a.diff - b.diff)
    : rwyEnds.map((r) => ({ ...r, diff: null as null | number }));

  const longestFt = airport?.runways?.length
    ? Math.max(...airport.runways.map((r) => parseInt(r.dimension?.split('x')[0] ?? '0', 10) || 0))
    : 0;

  const hasApproaches = charts && !charts.international && charts.charts.some((c) => c.code === 'IAP');

  // Build "approaches in use" for the active runway(s).
  // Calm wind (<3 kt) or no wind → top 2 runway ends; otherwise top 1 (best headwind).
  const calm = !wind || wind.speed < 3;
  const endsToShow = calm ? rankedEnds.slice(0, 2) : rankedEnds.slice(0, 1);
  type AnnotatedChart = Chart & ApproachKind;
  interface ActiveRunway { rwyId: string; heading: number; approaches: AnnotatedChart[] }
  const approachesInUse: ActiveRunway[] = hasApproaches
    ? endsToShow
        .map((rwy) => ({
          rwyId: rwy.id,
          heading: rwy.heading,
          approaches: getApproachesForRunway(charts!.charts, rwy.id)
            .map((c) => ({ ...c, ...classifyApproach(c.name) }))
            .sort((a, b) => a.priority - b.priority),
        }))
        .filter((r) => r.approaches.length > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Airport Info</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Location · Elevation · Runways · Charts
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <SearchInput
          value={icao}
          onChange={setIcao}
          onSelect={(id) => doSearch(id)}
          searchType="airport"
          loading={loading}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Lookup'}
        </button>
        {airport && (
          <VoiceButton
            type="airport"
            data={{
              icaoId: airport.icaoId,
              name: airport.name,
              elevationFt: airport.elev,
              flightRules,
              metar: airport.metar,
              longestRunwayFt: longestFt,
              runways: airport.runways,
              densityAltitudeFt: da,
            }}
            disabled={loading}
          />
        )}
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {airport && (
        <div className="card space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {airport.icaoId}
              </h2>
              {airport.iataId && (
                <span className="text-slate-500 font-mono text-sm">{airport.iataId}</span>
              )}
            </div>
            <p className="text-slate-700 dark:text-slate-300 mt-0.5">{airport.name}</p>
            <p className="text-slate-500 text-sm">
              {airport.state && `${airport.state}, `}{airport.country}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {(['overview', 'runways', 'charts'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                  tab === t
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                ].join(' ')}
              >
                {t}
                {t === 'runways' && rwyEnds.length > 0 && (
                  <span className="ml-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5">
                    {airport.runways.length}
                  </span>
                )}
                {t === 'charts' && charts && charts.charts.length > 0 && (
                  <span className="ml-1.5 text-xs bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-full px-1.5 py-0.5">
                    {charts.charts.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Elevation" value={`${airport.elev} ft MSL`} />
                <Stat
                  label="Coordinates"
                  value={`${airport.lat?.toFixed(4)}° N, ${airport.lon?.toFixed(4)}°`}
                />
                {longestFt > 0 && (
                  <Stat label="Longest Runway" value={`${longestFt.toLocaleString()} ft`} />
                )}
              </div>

              {isIfr && hasApproaches && (
                <div className={[
                  'flex items-center justify-between gap-4 rounded-lg px-4 py-3 border',
                  flightRules === 'LIFR'
                    ? 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-300 dark:border-fuchsia-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
                ].join(' ')}>
                  <div className="flex items-center gap-3">
                    <span className={[
                      'text-xs font-bold tracking-widest px-2 py-0.5 rounded',
                      flightRules === 'LIFR' ? 'bg-fuchsia-600 text-white' : 'bg-red-600 text-white',
                    ].join(' ')}>
                      {flightRules}
                    </span>
                    <span className={[
                      'text-sm font-medium',
                      flightRules === 'LIFR'
                        ? 'text-fuchsia-700 dark:text-fuchsia-300'
                        : 'text-red-700 dark:text-red-300',
                    ].join(' ')}>
                      Instrument conditions — approach plates required
                    </span>
                  </div>
                  <button
                    onClick={() => { setTab('charts'); setHighlightIap(true); }}
                    className={[
                      'flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                      flightRules === 'LIFR'
                        ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white',
                    ].join(' ')}
                  >
                    View Approaches →
                  </button>
                </div>
              )}

              {metar && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current METAR</p>
                  <p className="text-slate-700 dark:text-slate-300 font-mono text-sm bg-slate-100 dark:bg-slate-950 rounded-lg p-3 break-all">
                    {metar}
                  </p>
                </div>
              )}

              {wind && (
                <div className="flex items-center gap-3 text-sm">
                  <WindArrow dir={wind.dir} />
                  <span className="text-slate-700 dark:text-slate-300">
                    Wind{' '}
                    <span className="font-mono font-semibold">
                      {String(wind.dir).padStart(3, '0')}°
                    </span>{' '}
                    at{' '}
                    <span className="font-mono font-semibold">{wind.speed} kt</span>
                  </span>
                </div>
              )}

              {/* Approaches in Use */}
              {approachesInUse.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Approaches in Use
                    </p>
                    <span className="text-xs text-slate-400">
                      {wind && !calm
                        ? `Wind ${String(wind.dir).padStart(3, '0')}° @ ${wind.speed} kt → RWY ${approachesInUse[0]?.rwyId}`
                        : 'Calm / no wind — showing top runways'}
                    </span>
                  </div>

                  {approachesInUse.map(({ rwyId, heading, approaches }) => (
                    <div key={rwyId}>
                      {approachesInUse.length > 1 && (
                        <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                          <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-200">
                            RWY {rwyId}
                          </span>
                          <span className="text-xs text-slate-400 ml-2 font-mono">
                            HDG {String(heading).padStart(3, '0')}°
                          </span>
                        </div>
                      )}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {approaches.map((chart) => (
                          <a
                            key={chart.pdfUrl}
                            href={chart.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-950 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors group"
                          >
                            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${chart.color}`}>
                              {chart.label}
                            </span>
                            <span className="flex-1 font-mono text-xs text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">
                              {chart.name}
                            </span>
                            <svg
                              className="w-3.5 h-3.5 flex-shrink-0 text-slate-300 group-hover:text-sky-400"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400">
                      FAA d-TPP · AIRAC {charts?.cycle} · Opens PDF in new tab ·{' '}
                      <button
                        onClick={() => { setTab('charts'); setHighlightIap(true); }}
                        className="text-sky-500 hover:text-sky-600 underline"
                      >
                        All charts →
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* Sunrise / Sunset */}
              {sunTimes && (sunTimes.sunrise || sunTimes.sunset) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sunTimes.sunrise && (
                    <Stat label="Sunrise (UTC)" value={formatUtc(sunTimes.sunrise)} />
                  )}
                  {sunTimes.sunset && (
                    <Stat label="Sunset (UTC)" value={formatUtc(sunTimes.sunset)} />
                  )}
                  {sunTimes.solarNoon && (
                    <Stat label="Solar Noon (UTC)" value={formatUtc(sunTimes.solarNoon)} />
                  )}
                </div>
              )}

              {/* Frequencies */}
              {freqs.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Frequencies</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {freqs.map((f, i) => (
                      <div key={i} className="bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-400">{f.type}</p>
                        <p className="font-mono font-semibold text-sm text-slate-800 dark:text-slate-100">
                          {f.freq || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Density Altitude Calculator */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Density Altitude
                </p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Altimeter (in Hg)</label>
                    <input
                      className="input w-24 font-mono text-sm"
                      value={altimInput}
                      onChange={(e) => setAltimInput(e.target.value)}
                      placeholder="29.92"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">OAT (°C)</label>
                    <input
                      className="input w-20 font-mono text-sm"
                      value={oatInput}
                      onChange={(e) => setOatInput(e.target.value)}
                      placeholder="15"
                    />
                  </div>
                  {da !== null && (
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 mb-1">Density Alt</span>
                      <span className={`font-mono font-bold text-lg ${da > 8000 ? 'text-red-500' : da > 5000 ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
                        {da.toLocaleString()} ft
                      </span>
                    </div>
                  )}
                </div>
                {da !== null && da > (airport?.elev ?? 0) + 2000 && (
                  <p className="text-xs text-orange-500">
                    High DA — expect reduced aircraft performance. Verify POH limitations.
                  </p>
                )}
              </div>

              {/* Alternates */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Nearby Alternates (50 nm)
                  </p>
                  {!alternates && (
                    <button
                      onClick={() => loadAlternates(airport.icaoId)}
                      disabled={altLoading}
                      className="text-xs text-sky-500 hover:text-sky-600 font-medium"
                    >
                      {altLoading ? 'Loading…' : 'Load'}
                    </button>
                  )}
                </div>
                {alternates && alternates.length === 0 && (
                  <p className="text-sm text-slate-400">No alternates found within 50 nm.</p>
                )}
                {alternates && alternates.length > 0 && (
                  <div className="space-y-2">
                    {alternates.map((alt) => (
                      <div key={alt.icaoId} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => doSearch(alt.icaoId)}
                            className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            {alt.icaoId}
                          </button>
                          <span className="text-xs text-slate-400">{alt.distNm} nm</span>
                          <span className="text-xs text-slate-500 truncate">{alt.name}</span>
                        </div>
                        {alt.metar && (
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400 break-all pl-1">
                            {alt.metar}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Runways tab */}
          {tab === 'runways' && (
            <div className="space-y-4">
              {/* Airport Diagram */}
              {(() => {
                const apd = getApdChart(charts?.charts);
                if (!apd) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Airport Diagram</p>
                      <a
                        href={apd.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-500 hover:text-sky-600 font-medium flex items-center gap-1"
                      >
                        Full screen
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950">
                      <iframe
                        src={apd.pdfUrl}
                        title="Airport Diagram"
                        className="w-full"
                        style={{ height: '520px' }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Runway list */}
              {rwyEnds.length === 0 ? (
                <p className="text-slate-500 text-sm">No runway data available.</p>
              ) : (
                <>
                  {wind ? (
                    <p className="text-xs text-slate-500">
                      Sorted by wind favor —{' '}
                      <span className="font-mono">
                        {String(wind.dir).padStart(3, '0')}° at {wind.speed} kt
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No wind data. Headings shown for reference.
                    </p>
                  )}

                  <div className="space-y-3">
                    {rankedEnds.map((rwy, i) => {
                      const isBest = wind && i === 0;
                      const xw = wind && rwy.diff != null
                        ? Math.round(Math.abs(Math.sin((rwy.diff * Math.PI) / 180) * wind.speed))
                        : null;
                      const hw = wind && rwy.diff != null
                        ? Math.round(Math.abs(Math.cos((rwy.diff * Math.PI) / 180) * wind.speed))
                        : null;
                      const surfaceLabel = SURFACE_LABELS[rwy.surface] ?? rwy.surface;
                      const approaches = getApproachesForRunway(charts?.charts, rwy.id);

                      return (
                        <div
                          key={rwy.id}
                          className={[
                            'rounded-lg overflow-hidden border',
                            isBest
                              ? 'border-green-200 dark:border-green-700'
                              : 'border-slate-200 dark:border-slate-700',
                          ].join(' ')}
                        >
                          {/* Runway header row */}
                          <div className={[
                            'flex items-center justify-between gap-4 px-3 py-2.5',
                            isBest
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : 'bg-slate-100 dark:bg-slate-900',
                          ].join(' ')}>
                            <div className="flex items-center gap-3 min-w-0">
                              {isBest && (
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide flex-shrink-0">
                                  Best
                                </span>
                              )}
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-lg flex-shrink-0">
                                {rwy.id}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="text-slate-500 text-xs font-mono">
                                  HDG {String(rwy.heading).padStart(3, '0')}°
                                </span>
                                <span className="text-slate-400 text-xs">
                                  {rwy.lengthFt > 0 ? `${rwy.lengthFt.toLocaleString()} ft` : ''}{surfaceLabel ? ` · ${surfaceLabel}` : ''}
                                </span>
                              </div>
                            </div>

                            {wind && hw !== null && xw !== null && (
                              <div className="flex gap-3 text-xs text-slate-500 font-mono flex-shrink-0">
                                <span><span className="text-slate-400">HW</span> {hw} kt</span>
                                <span><span className="text-slate-400">XW</span> {xw} kt</span>
                              </div>
                            )}
                          </div>

                          {/* Approach plates for this runway */}
                          {approaches.length > 0 && (
                            <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                              {approaches.map((chart) => (
                                <a
                                  key={chart.pdfUrl}
                                  href={chart.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-950 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors group"
                                >
                                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                                    {chart.name}
                                  </span>
                                  <svg
                                    className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-400 flex-shrink-0 ml-2"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Charts tab */}
          {tab === 'charts' && (
            <div className="space-y-4">
              {charts?.international ? (
                <div className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-950 rounded-lg p-4">
                  FAA d-TPP charts are only available for US airports (K/P/A prefixes). For
                  international charts, consult your national AIP or Jeppesen.
                </div>
              ) : !charts || charts.charts.length === 0 ? (
                <p className="text-slate-500 text-sm">No charts found for current AIRAC cycle.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-400">
                    AIRAC cycle{' '}
                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {charts.cycle}
                    </span>{' '}
                    · FAA d-TPP · Opens in new tab
                  </p>

                  {Object.entries(groupCharts(charts.charts))
                    .sort(([a], [b]) => (CHART_ORDER[a] ?? 99) - (CHART_ORDER[b] ?? 99))
                    .map(([code, items]) => (
                      <div
                        key={code}
                        className={[
                          'rounded-lg transition-colors',
                          highlightIap && code === 'IAP'
                            ? 'ring-2 ring-red-400 dark:ring-red-600 p-3 -mx-3'
                            : '',
                        ].join(' ')}
                      >
                        <p className={[
                          'text-xs uppercase tracking-wider mb-2',
                          highlightIap && code === 'IAP'
                            ? 'text-red-500 dark:text-red-400 font-semibold'
                            : 'text-slate-500',
                        ].join(' ')}>
                          {CODE_LABELS[code] ?? code}
                        </p>
                        <div className="space-y-1">
                          {items.map((chart) => (
                            <a
                              key={chart.pdfUrl}
                              href={chart.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-100 dark:bg-slate-950 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors group"
                            >
                              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400 font-mono">
                                {chart.name}
                              </span>
                              <svg
                                className="w-4 h-4 text-slate-400 group-hover:text-sky-500 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-100 dark:bg-slate-950 rounded-lg p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-slate-800 dark:text-slate-100 font-mono text-sm mt-1">{value}</p>
    </div>
  );
}

function WindArrow({ dir }: { dir: number }) {
  return (
    <div
      className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30"
      style={{ transform: `rotate(${dir}deg)` }}
      title={`Wind from ${dir}°`}
    >
      <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L7 10h5v12h2V10h5L12 2z" />
      </svg>
    </div>
  );
}
