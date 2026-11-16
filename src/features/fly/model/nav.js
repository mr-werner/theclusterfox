// Navigation math for FlyFox: great-circle courses and distances, the wind
// triangle, route legs, fuel stops and hazards along a route. Distances
// are nautical miles, speeds knots, angles degrees true. Plain functions.

import { windAt, nearestHour } from "./windsAloft.js";

const R_NM = 3440.065; // mean Earth radius in nautical miles
const RAD = Math.PI / 180;

export const norm = d => ((d % 360) + 360) % 360;
export const round = (v, step = 1) => Math.round(v / step) * step;

export function distanceNm(a, b) {
  const p1 = a.lat * RAD;
  const p2 = b.lat * RAD;
  const dp = (b.lat - a.lat) * RAD;
  const dl = (b.lon - a.lon) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial true course from a to b. */
export function courseDeg(a, b) {
  const p1 = a.lat * RAD;
  const p2 = b.lat * RAD;
  const dl = (b.lon - a.lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return norm(Math.atan2(y, x) / RAD);
}

/** The point a fraction f of the way along the great circle from a to b. */
export function interpolate(a, b, f) {
  const d = distanceNm(a, b) / R_NM;
  if (d < 1e-9) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const p1 = a.lat * RAD;
  const p2 = b.lat * RAD;
  const l1 = a.lon * RAD;
  const l2 = b.lon * RAD;
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
}

/**
 * The wind triangle: the heading to hold and the groundspeed you get for a
 * true course, true airspeed and wind (from dir at kt). Returns
 * { heading, wca, gs } or null when the wind is stronger than you can fly.
 */
export function windTriangle(course, tas, wind) {
  if (!wind || !wind.kt) return { heading: norm(course), wca: 0, gs: tas };
  const delta = (wind.dir - course) * RAD;
  const s = (wind.kt / tas) * Math.sin(delta);
  if (Math.abs(s) >= 1) return null;
  const wca = Math.asin(s);
  const gs = tas * Math.cos(wca) - wind.kt * Math.cos(delta);
  if (gs <= 0) return null;
  return { heading: norm(course + wca / RAD), wca: wca / RAD, gs };
}

/** Crosswind and headwind on a runway (heading in degrees magnetic or true, same as the wind). */
export function runwayWind(runwayHeading, windDir, windKt) {
  const a = (windDir - runwayHeading) * RAD;
  return { head: windKt * Math.cos(a), cross: windKt * Math.sin(a) };
}

/** Pressure altitude from field elevation and altimeter setting. */
export const pressureAltitude = (elevFt, altimInHg) => elevFt + (29.92 - altimInHg) * 1000;

/** Density altitude, the classic pilot's approximation (120 ft per °C off standard). */
export function densityAltitude(elevFt, altimInHg, tempC) {
  const pa = pressureAltitude(elevFt, altimInHg);
  const isa = 15 - (2 * pa) / 1000;
  return pa + 120 * (tempC - isa);
}

/** True airspeed from indicated (or calibrated) airspeed, about 2% per 1,000 ft of density altitude. */
export const trueAirspeed = (ias, densityAltFt) => ias * (1 + 0.02 * (densityAltFt / 1000));

/** Points every `stepNm` along a route of waypoints, each tagged with how far along it is. */
export function samplePoints(waypoints, stepNm = 40) {
  const out = [];
  let along = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const d = distanceNm(a, b);
    const n = Math.max(1, Math.ceil(d / stepNm));
    for (let k = 0; k < n; k++) out.push({ ...interpolate(a, b, k / n), alongNm: along + (d * k) / n, leg: i });
    along += d;
  }
  const last = waypoints[waypoints.length - 1];
  out.push({ lat: last.lat, lon: last.lon, alongNm: along, leg: waypoints.length - 2 });
  return out;
}

/** Cross-track distance (nm) from a point to a route, and how far along the route its closest point is. */
export function nearestOnRoute(waypoints, p) {
  let best = { offNm: Infinity, alongNm: 0 };
  let along = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const d = distanceNm(a, b);
    // Flat projection is plenty at these distances.
    const kx = Math.cos(((a.lat + b.lat) / 2) * RAD);
    const ax = a.lon * kx;
    const bx = b.lon * kx;
    const px = p.lon * kx;
    const vx = bx - ax;
    const vy = b.lat - a.lat;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (p.lat - a.lat) * vy) / len2)) : 0;
    const q = { lat: a.lat + vy * t, lon: (ax + vx * t) / kx };
    const off = distanceNm(p, q);
    if (off < best.offNm) best = { offNm: off, alongNm: along + d * t };
    along += d;
  }
  return best;
}

