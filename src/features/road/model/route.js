// Routes and stops for RoadFox: read OSRM answers, place OpenStreetMap
// places along a route, pick the best stops for each theme and split the
// drive into days. Plain functions so tests and TaskFox can use them.

import { classify, THEMES } from "../data/themes.js";
import { cumulative, locate, pointAt, sampleEvery } from "./geo.js";

const METERS_PER_MILE = 1609.344;

/** The OSRM URL for a drive through `points` ([{lat, lon}]). */
export function osrmPath(points, { alternatives = false } = {}) {
  const coords = points.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const qs = new URLSearchParams({ overview: "full", geometries: "geojson", steps: "false" });
  if (alternatives) qs.set("alternatives", "2");
  return `/route/v1/driving/${coords}?${qs}`;
}

/** OSRM's answer as [{ points, miles, minutes, legs: [{ miles, minutes }] }]. */
export function parseOsrm(body) {
  if (body?.code !== "Ok" || !Array.isArray(body.routes)) return [];
  return body.routes
    .filter(r => Array.isArray(r.geometry?.coordinates) && r.geometry.coordinates.length >= 2)
    .map(r => ({
      points: r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
      miles: r.distance / METERS_PER_MILE,
      minutes: r.duration / 60,
      legs: (r.legs ?? []).map(l => ({ miles: l.distance / METERS_PER_MILE, minutes: l.duration / 60 })),
    }));
}

/** Overpass elements as places with a theme: [{ id, name, lat, lon, theme, label, score, minutes, wiki, website }]. */
export function placesFromOsm(body) {
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const c = classify(t);
    if (!c) continue;
    // The same place is often mapped twice (a point and its building).
    const key = `${t.name.toLowerCase()}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const wiki = /^([a-z]{2,3}):(.+)$/.exec(t.wikipedia ?? "");
    out.push({
      id: `${e.type}/${e.id}`,
      name: String(t.name).slice(0, 90),
      lat,
      lon,
      ...c,
      wiki: wiki ? `https://${wiki[1]}.wikipedia.org/wiki/${encodeURIComponent(wiki[2].replace(/ /g, "_"))}` : null,
      website: /^https?:\/\//.test(t.website ?? "") ? t.website : null,
      town: t["addr:city"] ? String(t["addr:city"]).slice(0, 40) : null,
    });
  }
  return out;
}

/** Each place's spot on the route: adds { mile, off } and drops ones too far away. */
export function placeAlong(places, route, maxOff = 20) {
  const cum = cumulative(route.points);
  const samples = sampleEvery(route.points, cum, Math.max(1, cum[cum.length - 1] / 600));
  return places
    .map(p => ({ ...p, ...locate(samples, p) }))
    .filter(p => p.off <= maxOff)
    .map(p => ({ ...p, mile: Math.round(p.mile * 10) / 10, off: Math.round(p.off * 10) / 10 }));
}

/** How many stops a themed route gets for a drive this long. */
export function stopCount(totalMiles) {
  if (totalMiles < 60) return 1;
  return Math.max(2, Math.min(6, Math.round(totalMiles / 170)));
}

/**
 * The best stops for a theme, spread out along the route: the route is cut
 * into equal stretches and each stretch gets its best place, skipping the
 * first and last few miles (you just left; you're nearly there).
 */
export function pickStops(placed, theme, totalMiles, count = stopCount(totalMiles)) {
  const pool = placed.filter(p => p.theme === theme);
  const edge = Math.min(15, totalMiles * 0.06);
  const span = totalMiles - 2 * edge;
  if (span <= 0) return [];
  const value = p => p.score - p.off * 0.35;
  const picks = [];
  for (let i = 0; i < count; i++) {
    const from = edge + (span * i) / count;
    const to = edge + (span * (i + 1)) / count;
    const best = pool.filter(p => p.mile >= from && p.mile < to).sort((a, b) => value(b) - value(a))[0];
    if (best) picks.push(best);
  }
  return picks;
}

/** Minutes of driving to reach `mile` on a route, using each leg's own pace. */
export function minutesAt(route, mile) {
  let m = 0;
  let t = 0;
  for (const leg of route.legs?.length ? route.legs : [{ miles: route.miles, minutes: route.minutes }]) {
    if (mile <= m + leg.miles) return t + (leg.miles ? ((mile - m) / leg.miles) * leg.minutes : 0);
    m += leg.miles;
    t += leg.minutes;
  }
  return t;
}

/**
 * Split a drive into days of at most `hoursPerDay` behind the wheel. Stops
 * (with .mile and .minutes on this route) happen on the day you reach them
 * and don't count toward driving time. Returns [{ index, fromMile, toMile,
 * driveMinutes, stopMinutes, stops, end: {lat, lon} | null }]; end is the
 * overnight spot, null on the last day.
 */
export function splitDays(route, stops = [], hoursPerDay = 8) {
  const cap = Math.max(2, Math.min(14, hoursPerDay)) * 60;
  const cum = cumulative(route.points);
  const total = route.miles;
  const sorted = [...stops].filter(s => Number.isFinite(s.mile)).sort((a, b) => a.mile - b.mile);
  const days = [];
  let fromMile = 0;
  let fromMin = 0;
  let si = 0;
  while (fromMile < total - 0.5 && days.length < 30) {
    const endMin = fromMin + cap;
    let toMile;
    if (minutesAt(route, total) <= endMin + 20) toMile = total; // close enough: finish today
    else {
      let lo = fromMile;
      let hi = total;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (minutesAt(route, mid) <= endMin) lo = mid;
        else hi = mid;
      }
      toMile = Math.max(lo, fromMile + 1);
    }
    const dayStops = [];
    while (si < sorted.length && sorted[si].mile <= toMile + 0.01) dayStops.push(sorted[si++]);
    const last = toMile >= total;
    days.push({
      index: days.length,
      fromMile: Math.round(fromMile),
      toMile: Math.round(toMile),
      driveMinutes: Math.round(minutesAt(route, toMile) - fromMin),
      stopMinutes: dayStops.reduce((s, p) => s + (p.minutes ?? 45), 0),
      stops: dayStops,
      end: last ? null : pointAt(route.points, cum, toMile),
    });
    fromMin = minutesAt(route, toMile);
    fromMile = toMile;
  }
  return days;
}

/** The themes a trip can be built around (all but fastest). */
export const STOP_THEMES = THEMES.filter(t => t.id !== "fastest").map(t => t.id);
