export interface CloudLayer {
  cover: string;
  base: number;
}

export interface MetarData {
  icaoId: string;
  name: string;
  obsTime: number;
  temp: number;
  dewp: number;
  wdir: number | string;
  wspd: number;
  wgst: number | null;
  visib: string;
  altim: number;
  wxString: string | null;
  clouds: CloudLayer[];
  rawOb: string;
}

function getFlightRules(metar: MetarData): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  const vis = parseFloat(metar.visib);
  const ceiling = metar.clouds
    ?.filter((c) => ['BKN', 'OVC', 'OVX'].includes(c.cover))
    ?.reduce((min, c) => Math.min(min, c.base), Infinity) ?? Infinity;

  if (ceiling < 500 || vis < 1) return 'LIFR';
  if (ceiling < 1000 || vis < 3) return 'IFR';
  if (ceiling < 3000 || vis < 5) return 'MVFR';
  return 'VFR';
}

function flightRulesBadge(fr: string) {
  const cls: Record<string, string> = {
    VFR: 'badge-vfr',
    MVFR: 'badge-mvfr',
    IFR: 'badge-ifr',
    LIFR: 'badge-lifr',
  };
  return <span className={cls[fr] || 'badge-mvfr'}>{fr}</span>;
}

function formatWind(metar: MetarData) {
  const dir = metar.wdir === 'VRB' ? 'VRB' : String(metar.wdir).padStart(3, '0');
  const speed = `${metar.wspd}KT`;
  const gust = metar.wgst ? `G${metar.wgst}KT` : '';
  return `${dir}° ${speed}${gust}`;
}

function formatClouds(clouds: CloudLayer[]) {
  if (!clouds?.length) return 'SKC';
  return clouds.map((c) => `${c.cover} ${c.base}ft`).join(' · ');
}

export default function MetarDisplay({ metar }: { metar: MetarData }) {
  const fr = getFlightRules(metar);
  const obsDate = new Date(metar.obsTime * 1000);

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{metar.icaoId}</h2>
            {flightRulesBadge(fr)}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{metar.name}</p>
        </div>
        <span className="text-slate-500 text-xs font-mono">
          {obsDate.toUTCString().slice(0, 22)}Z
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Wind" value={formatWind(metar)} />
        <Stat label="Visibility" value={`${metar.visib} SM`} />
        <Stat label="Altimeter" value={`${metar.altim?.toFixed(2)}" Hg`} />
        <Stat label="Temp / Dew" value={`${metar.temp}° / ${metar.dewp}°C`} />
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sky</p>
        <p className="text-slate-700 dark:text-slate-300 text-sm font-mono">{formatClouds(metar.clouds)}</p>
      </div>

      {metar.wxString && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Weather</p>
          <p className="text-amber-600 dark:text-amber-400 text-sm font-mono">{metar.wxString}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Raw METAR</p>
        <p className="text-slate-600 dark:text-slate-400 text-xs font-mono bg-slate-100 dark:bg-slate-950 rounded p-2 break-all">
          {metar.rawOb}
        </p>
      </div>
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
