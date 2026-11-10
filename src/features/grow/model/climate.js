// Local growing climate from ten years of daily weather. Plain functions,
// testable in Node.
//
// - Hardiness zone: USDA zones are 10°F bands of the average coldest night
//   of the year (zone 1a starts at -60°F); a and b split each band in half.
// - Frost dates: the median last spring night and first fall night at or
//   below 32°F (0°C), the threshold extension services use. If fewer than
//   half the years had a frost, the place counts as frost free.
// - Southern hemisphere: spring frosts fall in July–December and fall
//   frosts in January–June, so the seasons are read the other way round.
//
// Daily data comes from ERA5 reanalysis via Open-Meteo, which smooths
// extremes over a ~10 km grid: valleys and frost pockets run colder, so the
// app lets people nudge their zone.

import { fromDoy, doyOf, yearOf, monthOf } from "./dates.js";

export const FROST_C = 0;

export function zoneFromMinF(minF) {
  const band = (minF + 60) / 10;
  let whole = Math.floor(band) + 1;
  let b = band - Math.floor(band) >= 0.5;
  if (whole < 1) [whole, b] = [1, false];
  if (whole > 13) [whole, b] = [13, true];
  return { zone: whole + (b ? 0.5 : 0), label: `${whole}${b ? "b" : "a"}` };
}
export const zoneLabel = zone => `${Math.floor(zone)}${zone % 1 ? "b" : "a"}`;
export const cToF = c => (c * 9) / 5 + 32;
export const zoneRangeF = zone => {
  const low = -60 + (Math.floor(zone) - 1) * 10 + (zone % 1 ? 5 : 0);
  return [low, low + 5];
};

const median = list => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * series: { time: [day numbers], tmin: [°C], tmax: [°C], rain: [mm] }
 * Returns the climate summary GrowFox plans with.
 */
export function computeClimate(series, latitude) {
  const hemisphere = latitude < 0 ? "S" : "N";
  const byYear = new Map();
  series.time.forEach((day, i) => {
    const y = yearOf(day);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push({ day, doy: doyOf(day), month: monthOf(day), tmin: series.tmin[i], tmax: series.tmax[i], rain: series.rain[i] ?? 0 });
  });
  const years = [...byYear.keys()].sort((a, b) => a - b).filter(y => byYear.get(y).length >= 330);
  if (!years.length) return null;

  // Coldest night of each year.
  const mins = years.map(y => Math.min(...byYear.get(y).map(d => d.tmin).filter(Number.isFinite)));
  const avgMinC = mins.reduce((a, b) => a + b, 0) / mins.length;
  const { zone } = zoneFromMinF(cToF(avgMinC));

  // Frost dates by season.
  const springs = [];
  const falls = [];
  let frostYears = 0;
  for (let i = 0; i < years.length; i++) {
    const days = byYear.get(years[i]);
    const frosty = d => Number.isFinite(d.tmin) && d.tmin <= FROST_C;
    if (hemisphere === "N") {
      const spring = days.filter(d => d.doy < 183 && frosty(d)).map(d => d.doy);
      const fall = days.filter(d => d.doy >= 183 && frosty(d)).map(d => d.doy);
      if (spring.length) springs.push(Math.max(...spring));
      if (fall.length) falls.push(Math.min(...fall));
      if (spring.length || fall.length) frostYears++;
    } else {
      // Spring is July–December; the fall after it is January–June of next year.
      const spring = days.filter(d => d.doy >= 183 && frosty(d)).map(d => d.doy);
      if (spring.length) springs.push(Math.max(...spring));
      const next = byYear.get(years[i + 1]);
      if (next) {
        const fall = next.filter(d => d.doy < 183 && frosty(d)).map(d => d.doy);
        if (fall.length) falls.push(Math.min(...fall));
      }
      const early = days.filter(d => d.doy < 183 && frosty(d));
      if (spring.length || early.length) frostYears++;
    }
  }
  const frostless = frostYears < years.length / 2 || !springs.length || !falls.length;
  const lastFrost = frostless ? null : median(springs);
  const firstFrost = frostless ? null : median(falls);
  const frostFree = frostless ? 365 : hemisphere === "N" ? firstFrost - lastFrost : firstFrost + 365 - lastFrost;

  // Monthly averages.
  const monthly = Array.from({ length: 12 }, (_, m) => {
    const ds = years.flatMap(y => byYear.get(y).filter(d => d.month === m));
    const avg = key => ds.reduce((a, d) => a + (Number.isFinite(d[key]) ? d[key] : 0), 0) / Math.max(1, ds.length);
    return { hi: round1(avg("tmax")), lo: round1(avg("tmin")), rain: Math.round((ds.reduce((a, d) => a + (d.rain || 0), 0) / years.length)) };
  });
  return finish({
    source: "data",
    years: years.length,
    hemisphere,
    latitude,
    zone,
    avgMinC: round1(avgMinC),
    lastFrost,
    firstFrost,
    frostFree,
    frostless,
    monthly,
  });
}

