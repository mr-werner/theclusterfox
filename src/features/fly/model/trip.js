// PilotFox trip helpers: where you are at a given moment of a planned
// flight, which airports along the way are realistic places to land, and
// what the forecast says you'll fly through. Plain functions, tested in
// tests/validate.mjs.

import { courseDeg, distanceNm, interpolate } from "./nav.js";

const RAD = Math.PI / 180;

/** The point (and course) alongNm along a route of waypoints. */
export function pointAlong(waypoints, alongNm) {
  if (!waypoints.length) return null;
  let left = Math.max(0, alongNm);
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const d = distanceNm(a, b);
    if (left <= d || i === waypoints.length - 2) {
      const f = d ? Math.min(1, left / d) : 0;
      return { ...interpolate(a, b, f), course: courseDeg(a, b), leg: i };
    }
    left -= d;
  }
  const last = waypoints[waypoints.length - 1];
  return { lat: last.lat, lon: last.lon, course: 0, leg: 0 };
}

/** When (ms) a plan reaches alongNm, from its flown pieces. */
export function timeAtAlong(plan, alongNm) {
  const pieces = plan?.pieces ?? [];
  if (!pieces.length) return null;
  for (const p of pieces) {
    if (alongNm <= p.alongNm + p.dist) {
      const f = p.dist ? Math.max(0, (alongNm - p.alongNm) / p.dist) : 0;
      return p.from + f * p.minutes * 60000;
    }
  }
  const last = pieces[pieces.length - 1];
  return last.from + last.minutes * 60000;
}

/** How far along (nm) a plan is at a moment (ms). */
export function alongAtTime(plan, when) {
  const pieces = plan?.pieces ?? [];
  if (!pieces.length) return 0;
  if (when <= pieces[0].from) return 0;
  for (const p of pieces) {
    const end = p.from + p.minutes * 60000;
    if (when <= end) return p.alongNm + (p.minutes ? ((when - p.from) / (p.minutes * 60000)) * p.dist : 0);
  }
  const last = pieces[pieces.length - 1];
  return last.alongNm + last.dist;
}

// ---------------------------------------------------------------------------
// Realistic places to land

const PAVED = new Set(["Asphalt", "Concrete", "Paved", "Hard"]);
const SOFT_OK = new Set(["Turf", "Grass", "Gravel", "Dirt"]);

// A comfortable runway for each preset (ground roll plus clearing a 50 ft
// obstacle, with a safety margin), at sea level.
const RUNWAY_BASE = { c152: 2400, c172: 2800, pa28: 2800, sr22: 3400, da40: 2800, lsa: 2000 };

/** The runway length (ft) this aircraft should want at a field elevation. */
export function runwayNeedFt(aircraft, elevFt = 0) {
  const tas = aircraft?.tas ?? 120;
  const base = RUNWAY_BASE[aircraft?.id] ?? (tas < 110 ? 2400 : tas < 145 ? 2800 : tas < 200 ? 3500 : 5000);
  // Thinner air at high fields: about 10% more runway for each 1,000 ft above 1,000.
  const factor = 1 + Math.max(0, (elevFt ?? 0) - 1000) / 10000;
  return Math.round((base * factor) / 100) * 100;
}

/**
 * Whether an airport (from parseAirports) is a realistic place to land.
 * Returns { level: "good" | "ok" | "short" | "no", longestFt, paved, needFt, notes }.
 *   good   public, long enough, paved, has fuel
 *   ok     public and long enough, but no fuel or not paved
 *   short  runway shorter than this aircraft should want
 *   no     military, private, or a heliport only
 */
