import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { parseMetarFlightRules } from '../utils/aviation';
import ReplayPage from './ReplayPage';

type OpsTab = 'live' | 'replay';

type Panel = 'ifr' | null;

interface Route { dep: string; dest: string; }

interface MetarSnap {
  rawOb:  string | null;
  wdir:   number | string;
  wspd:   number;
  wgst:   number | null;
  visib:  string;
  temp:   number;
}

type ObsSnapshot = Record<string, MetarSnap | null>;

const FR_RANK: Record<string, number> = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };
const FR_BADGE: Record<string, string> = {
  VFR:  'bg-green-100  dark:bg-green-900  text-green-700  dark:text-green-300',
  MVFR: 'bg-blue-100   dark:bg-blue-900   text-blue-700   dark:text-blue-300',
  IFR:  'bg-red-100    dark:bg-red-900    text-red-700    dark:text-red-300',
  LIFR: 'bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300',
  UNKN: 'bg-slate-100  dark:bg-slate-800  text-slate-500',
};

function worstFR(a: string, b: string): string {
  return (FR_RANK[a] ?? -1) >= (FR_RANK[b] ?? -1) ? a : b;
}

const REFRESH_SECS = 300;
const STORAGE_KEY  = 'skybroe_obs_routes';

function loadRoutes(): Route[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Route[];
  } catch { /* ignore */ }
  return [];
}

