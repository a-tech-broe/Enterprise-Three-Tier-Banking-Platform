function parseFractionSm(s: string): number {
  if (s.includes('/')) {
    const [n, d] = s.split('/').map(Number);
    return n / d;
  }
  return parseFloat(s);
}

export function parseFlightRules(metar: string): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  if (!metar) return 'VFR';

  let visSm = 10;
  const visMixed = metar.match(/\b(\d+)\s+(\d+)\/(\d+)SM\b/);
  const visFrac  = metar.match(/\bM?(\d+\/\d+)SM\b/);
  const visFull  = metar.match(/\bM?(\d+(?:\.\d+)?)SM\b/);
  if (visMixed) visSm = parseInt(visMixed[1]) + parseInt(visMixed[2]) / parseInt(visMixed[3]);
  else if (visFrac) visSm = parseFractionSm(visFrac[1]);
  else if (visFull) visSm = parseFloat(visFull[1]);

  let ceilingFt = Infinity;
  const ceilRe = /\b(BKN|OVC|OVX)(\d{3})\b/g;
  let cm: RegExpExecArray | null;
  while ((cm = ceilRe.exec(metar)) !== null) {
    ceilingFt = Math.min(ceilingFt, parseInt(cm[2], 10) * 100);
  }

  if (ceilingFt < 500  || visSm < 1) return 'LIFR';
  if (ceilingFt < 1000 || visSm < 3) return 'IFR';
  if (ceilingFt < 3000 || visSm < 5) return 'MVFR';
  return 'VFR';
}
