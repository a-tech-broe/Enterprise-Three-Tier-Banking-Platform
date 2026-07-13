export interface Chart {
  code: string;
  name: string;
  pdfUrl: string;
}

// AIRAC cycle 01 effective dates per year (Jan start date)
const CYCLE_01_STARTS: Record<number, string> = {
  2024: '2024-01-18',
  2025: '2025-01-23',
  2026: '2026-01-22',
  2027: '2027-01-21',
  2028: '2028-01-20',
};

function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();

  for (let y = year; y >= year - 1; y--) {
    const startStr = CYCLE_01_STARTS[y];
    if (!startStr) continue;
    const start = new Date(startStr);
    if (start > now) continue;
    const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const cycleNum = Math.floor(days / 28) + 1;
    return `${String(y).slice(-2)}${String(cycleNum).padStart(2, '0')}`;
  }
  return '2604';
}

function previousCycle(cycle: string): string {
  const yy = parseInt(cycle.slice(0, 2), 10);
  const nn = parseInt(cycle.slice(2), 10);
  if (nn > 1) return `${String(yy).padStart(2, '0')}${String(nn - 1).padStart(2, '0')}`;
  // Go to last cycle of previous year — calculate how many 28-day periods fit
  const prevYy = yy - 1;
  const prevKey = 2000 + prevYy;
  const curKey  = 2000 + yy;
  const prevStart = CYCLE_01_STARTS[prevKey];
  const curStart  = CYCLE_01_STARTS[curKey];
  if (prevStart && curStart) {
    const days = Math.round(
      (new Date(curStart).getTime() - new Date(prevStart).getTime()) / 86400000
    );
    const numCycles = Math.floor(days / 28);
    return `${String(prevYy).padStart(2, '0')}${String(numCycles).padStart(2, '0')}`;
  }
  return `${String(prevYy).padStart(2, '0')}13`;
}

let cachedCycle = '';
let cachedXml = '';
const chartCache = new Map<string, Chart[]>();

async function tryFetchXml(cycle: string): Promise<string | null> {
  const url = `https://aeronav.faa.gov/d-tpp/${cycle}/xml_data/d-TPP_Metafile.xml`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`[charts] cycle ${cycle} returned HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[charts] cycle ${cycle} fetch error:`, err);
    return null;
  }
}

async function ensureXml(cycle: string): Promise<{ xml: string; cycle: string }> {
  if (cachedCycle === cycle && cachedXml) return { xml: cachedXml, cycle };

  let xml = await tryFetchXml(cycle);
  let usedCycle = cycle;

  if (!xml) {
    const prev = previousCycle(cycle);
    xml = await tryFetchXml(prev);
    usedCycle = prev;
  }

  if (!xml) throw new Error(`d-TPP index unavailable for cycle ${cycle}`);

  cachedXml = xml;
  cachedCycle = usedCycle;
  chartCache.clear();
  return { xml, cycle: usedCycle };
}

function parseCharts(xml: string, icao: string, cycle: string): Chart[] {
  const upper = icao.toUpperCase();
  // FAA d-TPP XML uses <airport_name> (not <airport>).
  // ID attribute holds the local/FAA id without the K/P/A prefix (e.g. "MIA" for KMIA).
  const localId = upper.replace(/^[KPA]/, '');

  // Try all combinations: tag variant × attribute variant
  const attempts = [
    new RegExp(`<airport_name[^>]+icao_ident="${upper}"[^>]*>([\\s\\S]*?)<\\/airport_name>`, 'i'),
    new RegExp(`<airport[^>]+icao_ident="${upper}"[^>]*>([\\s\\S]*?)<\\/airport>`, 'i'),
    new RegExp(`<airport_name[^>]*\\bID="${localId}"[^>]*>([\\s\\S]*?)<\\/airport_name>`, 'i'),
    new RegExp(`<airport[^>]*\\bID="${localId}"[^>]*>([\\s\\S]*?)<\\/airport>`, 'i'),
    new RegExp(`<airport_name[^>]*\\bID="${upper}"[^>]*>([\\s\\S]*?)<\\/airport_name>`, 'i'),
    new RegExp(`<airport[^>]*\\bID="${upper}"[^>]*>([\\s\\S]*?)<\\/airport>`, 'i'),
  ];

  let airportMatch: RegExpMatchArray | null = null;
  for (const re of attempts) {
    airportMatch = xml.match(re);
    if (airportMatch) break;
  }

  if (!airportMatch) return [];

  const section = airportMatch[1];
  const charts: Chart[] = [];
  const recordRe = /<record>([\s\S]*?)<\/record>/gi;
  let m: RegExpExecArray | null;

  while ((m = recordRe.exec(section)) !== null) {
    const rec = m[1];
    const tag = (t: string) => {
      const tm = rec.match(new RegExp(`<${t}>([^<]*)<\\/${t}>`));
      return tm ? tm[1].trim() : '';
    };
    const code = tag('chart_code');
    const name = tag('chart_name');
    const pdf  = tag('pdf_name');
    if (code && name && pdf) {
      charts.push({ code, name, pdfUrl: `https://aeronav.faa.gov/d-tpp/${cycle}/${pdf}` });
    }
  }

  return charts;
}

export async function getAirportCharts(icao: string): Promise<{ charts: Chart[]; cycle: string }> {
  const upper = icao.toUpperCase();
  const cycle = getCurrentCycle();
  const key   = `${cycle}:${upper}`;

  const cached = chartCache.get(key);
  if (cached && cached.length > 0) {
    return { charts: cached, cycle };
  }

  const { xml, cycle: usedCycle } = await ensureXml(cycle);
  const charts = parseCharts(xml, upper, usedCycle);
  chartCache.set(key, charts);
  return { charts, cycle: usedCycle };
}