const round1 = n => Math.round(n * 10) / 10;

function finish(c) {
  const byHeat = c.monthly ? [...c.monthly].sort((a, b) => b.hi - a.hi) : null;
  return {
    ...c,
    summerHigh: byHeat ? byHeat[0].hi : null,
    summerRain: byHeat ? Math.round((byHeat[0].rain + byHeat[1].rain + byHeat[2].rain) / 3) : null,
    annualRain: c.monthly ? c.monthly.reduce((a, m) => a + m.rain, 0) : null,
  };
}

// Typical frost dates by zone for when there's no weather data (northern
// hemisphere day of year). Rounded from NOAA 1991–2020 normals for US
// stations, as published by extension services.
const ZONE_FROSTS = {
  1: [166, 228], 2: [155, 238], 3: [141, 258], 4: [131, 268], 5: [120, 283],
  6: [110, 293], 7: [96, 304], 8: [79, 319], 9: [51, 339],
};
const ZONE_SUMMER_HIGH = { 1: 20, 2: 22, 3: 25, 4: 27, 5: 28, 6: 30, 7: 31, 8: 33, 9: 33, 10: 32, 11: 31, 12: 31, 13: 31 };

export function climateFromZone(zone, hemisphere = "N") {
  const whole = Math.max(1, Math.min(13, Math.floor(zone)));
  const frosts = ZONE_FROSTS[whole];
  const shift = d => (hemisphere === "S" ? ((d + 182 - 1) % 365) + 1 : d);
  const lastFrost = frosts ? shift(frosts[0]) : null;
  const firstFrost = frosts ? shift(frosts[1]) : null;
  return finish({
    source: "zone",
    hemisphere,
    latitude: null,
    zone,
    lastFrost,
    firstFrost,
    frostless: !frosts,
    frostFree: frosts ? frosts[1] - frosts[0] : 365,
    monthly: null,
    summerHigh: ZONE_SUMMER_HIGH[whole],
    summerRain: null,
    annualRain: null,
  });
}

// The climate GrowFox works from: weather data with the person's zone
// nudge applied, or a zone-only estimate.
export function effectiveClimate(data) {
  const base = data.climate ?? (data.manualZone ? climateFromZone(data.manualZone, data.hemisphere ?? "N") : null);
  if (!base) return null;
  if (data.zoneShift && base.source === "data") {
    // A colder or warmer garden than the grid: move the zone and frost dates
    // about two weeks per half zone.
    const z = Math.max(1, Math.min(13, base.zone + data.zoneShift));
    const days = -data.zoneShift * 2 * 12;
    if (base.frostless) return { ...base, zone: z, shifted: true };
    return {
      ...base,
      zone: z,
      shifted: true,
      lastFrost: wrapDoy(base.lastFrost + days),
      firstFrost: wrapDoy(base.firstFrost - days),
      frostFree: Math.max(30, base.frostFree - days * 2),
    };
  }
  return base;
}
const wrapDoy = d => ((d - 1 + 365) % 365) + 1;

/**
 * The growing season that starts in a calendar year: last spring frost (lf),
 * first fall frost (ff), as day numbers. Frost-free places get a nominal
 * season so planting windows still make sense: warm crops go in late winter
 * and cool crops through fall and winter.
 */
export function seasonFor(climate, year) {
  if (climate.frostless) {
    const lfDoy = climate.hemisphere === "S" ? 213 : 32; // Aug 1 / Feb 1
    const lf = fromDoy(year, lfDoy);
    return { lf, ff: lf + 320, length: 320, frostless: true };
  }
  const lf = fromDoy(year, climate.lastFrost);
  const ff = lf + climate.frostFree;
  return { lf, ff, length: climate.frostFree, frostless: false };
}

export const seasonsAround = (climate, year) => [year - 1, year, year + 1].map(y => seasonFor(climate, y));

// A short plain-language read of the climate.
export function describeClimate(c, units = "us") {
  if (!c) return null;
  const temp = v => (units === "metric" ? `${Math.round(v)}°C` : `${Math.round(cToF(v))}°F`);
  const bits = [];
  if (c.summerHigh != null) bits.push(`summer highs around ${temp(c.summerHigh)}`);
  if (c.summerRain != null) bits.push(c.summerRain < 25 ? "dry summers" : c.summerRain > 110 ? "wet summers" : "some summer rain");
  return bits.join(", ");
}

export const monthOfDoy = doy => monthOf(fromDoy(2025, doy));