export function assessLanding(airport, aircraft) {
  const needFt = runwayNeedFt(aircraft, airport?.elevFt ?? 0);
  if (!airport) return { level: "unknown", longestFt: null, paved: false, needFt, notes: [] };
  const name = `${airport.name ?? ""}`;
  if (airport.owner === "M" || /\b(AFB|air force|space force|army|naval|NAS|joint base|air national guard)\b/i.test(name)) {
    return { level: "no", longestFt: null, paved: false, needFt, notes: ["Military field: no landing without permission"] };
  }
  if (airport.owner === "R") return { level: "no", longestFt: null, paved: false, needFt, notes: ["Private field: prior permission required"] };
  const runways = (airport.runways ?? []).filter(r => r.lengthFt && !/^H\d*/i.test(r.id) && r.surface !== "Water");
  if (!runways.length) return { level: "no", longestFt: null, paved: false, needFt, notes: ["No runway listed"] };
  const paved = runways.filter(r => PAVED.has(r.surface));
  const usable = paved.length ? paved : runways.filter(r => SOFT_OK.has(r.surface) || !PAVED.has(r.surface));
  const best = usable.reduce((b, r) => (r.lengthFt > (b?.lengthFt ?? 0) ? r : b), null);
  const longestFt = best?.lengthFt ?? null;
  const isPaved = paved.length > 0;
  const notes = [];
  if (!longestFt || longestFt < needFt) {
    return { level: "short", longestFt, paved: isPaved, needFt, notes: [`Longest runway ${longestFt?.toLocaleString() ?? "?"} ft, you'd want about ${needFt.toLocaleString()} ft`] };
  }
  if (!isPaved) notes.push(`${best.surface} runway`);
  if (airport.fuel === false) notes.push("No fuel listed");
  return { level: isPaved && airport.fuel !== false ? "good" : "ok", longestFt, paved: isPaved, needFt, notes };
}

const LEVEL_SCORE = { good: 0, ok: 25, unknown: 35, short: 200, no: 400 };
const CAT_SCORE = { VFR: 0, MVFR: 10, IFR: 40, LIFR: 80 };

/** A score for a landing spot: lower is better. */
export function landingScore(spot) {
  return (
    (LEVEL_SCORE[spot.landing?.level] ?? 35) +
    (CAT_SCORE[spot.category] ?? 15) +
    (spot.offNm ?? 0) * 1.2 -
    Math.min(15, ((spot.landing?.longestFt ?? 0) - (spot.landing?.needFt ?? 0)) / 400) -
    (spot.towered ? 3 : 0)
  );
}

/**
 * About one realistic stop for every stretch of the route: splits the route
 * into equal stretches (at most `max`) and keeps the best spot in each.
 * Skips the first and last few miles (that's where you take off and land).
 */
