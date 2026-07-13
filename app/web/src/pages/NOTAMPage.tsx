import { useState } from 'react';
import { api } from '../api/client';
import SearchInput from '../components/SearchInput';
import VoiceButton from '../components/VoiceButton';

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

export default function NOTAMPage() {
  const [icao, setIcao] = useState('');
  const [data, setData] = useState<NotamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function doSearch(id: string) {
    if (!id) return;

    setIcao(id);
    setLoading(true);
    setError('');
    setData(null);
    api.history.record(id, 'notam');

    try {
      const res = await api.notams(id);
      setData(res as NotamResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch NOTAMs.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(icao.trim().toUpperCase());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">NOTAMs</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Notices to Air Missions via FAA API</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <SearchInput
          value={icao}
          onChange={setIcao}
          onSelect={(id) => doSearch(id)}
          searchType="notam"
          loading={loading}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Fetch'}
        </button>
        {data && data.items?.length > 0 && (
          <VoiceButton
            type="notam"
            data={{ icao, items: data.items.slice(0, 20).map(item => item.properties?.coreNOTAMData?.notam) }}
            disabled={loading}
          />
        )}
      </form>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-amber-600 dark:text-amber-400 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <p className="text-slate-500 text-sm">
            {data.totalCount} NOTAM{data.totalCount !== 1 ? 's' : ''} — {data.items?.length ?? 0} shown
          </p>
          {data.items?.map((item, i) => {
            const n = item.properties?.coreNOTAMData?.notam;
            if (!n) return null;
            return (
              <div key={n.id ?? i} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-blue-500 dark:text-blue-400 font-mono text-sm font-semibold">
                    {n.number}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">{n.type}</span>
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {n.effectiveStart} → {n.effectiveEnd}
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-sm font-mono whitespace-pre-wrap">{n.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
