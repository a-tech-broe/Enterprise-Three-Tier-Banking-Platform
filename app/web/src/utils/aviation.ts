export function densityAltitude(elevFt: number, altimInHg: number, oatC: number): number {
  const pressureAlt = elevFt + (29.92 - altimInHg) * 1000;
  const isaC = 15 - 2 * (pressureAlt / 1000);
  return Math.round(pressureAlt + 120 * (oatC - isaC));
}

export interface FreqEntry {
  type: string;
  freq: string;
}

export function parseFrequencies(freqStr: string): FreqEntry[] {
  if (!freqStr) return [];
  return freqStr
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m =
        line.match(/^([A-Z][A-Z/\s]*?)\s+([\d.]+)\s*MHz?$/i) ??
        line.match(/^([A-Z][A-Z/\s]*?)\s+([\d.]+)$/i);
      if (m) return { type: m[1].trim(), freq: m[2].trim() };
      return { type: line, freq: '' };
    });
}

export function flightRulesColor(category: string): string {
  switch (category) {
    case 'VFR':  return 'text-green-600 dark:text-green-400';
    case 'MVFR': return 'text-blue-600 dark:text-blue-400';
    case 'IFR':  return 'text-red-600 dark:text-red-400';
    case 'LIFR': return 'text-purple-600 dark:text-purple-400';
    default:     return 'text-slate-500';
  }
}

function parseFraction(s: string): number {
  const parts = s.split('/');
  if (parts.length === 2) return parseInt(parts[0]) / parseInt(parts[1]);
  return parseFloat(s);
}

export function parseMetarFlightRules(metar: string): string {
  const skyMatch = metar.match(/\b(FEW|SCT|BKN|OVC)\d{3}\b/g) ?? [];
  const visMatch = metar.match(/\b(\d+(?:\/\d+)?)\s*SM\b/);
  const visSm = visMatch ? parseFraction(visMatch[1]) : 10;

  let ceilingFt = Infinity;
  for (const layer of skyMatch) {
    const m = layer.match(/(BKN|OVC)(\d{3})/);
    if (m) ceilingFt = Math.min(ceilingFt, parseInt(m[2]) * 100);
  }

  if (visSm < 1 || ceilingFt < 500) return 'LIFR';
  if (visSm < 3 || ceilingFt < 1000) return 'IFR';
  if (visSm < 5 || ceilingFt < 3000) return 'MVFR';
  return 'VFR';
}