export function pickLandingSpots(spots, totalNm, { max = 8, edgeNm = 15 } = {}) {
  const usable = spots.filter(s => (s.landing?.level === "good" || s.landing?.level === "ok") && s.alongNm > edgeNm && s.alongNm < totalNm - edgeNm);
  if (!usable.length) return [];
  const count = Math.max(1, Math.min(max, Math.round(totalNm / 45)));
  const span = totalNm / count;
  const out = [];
  for (let i = 0; i < count; i++) {
    const inside = usable.filter(s => s.alongNm >= i * span && s.alongNm < (i + 1) * span);
    if (!inside.length) continue;
    out.push(inside.reduce((b, s) => (landingScore(s) < landingScore(b) ? s : b)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weather along the trip

/**
 * Forecast points for the route corridor: the center line every stepNm,
 * plus a point offsetNm either side of it. Each point: { lat, lon, alongNm, side }.
 */
export function corridorGrid(samples, offsetNm = 30) {
  const out = [];
  samples.forEach((s, i) => {
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const prev = samples[Math.max(0, i - 1)];
    const course = next === prev ? 0 : courseDeg(prev, next);
    out.push({ lat: s.lat, lon: s.lon, alongNm: s.alongNm, side: 0 });
    if (offsetNm > 0) {
      for (const side of [-1, 1]) {
        const brg = (course + side * 90) * RAD;
        const dLat = (offsetNm / 60) * Math.cos(brg);
        const dLon = ((offsetNm / 60) * Math.sin(brg)) / Math.max(0.2, Math.cos(s.lat * RAD));
        out.push({ lat: s.lat + dLat, lon: s.lon + dLon, alongNm: s.alongNm, side });
      }
    }
  });
  return out;
}

/**
 * Reads one Open-Meteo hourly block (unixtime) into
 * [{ t (ms), precipMm, precipProb, code, cloudLow, cloud, visM, gustKt, cape, freezingFt, tempC }].
 */
export function parseRouteHours(item) {
  const h = item?.hourly;
  if (!h?.time) return [];
  const at = (k, i) => (Array.isArray(h[k]) && Number.isFinite(h[k][i]) ? h[k][i] : null);
  return h.time.map((t, i) => ({
    t: t * 1000,
    precipMm: at("precipitation", i),
    precipProb: at("precipitation_probability", i),
    code: at("weather_code", i),
    cloudLow: at("cloud_cover_low", i),
    cloud: at("cloud_cover", i),
    visM: at("visibility", i),
    gustKt: at("wind_gusts_10m", i) === null ? null : at("wind_gusts_10m", i) * 1.94384,
    cape: at("cape", i),
    freezingFt: at("freezing_level_height", i) === null ? null : at("freezing_level_height", i) * 3.28084,
    tempC: at("temperature_2m", i),
  }));
}

/** The forecast hour nearest a moment, or null when the forecast doesn't reach it. */
export function hourAt(hours, when) {
  if (!hours?.length) return null;
  let best = null;
  for (const h of hours) if (!best || Math.abs(h.t - when) < Math.abs(best.t - when)) best = h;
  return Math.abs(best.t - when) <= 90 * 60000 ? best : null;
}

const SNOW = new Set([71, 73, 75, 77, 85, 86]);

/**
 * What a forecast hour means for a small plane at a cruise altitude.
 * Returns { level 0-3, label, flags: [string] }:
 *   0 good flying, 1 clouds or a bit of wind, 2 rain, low clouds or poor
 *   visibility, 3 thunderstorms, snow, freezing rain or likely icing.
 */
export function flyingWeather(hour, altitudeFt) {
  if (!hour) return { level: null, label: "No forecast", flags: [] };
  const flags = [];
  let level = 0;
  const bump = (n, text) => {
    level = Math.max(level, n);
    flags.push(text);
  };
  const code = hour.code ?? 0;
  const wet = (hour.precipMm ?? 0) >= 0.2 || (code >= 51 && code <= 99);
  if (code >= 95) bump(3, "Thunderstorms");
  else if ((hour.cape ?? 0) >= 1000 && wet) bump(3, "Storms could build");
  if (code === 56 || code === 57 || code === 66 || code === 67) bump(3, "Freezing rain");
  if (SNOW.has(code)) bump(3, "Snow");
  if (wet && level < 3) bump(2, (hour.precipMm ?? 0) >= 2.5 ? "Heavy rain" : "Rain");
  if (hour.freezingFt !== null && hour.freezingFt <= altitudeFt && ((hour.cloud ?? 0) >= 70 || wet)) bump(3, "Icing risk at your altitude");
  if (code === 45 || code === 48 || (hour.visM !== null && hour.visM < 5000)) bump(2, "Poor visibility");
  if ((hour.cloudLow ?? 0) >= 70) bump(2, "Low clouds");
  else if ((hour.cloud ?? 0) >= 85) bump(1, "Overcast");
  else if ((hour.cloud ?? 0) >= 50) bump(1, "Cloudy");
  if ((hour.gustKt ?? 0) >= 30) bump(2, `Gusts ${Math.round(hour.gustKt)} kt`);
  else if ((hour.gustKt ?? 0) >= 20) bump(1, `Gusts ${Math.round(hour.gustKt)} kt`);
  const label = flags[0] ?? ((hour.cloud ?? 0) < 25 ? "Clear" : "Fair");
  return { level, label, flags };
}

/**
 * What you'd fly through: for each center-line point, the forecast at the
 * time you get there. Joins neighbors with the same worst flag into stretches:
 * [{ fromNm, toNm, fromAt, toAt, level, label, flags }].
 */
export function weatherStretches(points, { plan, altitudeFt }) {
  const rows = points
    .filter(p => p.side === 0)
    .map(p => {
      const at = timeAtAlong(plan, p.alongNm);
      return { alongNm: p.alongNm, at, ...flyingWeather(hourAt(p.hours, at), altitudeFt) };
    });
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.level === r.level && last.label === r.label) {
      last.toNm = r.alongNm;
      last.toAt = r.at;
      for (const f of r.flags) if (!last.flags.includes(f)) last.flags.push(f);
    } else out.push({ fromNm: r.alongNm, toNm: r.alongNm, fromAt: r.at, toAt: r.at, level: r.level, label: r.label, flags: [...r.flags] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Things to do near an airport

const KIND = [
  [/museum|gallery/i, "Museum"],
  [/park|garden|nature|reserve|forest|lake|river|canyon|trail|falls|mountain|peak|beach/i, "Outdoors"],
  [/restaurant|cafe|diner|bar|brew|winery|food|pub|bakery|ice_cream|fast_food/i, "Food"],
  [/hotel|motel|inn|lodge|guest_house|hostel|resort|camp/i, "Stay"],
  [/viewpoint|attraction|monument|memorial|historic|castle|ruins|landmark|tower|bridge/i, "Sight"],
  [/zoo|aquarium|theme_park|amusement|water_park/i, "Family"],
];

/** A short kind for a place from its tags or description. */
export function placeKind(text) {
  for (const [re, kind] of KIND) if (re.test(text ?? "")) return kind;
  return "Place";
}

/** Places from OpenStreetMap (Overpass) near an airport. */
export function placesFromOverpass(body, from) {
  return (body?.elements ?? [])
    .map(e => {
      const t = e.tags ?? {};
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      const what = [t.tourism, t.amenity, t.leisure, t.historic].filter(Boolean).join(" ");
      return {
        id: `osm-${e.type}/${e.id}`,
        name: t.name,
        lat,
        lon,
        kind: placeKind(what),
        detail: (t.cuisine ? `${t.cuisine.replace(/_/g, " ").replace(/;/g, ", ")} ` : "") + (what.replace(/_/g, " ").split(" ")[0] ?? ""),
        url: t.website ?? t["contact:website"] ?? null,
        distNm: Number.isFinite(lat) ? distanceNm(from, { lat, lon }) : null,
      };
    })
    .filter(p => p.name && p.distNm !== null);
}

/** Places from Wikipedia's nearby-articles search near an airport. */
export function placesFromWikipedia(body, from, { skipName = "" } = {}) {
  const skip = skipName.toLowerCase().split(/[\s/,-]+/).filter(w => w.length > 3);
  return Object.values(body?.query?.pages ?? {})
    .map(p => {
      const c = p.coordinates?.[0];
      const desc = p.description ?? "";
      return {
        id: `wiki-${p.pageid}`,
        name: p.title,
        lat: c?.lat,
        lon: c?.lon,
        kind: placeKind(`${p.title} ${desc}`),
        detail: desc,
        url: p.fullurl ?? `https://en.wikipedia.org/?curid=${p.pageid}`,
        thumb: p.thumbnail?.source ?? null,
        distNm: c ? distanceNm(from, { lat: c.lat, lon: c.lon }) : null,
      };
    })
    .filter(p => p.distNm !== null)
    // The airport's own article, and schools, churches and roads, aren't things to do.
    .filter(p => !/airport|airfield|school|church|highway|interstate|route \d|station\b|census|unincorporated|post office|radio|tv\b|television/i.test(`${p.name} ${p.detail}`))
    .filter(p => !(skip.length && skip.every(w => p.name.toLowerCase().includes(w))));
}

/** Merge both sources, drop near-duplicates, food near the field first, then the rest by distance. */
export function mergePlaces(lists, { max = 14 } = {}) {
  const seen = new Set();
  const all = lists.flat().filter(p => {
    if (!(p.distNm <= 15)) return false;
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const food = all.filter(p => p.kind === "Food").sort((a, b) => a.distNm - b.distNm).slice(0, 4);
  const rest = all.filter(p => p.kind !== "Food").sort((a, b) => (a.thumb ? 0 : 1) - (b.thumb ? 0 : 1) || a.distNm - b.distNm);
  return [...food, ...rest].slice(0, max);
}