/** A box around the route, padded by padNm, as [minLat, minLon, maxLat, maxLon]. */
export function routeBox(points, padNm = 25) {
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = padNm / 60;
  const padLon = padNm / (60 * Math.max(0.2, Math.cos(midLat * RAD)));
  return [Math.min(...lats) - padLat, Math.min(...lons) - padLon, Math.max(...lats) + padLat, Math.max(...lons) + padLon];
}

/** Split a big box into tiles no larger than maxLat x maxLon degrees that touch the route corridor. */
export function corridorBoxes(waypoints, padNm = 25, maxDeg = 3) {
  const [a, b, c, d] = routeBox(waypoints, padNm);
  const boxes = [];
  for (let lat = a; lat < c; lat += maxDeg) {
    for (let lon = b; lon < d; lon += maxDeg) {
      const box = [lat, lon, Math.min(c, lat + maxDeg), Math.min(d, lon + maxDeg)];
      const center = { lat: (box[0] + box[2]) / 2, lon: (box[1] + box[3]) / 2 };
      const halfDiag = distanceNm({ lat: box[0], lon: box[1] }, { lat: box[2], lon: box[3] }) / 2;
      if (nearestOnRoute(waypoints, center).offNm <= halfDiag + padNm) boxes.push(box);
    }
  }
  return boxes;
}

/** Point in polygon ([[lat, lon], ...]), ray casting. */
export function inPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Hazards the route passes through at its cruise altitude. Each comes back
 * once with the stretch of the route it covers: { hazard, fromNm, toNm, atAltitude }.
 */
export function hazardsOnRoute(samples, hazards, cruiseFt) {
  const out = [];
  for (const h of hazards ?? []) {
    const hits = samples.filter(p => inPolygon(p, h.coords));
    if (!hits.length) continue;
    const base = h.baseFt ?? 0;
    const top = h.topFt ?? Infinity;
    out.push({
      hazard: h,
      fromNm: hits[0].alongNm,
      toNm: hits[hits.length - 1].alongNm,
      atAltitude: h.hazard === "IFR" || h.hazard === "MT_OBSC" || h.hazard === "SFC_WND" ? true : cruiseFt >= base - 1000 && cruiseFt <= top + 1000,
    });
  }
  return out.sort((a, b) => a.fromNm - b.fromNm);
}

/**
 * Plan a flight. waypoints: [{ id, lat, lon, elevFt?, magVar? }] (two or more).
 * aircraft: { tas, gph, usableGal, taxiGal, climbKt? }. altitudeFt: cruise MSL.
 * profiles: winds-aloft profiles for `samples` (same order), or null.
 * Returns legs with wind, heading, groundspeed, time and fuel, plus totals.
 */
export function planFlight({ waypoints, aircraft, altitudeFt, departAt, samples, profiles }) {
  const tas = Math.max(40, aircraft.tas || 110);
  const gph = Math.max(1, aircraft.gph || 9);
  let clock = +new Date(departAt ?? Date.now());
  const legs = [];
  const pieces = [];

  // Fly piece by piece between sample points, using the wind there at the hour you get there.
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const dist = distanceNm(a, b);
    if (dist < 0.01) continue;
    const tc = courseDeg(a, b);
    const profile = profiles?.[i];
    const hour = profile ? nearestHour(profile, new Date(clock)) : null;
    const wind = hour ? windAt(hour.levels, altitudeFt) : null;
    const tri = windTriangle(tc, tas, wind) ?? { heading: tc, wca: 0, gs: Math.max(20, tas - (wind?.kt ?? 0)) };
    const minutes = (dist / tri.gs) * 60;
    pieces.push({ leg: a.leg, dist, tc, wind, ...tri, minutes, from: clock, alongNm: a.alongNm });
    clock += minutes * 60000;
  }

  for (let l = 0; l < waypoints.length - 1; l++) {
    const ps = pieces.filter(p => p.leg === l);
    const dist = ps.reduce((s, p) => s + p.dist, 0);
    const minutes = ps.reduce((s, p) => s + p.minutes, 0);
    const from = waypoints[l];
    const to = waypoints[l + 1];
    const tc = courseDeg(from, to);
    // Average wind over the leg, weighted by distance.
    let u = 0;
    let v = 0;
    let t = 0;
    let n = 0;
    for (const p of ps) {
      if (!p.wind) continue;
      u += -p.wind.kt * Math.sin(p.wind.dir * RAD) * p.dist;
      v += -p.wind.kt * Math.cos(p.wind.dir * RAD) * p.dist;
      t += (p.wind.tempC ?? 0) * p.dist;
      n += p.dist;
    }
    const wind = n ? { dir: norm(Math.atan2(-u / n, -v / n) / RAD), kt: Math.hypot(u / n, v / n), tempC: t / n } : null;
    const gs = minutes ? (dist / minutes) * 60 : tas;
    const heading = windTriangle(tc, tas, wind)?.heading ?? tc;
    const magVar = from.magVar ?? to.magVar ?? null;
    legs.push({
      from,
      to,
      distNm: dist,
      tc,
      wind,
      heading,
      magHeading: magVar === null ? null : norm(heading - magVar),
      gs,
      minutes,
      fuelGal: (gph * minutes) / 60,
      departAt: ps[0]?.from ?? clock,
      arriveAt: (ps[ps.length - 1]?.from ?? clock) + (ps[ps.length - 1]?.minutes ?? 0) * 60000,
    });
  }

  const totalNm = legs.reduce((s, l) => s + l.distNm, 0);
  const totalMin = legs.reduce((s, l) => s + l.minutes, 0);
  const burn = legs.reduce((s, l) => s + l.fuelGal, 0) + (aircraft.taxiGal ?? 1.1);
  return {
    legs,
    pieces,
    totalNm,
    totalMin,
    fuelGal: burn,
    fuelLeftGal: (aircraft.usableGal || 40) - burn,
    arriveAt: +new Date(departAt ?? Date.now()) + totalMin * 60000,
  };
}

