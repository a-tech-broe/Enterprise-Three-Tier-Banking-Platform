import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import MetarDisplay, { MetarData } from '../components/MetarDisplay';
import TafDisplay, { TafData } from '../components/TafDisplay';
import SearchInput from '../components/SearchInput';
import VoiceButton from '../components/VoiceButton';

type Tab = 'wx' | 'notams';

interface Pirep {
  rawOb: string;
  altitude: number;
  acType: string | null;
}

interface Notam {
  properties: {
    coreNOTAMData: {
      notam: {
        id: string;
        number: string;
        type: string;
        issued: string;
        effectiveStart: string;
        effectiveEnd: string;
        location: string;
        text: string;
        classification: string;
      };
    };
  };
}

interface NotamResponse {
  pageSize: number;
  pageNum: number;
  totalCount: number;
  items: Notam[];
}

export default function WeatherPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('wx');
  const [icao, setIcao] = useState('');
  const [query, setQuery] = useState('');

  // WX state
  const [metar, setMetar] = useState<MetarData | null>(null);
  const [taf, setTaf] = useState<TafData | null>(null);
  const [pireps, setPireps] = useState<Pirep[]>([]);
  const [loadingWx, setLoadingWx] = useState(false);
  const [errorWx, setErrorWx] = useState('');

  // NOTAMs state
  const [notams, setNotams] = useState<NotamResponse | null>(null);
  const [loadingNotams, setLoadingNotams] = useState(false);
  const [errorNotams, setErrorNotams] = useState('');
  const [notamsFor, setNotamsFor] = useState('');

  useEffect(() => {
    const param = searchParams.get('icao');
    if (param) doSearch(param.toUpperCase());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchWx(id: string) {
    setLoadingWx(true);
    setErrorWx('');
    setMetar(null);
    setTaf(null);
    setPireps([]);
    api.history.record(id, 'weather');
    try {
      const [metarRes, tafRes, pirepRes] = await Promise.allSettled([
        api.weather.metar(id),
        api.weather.taf(id),
        api.weather.pireps(id),
      ]);
      if (metarRes.status === 'fulfilled') setMetar((metarRes.value as MetarData[])[0] ?? null);
      if (tafRes.status === 'fulfilled') setTaf((tafRes.value as TafData[])[0] ?? null);
      if (pirepRes.status === 'fulfilled') setPireps(pirepRes.value as Pirep[]);
      if (metarRes.status === 'rejected' && tafRes.status === 'rejected')
        setErrorWx(`No weather data found for ${id}.`);
    } catch {
      setErrorWx('Failed to fetch weather data.');
    } finally {
      setLoadingWx(false);
    }
  }

  async function fetchNotams(id: string) {
    if (notamsFor === id) return;
    setLoadingNotams(true);
    setErrorNotams('');
    setNotams(null);
    api.history.record(id, 'notam');
    try {
      const res = await api.notams(id);
      setNotams(res as NotamResponse);
      setNotamsFor(id);
    } catch (err) {
      setErrorNotams(err instanceof Error ? err.message : 'Failed to fetch NOTAMs.');
    } finally {
      setLoadingNotams(false);
    }
  }

  async function doSearch(id: string) {
    if (!id || id.length < 3) return;
    setQuery(id);
    setIcao(id);
    if (id !== notamsFor) { setNotams(null); setNotamsFor(''); }
    fetchWx(id);
    if (tab === 'notams') fetchNotams(id);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'notams' && query && notamsFor !== query) fetchNotams(query);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(icao.trim().toUpperCase());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Weather Briefing</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">METAR · TAF · PIREPs · NOTAMs</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <SearchInput
          value={icao}
          onChange={setIcao}
          onSelect={(id) => doSearch(id)}
          searchType="weather"
          loading={loadingWx}
        />
        <button className="btn-primary" type="submit" disabled={loadingWx}>
          {loadingWx ? 'Loading…' : 'Brief'}
        </button>
        {tab === 'wx' && (metar || taf) && (
          <VoiceButton type="weather" data={{ icao: query, metar, taf, pireps }} disabled={loadingWx} />
        )}
        {tab === 'notams' && notams && (notams.items?.length ?? 0) > 0 && (
          <VoiceButton
            type="notam"
            data={{ icao: query, items: notams.items.slice(0, 20).map(item => item.properties?.coreNOTAMData?.notam) }}
            disabled={loadingNotams}
          />
        )}
      </form>

      {query && (
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['wx', 'notams'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t === 'wx' ? 'WX' : 'NOTAMs'}
            </button>
          ))}
        </div>
      )}

      {tab === 'wx' && (
        <>
          {errorWx && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
              {errorWx}
            </div>
          )}
          {metar && <MetarDisplay metar={metar} />}
          {taf && <TafDisplay taf={taf} />}
          {pireps.length > 0 && (
            <div className="card space-y-2">
              <h3 className="text-slate-700 dark:text-slate-300 font-semibold">
                PIREPs near {query} ({pireps.length})
              </h3>
              <div className="space-y-2">
                {pireps.map((p, i) => (
                  <div key={i} className="bg-slate-100 dark:bg-slate-950 rounded p-2">
                    <p className="text-slate-500 text-xs font-mono">FL{p.altitude} · {p.acType ?? 'UNKN'}</p>
                    <p className="text-slate-700 dark:text-slate-300 text-xs font-mono mt-0.5">{p.rawOb}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'notams' && (
        <>
          {errorNotams && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-amber-600 dark:text-amber-400 text-sm">
              {errorNotams}
            </div>
          )}
          {loadingNotams && (
            <p className="text-slate-500 text-sm">Loading NOTAMs…</p>
          )}
          {notams && (
            <div className="space-y-3">
              <p className="text-slate-500 text-sm">
                {notams.totalCount} NOTAM{notams.totalCount !== 1 ? 's' : ''} — {notams.items?.length ?? 0} shown
              </p>
              {notams.items?.map((item, i) => {
                const n = item.properties?.coreNOTAMData?.notam;
                if (!n) return null;
                return (
                  <div key={n.id ?? i} className="card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-500 dark:text-blue-400 font-mono text-sm font-semibold">{n.number}</span>
                      <span className="text-slate-500 text-xs font-mono">{n.type}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{n.effectiveStart} → {n.effectiveEnd}</p>
                    <p className="text-slate-700 dark:text-slate-300 text-sm font-mono whitespace-pre-wrap">{n.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
