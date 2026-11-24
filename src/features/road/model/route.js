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

/** Rest breaks on a day: 15 minutes for every two hours of driving that a stop doesn't already cover. */
export function breakMinutes(driveMinutes, stopCount = 0) {
  return Math.max(0, Math.floor(driveMinutes / 120) - stopCount) * 15;
}

/**
 * Split a drive into days. `opts` is the hours you'll drive a day (a
 * number, as before) or { hours, start, finish, days, snap, breaks }:
 *  - hours: the most time behind the wheel each day
 *  - start / finish: minutes after midnight you set off and want to be done;
 *    a day also ends when its clock (driving, stops and breaks) reaches finish
 *  - days: { [index]: { start, finish } } to change one day's times
 *  - snap({ index, fromMile, target, total }): move a day's end to a real
 *    place (a town with hotels, a campground); returns a mile or null
 * Stops (with .mile and .minutes on this route) happen on the day you reach
 * them and don't count toward driving time. Returns [{ index, fromMile,
 * toMile, driveMinutes, stopMinutes, breakMinutes, startClock, endClock,
 * stops, end: {lat, lon} | null }]; end is the overnight spot, null on the
 * last day, and the clocks are minutes after midnight (null without start).
 */
export function splitDays(route, stops = [], opts = 8) {
  const o = typeof opts === "number" ? { hours: opts } : (opts ?? {});
  const baseCap = Math.max(1, Math.min(18, o.hours ?? 8)) * 60;
  const cum = cumulative(route.points);
  const total = route.miles;
  const sorted = [...stops].filter(s => Number.isFinite(s.mile)).sort((a, b) => a.mile - b.mile);
  const withBreaks = o.breaks ?? Number.isFinite(o.start);
  const days = [];
  let fromMile = 0;
  let fromMin = 0;
  let si = 0;
  while (fromMile < total - 0.5 && days.length < 40) {
    const index = days.length;
    const own = o.days?.[index] ?? {};
    const start = Number.isFinite(own.start) ? own.start : o.start;
    const finish = Number.isFinite(own.finish) ? own.finish : o.finish;
    const window = Number.isFinite(start) && Number.isFinite(finish) && finish > start ? finish - start : Infinity;
    const cap = Number.isFinite(own.hours) ? Math.max(60, own.hours * 60) : baseCap;
    // Clock time to reach `mile` today: driving, the stops on the way, breaks.
    const clock = mile => {
      const drive = minutesAt(route, mile) - fromMin;
      let stopMin = 0;
      let n = 0;
      for (let k = si; k < sorted.length && sorted[k].mile <= mile + 0.01; k++) {
        stopMin += sorted[k].minutes ?? 45;
        n += 1;
      }
      return { drive, total: drive + stopMin + (withBreaks ? breakMinutes(drive, n) : 0) };
    };
    const fits = (mile, slack = 0) => {
      const c = clock(mile);
      return c.drive <= cap + slack && c.total <= window + slack;
    };
    let toMile;
    if (fits(total, 20)) toMile = total; // close enough: finish today
    else {
      let lo = fromMile;
      let hi = total;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      toMile = Math.max(lo, fromMile + 1);
      const snapped = o.snap?.({ index, fromMile, target: toMile, total });
      if (Number.isFinite(snapped) && snapped > fromMile + 1 && snapped < total - 1) toMile = snapped;
    }
    const dayStops = [];
    while (si < sorted.length && sorted[si].mile <= toMile + 0.01) dayStops.push(sorted[si++]);
    const last = toMile >= total;
    const driveMinutes = Math.round(minutesAt(route, toMile) - fromMin);
    const stopMinutes = dayStops.reduce((s, p) => s + (p.minutes ?? 45), 0);
    const rest = withBreaks ? breakMinutes(driveMinutes, dayStops.length) : 0;
    days.push({
      index,
      fromMile: Math.round(fromMile),
      toMile: Math.round(toMile),
      driveMinutes,
      stopMinutes,
      breakMinutes: rest,
      startClock: Number.isFinite(start) ? start : null,
      endClock: Number.isFinite(start) ? start + driveMinutes + stopMinutes + rest : null,
      stops: dayStops,
      end: last ? null : pointAt(route.points, cum, toMile),
      exactFrom: fromMile,
      exactTo: toMile,
    });
    fromMin = minutesAt(route, toMile);
    fromMile = toMile;
  }
  return days;
}

/** The themes a trip can be built around (all but fastest). */
export const STOP_THEMES = THEMES.filter(t => t.id !== "fastest").map(t => t.id);