function saveRoutes(routes: Route[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export default function ObservabilityPage() {
  const navigate = useNavigate();
  const [opsTab, setOpsTab] = useState<OpsTab>('live');
  const [routes,      setRoutes]      = useState<Route[]>(loadRoutes);
  const [snapshots,   setSnapshots]   = useState<ObsSnapshot>({});
  const [counts,      setCounts]      = useState({ sigmets: 0, tfrs: 0 });
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown,   setCountdown]   = useState(REFRESH_SECS);
  const [addDep,      setAddDep]      = useState('');
  const [addDest,     setAddDest]     = useState('');
  const [addError,    setAddError]    = useState('');

  const [activePanel, setActivePanel] = useState<Panel>(null);
  const routeTableRef = useRef<HTMLDivElement>(null);

  const routesRef = useRef(routes);
  routesRef.current = routes;

  const refresh = useCallback(async () => {
    const current = routesRef.current;
    if (current.length === 0) return;
    setLoading(true);
    const icaos = [...new Set(current.flatMap(r => [r.dep, r.dest]))];
    try {
      const [stationsRes, countsRes] = await Promise.allSettled([
        api.obs.stations(icaos),
        api.obs.counts(),
      ]);
      if (stationsRes.status === 'fulfilled') setSnapshots(stationsRes.value as ObsSnapshot);
      if (countsRes.status === 'fulfilled')   setCounts(countsRes.value);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
      setCountdown(REFRESH_SECS);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_SECS * 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  function getFR(icao: string): string {
    const snap = snapshots[icao];
    return snap?.rawOb ? parseMetarFlightRules(snap.rawOb) : 'UNKN';
  }

  function addRoute() {
    const dep  = addDep.trim().toUpperCase();
    const dest = addDest.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(dep) || !/^[A-Z]{4}$/.test(dest)) {
      setAddError('Both must be 4-letter ICAO codes (e.g. KJFK).'); return;
    }
    if (dep === dest) { setAddError('Departure and destination must differ.'); return; }
    if (routes.some(r => r.dep === dep && r.dest === dest)) {
      setAddError('Route already tracked.'); return;
    }
    const updated = [...routes, { dep, dest }];
    setRoutes(updated);
    saveRoutes(updated);
    setAddDep(''); setAddDest(''); setAddError('');
    // fetch METARs for any new airports immediately
    const newIcaos = [dep, dest].filter(ic => !(ic in snapshots));
    if (newIcaos.length > 0) {
      api.obs.stations(newIcaos)
        .then(d => setSnapshots(s => ({ ...s, ...(d as ObsSnapshot) })))
        .catch(() => {});
    }
  }

  function removeRoute(dep: string, dest: string) {
    const updated = routes.filter(r => !(r.dep === dep && r.dest === dest));
    setRoutes(updated);
    saveRoutes(updated);
  }

  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, '0');

  const allIcaos  = [...new Set(routes.flatMap(r => [r.dep, r.dest]))];
  const ifrCount  = allIcaos.filter(ic => { const fr = getFR(ic); return fr === 'IFR' || fr === 'LIFR'; }).length;

  const TAB_CLS = (t: OpsTab) =>
    `px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
      opsTab === t
        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  return (
    <div className="space-y-6">

      {/* ── Tab selector ───────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button className={TAB_CLS('live')}   onClick={() => setOpsTab('live')}>Live</button>
        <button className={TAB_CLS('replay')} onClick={() => setOpsTab('replay')}>Replay</button>
      </div>

      {opsTab === 'replay' && <ReplayPage />}

      {opsTab === 'live' && <>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ops Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Live route health · SIGMETs/AIRMETs · TFRs — refreshes every 5 min
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}next in {mins}:{secs}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Tracked Routes — scrolls to route table */}
        <button
          onClick={() => routeTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all group cursor-pointer"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide group-hover:text-blue-500 transition-colors">Tracked Routes</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-blue-600 dark:text-blue-400">{routes.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">view list ↓</p>
        </button>

        {/* IFR / LIFR Airports — toggles inline panel */}
        <button
          onClick={() => setActivePanel(p => p === 'ifr' ? null : 'ifr')}
          className={`text-left bg-white dark:bg-slate-800 rounded-xl border px-4 py-3 hover:shadow-sm transition-all group cursor-pointer ${
            activePanel === 'ifr'
              ? 'border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-900'
              : 'border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700'
          }`}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide group-hover:text-red-500 transition-colors">IFR / LIFR Airports</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${ifrCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{ifrCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{activePanel === 'ifr' ? 'collapse ↑' : 'view list ↓'}</p>
        </button>

        {/* Active SIGMETs — navigates to map */}
        <button
          onClick={() => navigate('/map')}
          className="text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-sm transition-all group cursor-pointer"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide group-hover:text-orange-500 transition-colors">Active SIGMETs</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${counts.sigmets > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400'}`}>{counts.sigmets}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">view on map →</p>
        </button>

        {/* Active TFRs — navigates to map */}
        <button
          onClick={() => navigate('/map')}
          className="text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-red-300 dark:hover:border-red-700 hover:shadow-sm transition-all group cursor-pointer"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide group-hover:text-red-500 transition-colors">Active TFRs</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${counts.tfrs > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{counts.tfrs}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">view on map →</p>
        </button>
      </div>

      {/* ── IFR/LIFR airports panel ────────────────────────────────── */}
      {activePanel === 'ifr' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100 dark:border-red-900 flex items-center justify-between">
            <h2 className="font-semibold text-red-700 dark:text-red-300 text-sm">IFR / LIFR Airports</h2>
            <button onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
          </div>
          {ifrCount === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              All tracked airports are currently VFR or MVFR.
            </p>
          ) : (
            <div className="divide-y divide-red-50 dark:divide-red-900/50">
              {allIcaos
                .filter(ic => { const fr = getFR(ic); return fr === 'IFR' || fr === 'LIFR'; })
                .map(ic => {
                  const fr   = getFR(ic);
                  const snap = snapshots[ic];
                  const inRoutes = routes.filter(r => r.dep === ic || r.dest === ic);
                  return (
                    <div key={ic} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <span className={`text-sm font-bold px-2.5 py-0.5 rounded font-mono ${FR_BADGE[fr]}`}>{ic}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        fr === 'LIFR'
                          ? 'border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300'
                          : 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                      }`}>{fr}</span>
                      {snap?.rawOb && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {snap.wdir === 'VRB' ? 'VRB' : `${String(snap.wdir).padStart(3,'0')}°`}{' '}
                          {snap.wspd}kt{snap.wgst ? ` G${snap.wgst}kt` : ''}{' · '}
                          {snap.visib} SM
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                        {inRoutes.map(r => `${r.dep}→${r.dest}`).join(', ')}
                      </span>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}

      {/* ── Route health table ─────────────────────────────────────── */}
      {routes.length > 0 ? (
        <div ref={routeTableRef} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden scroll-mt-6">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Route Health</h2>
            <span className="text-xs text-slate-400">click row for full briefing</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {routes.map(({ dep, dest }) => {
              const depFR  = getFR(dep);
              const destFR = getFR(dest);
              const worst  = worstFR(depFR, destFR);
              const snap   = snapshots[dep];

              return (
                <div
                  key={`${dep}-${dest}`}
                  className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate('/route')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/route')}
                >
                  {/* Departure badge */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${FR_BADGE[depFR]}`}>
                    {dep}
                  </span>

                  {/* Arrow */}
                  <svg className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>

                  {/* Destination badge */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${FR_BADGE[destFR]}`}>
                    {dest}
                  </span>

                  {/* Worst-condition summary badge */}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    worst === 'VFR'  ? 'border-green-300  dark:border-green-700  text-green-700  dark:text-green-300' :
                    worst === 'MVFR' ? 'border-blue-300   dark:border-blue-700   text-blue-700   dark:text-blue-300' :
                    worst === 'IFR'  ? 'border-red-300    dark:border-red-700    text-red-700    dark:text-red-300' :
                    worst === 'LIFR' ? 'border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300' :
                    'border-slate-200 text-slate-400'
                  }`}>
                    {worst}
                  </span>

                  {/* Wind summary */}
                  {snap?.rawOb && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden md:block">
                      {dep}{' '}
                      {snap.wdir === 'VRB'
                        ? 'VRB'
                        : `${String(snap.wdir).padStart(3, '0')}°`}{' '}
                      {snap.wspd}kt
                      {snap.wgst ? ` G${snap.wgst}kt` : ''}
                    </span>
                  )}

                  {/* Actions */}
                  <div
                    className="ml-auto flex items-center gap-2"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => navigate('/route')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                      Briefing
                    </button>
                    <button
                      onClick={() => removeRoute(dep, dest)}
                      className="text-xs px-2 py-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div ref={routeTableRef} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-6 py-10 text-center scroll-mt-6">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No routes tracked yet — add one below to start monitoring.
          </p>
        </div>
      )}

      {/* ── Add route ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-4 space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Track a Route</h3>
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: 'Departure', value: addDep, set: setAddDep, placeholder: 'KJFK' },
            { label: 'Destination', value: addDest, set: setAddDest, placeholder: 'KLAX' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">
                {label}
              </label>
              <input
                value={value}
                onChange={e => { set(e.target.value.toUpperCase()); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && addRoute()}
                maxLength={4}
                placeholder={placeholder}
                className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={addRoute}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
        {addError && (
          <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
        )}
      </div>

      {/* ── Quick links ────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => navigate('/map')}
          className="text-sm px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Weather Map →
        </button>
        <button
          onClick={() => navigate('/dispatch')}
          className="text-sm px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Dispatch Strip →
        </button>
      </div>

      </>}
    </div>
  );
}