/** Minutes of reserve the rules ask for: 30 by day, 45 at night (VFR, 14 CFR 91.151). */
export const reserveMinutes = night => (night ? 45 : 30);

/**
 * Where you'd need to land for fuel. Walks the flown pieces and marks the
 * distance along the route where fuel would reach the reserve; returns
 * [{ alongNm }] for each stop needed (assuming a full refuel each time).
 */
export function fuelStops(plan, aircraft, { night = false } = {}) {
  const gph = Math.max(1, aircraft.gph || 9);
  const usable = (aircraft.usableGal || 40) - (aircraft.taxiGal ?? 1.1);
  const reserveGal = (gph * reserveMinutes(night)) / 60;
  const stops = [];
  let fuel = usable;
  for (const p of plan.pieces) {
    const need = (gph * p.minutes) / 60;
    if (fuel - need < reserveGal) {
      // Land a bit before running into the reserve.
      const fraction = Math.max(0, (fuel - reserveGal) / need);
      stops.push({ alongNm: p.alongNm + p.dist * fraction });
      fuel = usable - need * (1 - fraction);
    } else fuel -= need;
  }
  return stops;
}

/** Airports along the route, best stop candidates first, with where on the route they sit. */
export function airportsAlong(waypoints, stations, { maxOffNm = 20, skip = [] } = {}) {
  const skipIds = new Set(skip);
  return (stations ?? [])
    .filter(s => !skipIds.has(s.id))
    .map(s => ({ ...s, ...nearestOnRoute(waypoints, { lat: s.lat, lon: s.lon }) }))
    .filter(s => s.offNm <= maxOffNm)
    .sort((a, b) => a.alongNm - b.alongNm);
}

/** The best airport to stop at near a spot on the route: close to the route, good weather, ahead of the spot. */
export function bestStop(candidates, alongNm, { maxBackNm = 80 } = {}) {
  const score = { VFR: 0, MVFR: 15, IFR: 60, LIFR: 120 };
  const options = candidates.filter(c => c.alongNm <= alongNm + 5 && c.alongNm >= alongNm - maxBackNm);
  if (!options.length) return null;
  return options
    .map(c => ({ c, s: c.offNm * 1.5 + (alongNm - c.alongNm) * 0.5 + (score[c.category] ?? 30) + (c.fuel === false ? 40 : 0) }))
    .sort((a, b) => a.s - b.s)[0].c;
}

/** Sunset-based night check for a time at a place (civil twilight is close enough for planning). */
export function isNight(when, lat, lon) {
  const d = new Date(when);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  const decl = -23.44 * Math.cos(((360 / 365) * (day + 10)) * RAD);
  const hourUtc = d.getUTCHours() + d.getUTCMinutes() / 60;
  const solarTime = hourUtc + lon / 15;
  const ha = (solarTime - 12) * 15;
  const elev = Math.asin(Math.sin(lat * RAD) * Math.sin(decl * RAD) + Math.cos(lat * RAD) * Math.cos(decl * RAD) * Math.cos(ha * RAD)) / RAD;
  return elev < -6;
}

export const fmtMinutes = m => {
  const total = Math.round(m);
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm} min`;
};

export const pad3 = d => String(Math.round(norm(d)) || 360).padStart(3, "0");
