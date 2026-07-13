import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Snapshot } from '../api/client';

const HOURS_OPTIONS = [6, 12, 24, 48, 72] as const;
type HoursOption = typeof HOURS_OPTIONS[number];

const FR_BAR: Record<string, string> = {
  VFR:  'bg-green-400  dark:bg-green-600',
  MVFR: 'bg-blue-400   dark:bg-blue-600',
  IFR:  'bg-red-400    dark:bg-red-600',
  LIFR: 'bg-fuchsia-500 dark:bg-fuchsia-700',
};
const FR_BADGE: Record<string, string> = {
  VFR:  'bg-green-100  dark:bg-green-900  text-green-700  dark:text-green-300',
  MVFR: 'bg-blue-100   dark:bg-blue-900   text-blue-700   dark:text-blue-300',
  IFR:  'bg-red-100    dark:bg-red-900    text-red-700    dark:text-red-300',
  LIFR: 'bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReplayPage() {
  const [tracked,    setTracked]    = useState<string[]>([]);
  const [selected,   setSelected]   = useState<string>('');
  const [hours,      setHours]      = useState<HoursOption>(24);
  const [snapshots,  setSnapshots]  = useState<Snapshot[]>([]);
  const [idx,        setIdx]        = useState(0);
  const [playing,    setPlaying]    = useState(false);
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [addInput,   setAddInput]   = useState('');
  const [addError,   setAddError]   = useState('');

  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load tracked airports on mount
  useEffect(() => {
    api.replay.tracked().then(setTracked).catch(() => {});
  }, []);

  // Load snapshots when airport or window changes
  const loadSnapshots = useCallback(async (icao: string, h: HoursOption) => {
    if (!icao) return;
    setLoadingSnap(true);
    setPlaying(false);
    if (playRef.current) clearInterval(playRef.current);
    try {
      const data = await api.replay.snapshots(icao, h);
      setSnapshots(data);
      setIdx(data.length > 0 ? data.length - 1 : 0); // start at most recent
    } catch {
      setSnapshots([]);
    } finally {
      setLoadingSnap(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadSnapshots(selected, hours);
  }, [selected, hours, loadSnapshots]);

  // Clean up interval on unmount
  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current); }, []);

  function togglePlay() {
    if (playing) {
      if (playRef.current) clearInterval(playRef.current);
      setPlaying(false);
    } else {
      if (snapshots.length < 2) return;
      setIdx(0);
      setPlaying(true);
      playRef.current = setInterval(() => {
        setIdx(i => {
          if (i >= snapshots.length - 1) {
            clearInterval(playRef.current!);
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 600);
    }
  }

  async function addTracked() {
    const icao = addInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
      setAddError('Must be a 3–4 letter ICAO code.'); return;
    }
    if (tracked.includes(icao)) { setAddError('Already tracked.'); return; }
    try {
      await api.replay.track(icao);
      const updated = [...tracked, icao].sort();
      setTracked(updated);
      setSelected(icao);
      setAddInput(''); setAddError('');
    } catch {
      setAddError('Failed to add airport.');
    }
  }

  async function removeTracked(icao: string) {
    await api.replay.untrack(icao).catch(() => {});
    const updated = tracked.filter(a => a !== icao);
    setTracked(updated);
    if (selected === icao) { setSelected(''); setSnapshots([]); }
  }

  const snap = snapshots[idx] ?? null;
  const hasData = snapshots.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Operational Replay</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Replay historical weather conditions for any tracked airport
        </p>
      </div>

      {/* ── Controls row ───────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap items-end">
        {/* Airport selector */}
        <div>
          <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Airport</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
          >
            <option value="">— select —</option>
            {tracked.map(icao => (
              <option key={icao} value={icao}>{icao}</option>
            ))}
          </select>
        </div>

        {/* Time window */}
        <div>
          <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Window</label>
          <div className="flex gap-1">
            {HOURS_OPTIONS.map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hours === h
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!hasData || snapshots.length < 2}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing ? (
            <>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Play
            </>
          )}
        </button>

        {/* Rewind to start */}
        {hasData && (
          <button
            onClick={() => { setIdx(0); setPlaying(false); if (playRef.current) clearInterval(playRef.current); }}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            title="Back to start"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Timeline ───────────────────────────────────────────────── */}
      {selected && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          {loadingSnap ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading snapshots…
            </div>
          ) : !hasData ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No snapshots yet for {selected}</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs">
                The collector runs every 15 minutes. Check back shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Colored timeline bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
                  <span>{fmtTime(snapshots[0].captured_at)}</span>
                  <span>{fmtTime(snapshots[snapshots.length - 1].captured_at)}</span>
                </div>
                <div className="flex h-6 rounded-lg overflow-hidden gap-px">
                  {snapshots.map((s, i) => (
                    <div
                      key={i}
                      className={`flex-1 cursor-pointer transition-opacity ${FR_BAR[s.flight_rules] ?? 'bg-slate-300'} ${
                        i === idx ? 'ring-2 ring-white ring-inset opacity-100' : 'opacity-70 hover:opacity-90'
                      }`}
                      onClick={() => setIdx(i)}
                      title={`${fmtTime(s.captured_at)} — ${s.flight_rules}`}
                    />
                  ))}
                </div>
                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={snapshots.length - 1}
                  value={idx}
                  onChange={e => { setPlaying(false); if (playRef.current) clearInterval(playRef.current); setIdx(parseInt(e.target.value)); }}
                  className="w-full mt-1 accent-blue-600"
                />
              </div>

              {/* FR legend */}
              <div className="flex gap-3 flex-wrap">
                {(['VFR','MVFR','IFR','LIFR'] as const).map(fr => (
                  <div key={fr} className="flex items-center gap-1.5 text-xs">
                    <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${FR_BAR[fr]}`}/>
                    <span className="text-slate-500 dark:text-slate-400">{fr}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Snapshot card ──────────────────────────────────────────── */}
      {snap && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-2xl text-slate-900 dark:text-white">{selected}</span>
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded ${FR_BADGE[snap.flight_rules] ?? 'bg-slate-100 text-slate-500'}`}>
              {snap.flight_rules}
            </span>
            <span className="ml-auto text-sm text-slate-400 dark:text-slate-500 font-mono">
              {fmtTime(snap.captured_at)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Wind', value: snap.wdir && snap.wspd != null
                  ? `${snap.wdir === 'VRB' ? 'VRB' : String(snap.wdir).padStart(3,'0') + '°'} ${snap.wspd}kt${snap.wgst ? ` G${snap.wgst}kt` : ''}`
                  : '—' },
              { label: 'Visibility', value: snap.visib ? `${snap.visib} SM` : '—' },
              { label: 'Temp', value: snap.temp != null ? `${snap.temp}°C` : '—' },
              { label: 'Altimeter', value: snap.altim != null ? `${snap.altim} inHg` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {snap.raw_metar && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Raw METAR</p>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{snap.raw_metar}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tracking management ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Tracked Airports</h3>

        {tracked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tracked.map(icao => (
              <div key={icao} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-semibold">
                <button onClick={() => setSelected(icao)} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {icao}
                </button>
                <button
                  onClick={() => removeTracked(icao)}
                  className="text-slate-400 hover:text-red-500 transition-colors leading-none"
                  title="Stop tracking"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Add Airport</label>
            <input
              value={addInput}
              onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && addTracked()}
              maxLength={4}
              placeholder="KJFK"
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={addTracked}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Track
          </button>
        </div>
        {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Snapshots are captured every 15 minutes and kept for 7 days.
        </p>
      </div>
    </div>
  );
}
