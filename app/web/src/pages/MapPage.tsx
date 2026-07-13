import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { parseMetarFlightRules } from '../utils/aviation';

const FR_COLOR: Record<string, string> = {
  VFR:  '#22c55e',
  MVFR: '#3b82f6',
  IFR:  '#ef4444',
  LIFR: '#d946ef',
};

interface MetarStation {
  icaoId: string;
  rawOb:  string;
  lat:    number;
  lon:    number;
  wdir:   number | string;
  wspd:   number;
  wgst:   number | null;
  visib:  string;
  clouds: { cover: string; base: number }[];
  temp:   number;
  dewp:   number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJSONData = any;

function isFeatureCollection(d: unknown): d is GeoJSONData {
  return (
    !!d &&
    typeof d === 'object' &&
    (d as GeoJSONData).type === 'FeatureCollection' &&
    Array.isArray((d as GeoJSONData).features)
  );
}

function toBbox(map: LeafletMap): string {
  const b = map.getBounds();
  return `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
}

function MapEvents({ onBbox }: { onBbox: (bbox: string) => void }) {
  const map = useMapEvents({
    moveend: () => onBbox(toBbox(map)),
    zoomend: () => onBbox(toBbox(map)),
  });
  useEffect(() => { onBbox(toBbox(map)); }, []); // fire on mount
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [stations, setStations]   = useState<MetarStation[]>([]);
  const [sigmets, setSigmets]     = useState<GeoJSONData>(null);
  const [tfrs, setTfrs]           = useState<GeoJSONData>(null);
  const [showSigmets, setShowSigmets] = useState(true);
  const [showTfrs, setShowTfrs]       = useState(true);
  const bboxRef   = useRef('');
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch overlays once on mount
  useEffect(() => {
    api.map.sigmets().then(d => { if (isFeatureCollection(d)) setSigmets(d); }).catch(() => {});
    api.map.tfrs().then(d => { if (isFeatureCollection(d)) setTfrs(d); }).catch(() => {});
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  function handleBbox(bbox: string) {
    bboxRef.current = bbox;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.map.metars(bboxRef.current)
        .then(d => setStations(d as MetarStation[]))
        .catch(() => {});
    }, 500);
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] relative">

      {/* ── Layer toggles ──────────────────────────────────────── */}
      <div className="absolute top-3 right-2 sm:right-12 left-2 sm:left-auto z-[1000] flex flex-wrap justify-end gap-1.5">
        <button
          onClick={() => setShowSigmets(v => !v)}
          className={`px-2.5 py-1 rounded text-xs font-semibold shadow transition-colors ${
            showSigmets
              ? 'bg-orange-500 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
          }`}
        >
          SIGMETs/AIRMETs
        </button>
        <button
          onClick={() => setShowTfrs(v => !v)}
          className={`px-2.5 py-1 rounded text-xs font-semibold shadow transition-colors ${
            showTfrs
              ? 'bg-red-500 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
          }`}
        >
          TFRs
        </button>
      </div>

      {/* ── Map ────────────────────────────────────────────────── */}
      <MapContainer
        center={[39, -96]}
        zoom={5}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents onBbox={handleBbox} />

        {/* SIGMET / AIRMET polygons */}
        {showSigmets && sigmets && (
          <GeoJSON
            key={`sigmets-${sigmets.features.length}`}
            data={sigmets}
            style={{ color: '#f97316', weight: 2, fillOpacity: 0.12 }}
          />
        )}

        {/* TFR polygons */}
        {showTfrs && tfrs && (
          <GeoJSON
            key={`tfrs-${tfrs.features.length}`}
            data={tfrs}
            style={{ color: '#ef4444', weight: 2, fillOpacity: 0.18 }}
          />
        )}

        {/* METAR station markers */}
        {stations.map(s => {
          const fr    = parseMetarFlightRules(s.rawOb ?? '');
          const color = FR_COLOR[fr] ?? '#94a3b8';
          const ceil  = s.clouds
            ?.filter(c => ['BKN', 'OVC', 'OVX'].includes(c.cover))
            ?.reduce((mn, c) => Math.min(mn, c.base), Infinity);
          return (
            <CircleMarker
              key={s.icaoId}
              center={[s.lat, s.lon]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <div style={{ minWidth: 160, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{s.icaoId}</span>
                    <span style={{ fontWeight: 700, fontSize: 11, color, background: `${color}22`, padding: '1px 6px', borderRadius: 4 }}>{fr}</span>
                  </div>
                  <div style={{ color: '#475569', lineHeight: 1.6 }}>
                    <div>Wind: {s.wdir === 'VRB' ? 'VRB' : `${String(s.wdir).padStart(3, '0')}°`} {s.wspd}kt{s.wgst ? ` G${s.wgst}` : ''}</div>
                    <div>Vis: {s.visib} SM</div>
                    {ceil !== undefined && ceil !== Infinity && <div>Ceiling: {ceil.toLocaleString()} ft</div>}
                    <div>Temp/Dew: {s.temp}°/{s.dewp}°C</div>
                  </div>
                  <button
                    onClick={() => navigate(`/weather?icao=${s.icaoId}`)}
                    style={{ marginTop: 8, fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Full briefing →
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* ── Legend ─────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2 flex flex-col gap-1">
        {Object.entries(FR_COLOR).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
