// Geometry for RoadFox: distances in miles, positions along a route, and
// which state a point is in. Plain functions so tests and PlanFox can use them.
// Points are { lat, lon }.

const R_MI = 3958.8;
const rad = d => (d * Math.PI) / 180;

export function miles(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Running distance in miles at each point. */
export function cumulative(points) {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + miles(points[i - 1], points[i]));
  return out;
}

/** The point `mile` miles along a line. */
export function pointAt(points, cum, mile) {
  if (!points.length) return null;
  if (mile <= 0) return points[0];
  const last = cum[cum.length - 1];
  if (mile >= last) return points[points.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= mile) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (mile - cum[lo]) / seg;
  return { lat: points[lo].lat + (points[hi].lat - points[lo].lat) * t, lon: points[lo].lon + (points[hi].lon - points[lo].lon) * t };
}

/** Points every `step` miles along a line, with their mile, ending at the end. */
export function sampleEvery(points, cum, step) {
  const total = cum[cum.length - 1] ?? 0;
  const out = [];
  for (let m = 0; m < total; m += step) out.push({ ...pointAt(points, cum, m), mile: m });
  if (points.length) out.push({ ...points[points.length - 1], mile: total });
  return out;
}

/**
 * Where a place sits relative to a line: { mile, off } where mile is the
 * nearest spot along it and off is how far (miles) the place is from there.
 * Pass sampled points (with .mile) for speed on long routes.
 */
export function locate(samples, p) {
  let best = { mile: 0, off: Infinity };
  const kx = Math.cos(rad(p.lat)) * 69.17;
  const ky = 69.06;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const ax = (a.lon - p.lon) * kx;
    const ay = (a.lat - p.lat) * ky;
    const bx = (b.lon - p.lon) * kx;
    const by = (b.lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const x = ax + dx * t;
    const y = ay + dy * t;
    const d = Math.sqrt(x * x + y * y);
    if (d < best.off) best = { mile: a.mile + (b.mile - a.mile) * t, off: d };
  }
  return best;
}

/** Douglas-Peucker in degrees, keeping the ends. */
export function simplify(points, tolerance) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const a = points[s];
    const b = points[e];
    const dx = b.lon - a.lon;
    const dy = b.lat - a.lat;
    const len = Math.hypot(dx, dy) || 1e-12;
    let far = -1;
    let farD = tolerance;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * (points[i].lon - a.lon) - dx * (points[i].lat - a.lat)) / len;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([s, far], [far, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplify until a line has at most `max` points. */
export function shrink(points, max) {
  let tol = 0.002;
  let out = simplify(points, tol);
  while (out.length > max) {
    tol *= 1.6;
    out = simplify(points, tol);
  }
  return out;
}

export function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The state code a point is in, from shapes { code: [ring, ...] }, or null outside the US. */
export function stateAt(shapes, p) {
  for (const [code, rings] of Object.entries(shapes)) {
    for (const ring of rings) if (inRing(p.lon, p.lat, ring)) return code;
  }
  return null;
}

/**
 * The states a route passes through, in order, with the miles driven in
 * each: [{ code, miles }]. Samples every few miles; points just outside an
 * outline (coastlines, rounding) count toward the state before them.
 */
export function statesAlong(shapes, points, cum, step = 5) {
  const out = [];
  let prev = null;
  let prevMile = 0;
  for (const s of sampleEvery(points, cum, step)) {
    const code = stateAt(shapes, s) ?? prev;
    if (code && prev && code === prev) out[out.length - 1].miles += s.mile - prevMile;
    else if (code) out.push({ code, miles: prev ? s.mile - prevMile : 0 });
    prev = code;
    prevMile = s.mile;
  }
  return out.map(s => ({ ...s, miles: Math.round(s.miles) }));
}

export function bounds(points) {
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const p of points) {
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
  }
  return { s, w, n, e };
}

export function fmtMinutes(min) {
  if (!Number.isFinite(min)) return "—";
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export const fmtMiles = mi => (mi >= 100 ? Math.round(mi).toLocaleString("en-US") : mi >= 10 ? Math.round(mi) : mi.toFixed(1)) + " mi";
