export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const jc = (jd - 2451545) / 36525;

  const l0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const mr = (m * Math.PI) / 180;
  const c =
    Math.sin(mr) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * mr) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * mr) * 0.000289;
  const sunLon = l0 + c;
  const omega = 125.04 - 1934.136 * jc;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
  const e0 =
    23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const e = e0 + 0.00256 * Math.cos((omega * Math.PI) / 180);
  const declin = Math.asin(
    Math.sin((e * Math.PI) / 180) * Math.sin((lambda * Math.PI) / 180)
  );

  const ey = Math.tan(((e / 2) * Math.PI) / 180) ** 2;
  const l0r = (l0 * Math.PI) / 180;
  const mr2 = (m * Math.PI) / 180;
  const eot =
    4 *
    (180 / Math.PI) *
    (ey * Math.sin(2 * l0r) -
      2 * 0.016708634 * Math.sin(mr2) +
      4 * 0.016708634 * ey * Math.sin(mr2) * Math.cos(2 * l0r) -
      0.5 * ey * ey * Math.sin(4 * l0r) -
      1.25 * 0.016708634 * 0.016708634 * Math.sin(2 * mr2));

  const solarNoonMin = 720 - 4 * lon - eot;

  function toDate(minutesUTC: number): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setTime(d.getTime() + minutesUTC * 60000);
    return d;
  }

  const noon = toDate(solarNoonMin);

  const zenith = 90.833;
  const haArg =
    Math.cos((zenith * Math.PI) / 180) /
      (Math.cos((lat * Math.PI) / 180) * Math.cos(declin)) -
    Math.tan((lat * Math.PI) / 180) * Math.tan(declin);

  if (haArg > 1 || haArg < -1) {
    return { sunrise: null, sunset: null, solarNoon: noon };
  }

  const ha = (Math.acos(haArg) * 180) / Math.PI;
  return {
    sunrise: toDate(solarNoonMin - 4 * ha),
    sunset: toDate(solarNoonMin + 4 * ha),
    solarNoon: noon,
  };
}

export function formatUtc(date: Date): string {
  return date.toISOString().slice(11, 16) + 'Z';
}
