// Trail geometry for TrailFox: distances, bearings, stitching OpenStreetMap
// pieces into one line, even spacing for elevation samples, and where you
// are along a trail. Plain functions so tests and the tracker can use them.
// Points are [lat, lon] (an optional third value is kept but unused here).

const R = 6371008.8; // mean Earth radius, metres
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

/** Great-circle distance in metres between two [lat, lon] points. */
export function dist(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial true bearing from a to b, 0–360°. */
export function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const cardinal = b => CARDINALS[Math.round((((b % 360) + 360) % 360) / 22.5) % 16];

/** Total length in metres. */
export function lineLength(line) {
  let m = 0;
  for (let i = 1; i < line.length; i++) m += dist(line[i - 1], line[i]);
  return m;
}

/** Cumulative distance at each vertex. */
export function cumulative(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + dist(line[i - 1], line[i]));
  return out;
}

/** [south, west, north, east] around points, padded by `padM` metres. */
export function bounds(points, padM = 0) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const p of points) {
    s = Math.min(s, p[0]);
    n = Math.max(n, p[0]);
    w = Math.min(w, p[1]);
    e = Math.max(e, p[1]);
  }
  const dLat = padM / 111320;
  const dLon = padM / (111320 * Math.max(0.2, Math.cos(rad((s + n) / 2))));
  return [s - dLat, w - dLon, n + dLat, e + dLon];
}

const same = (a, b, tol = 3) => dist(a, b) <= tol;

/**
 * Join OSM way pieces (each a list of points, in any direction) into as few
 * lines as possible, end to end. Returns the joined lines, longest first.
 */
export function stitch(pieces, tol = 25) {
  const left = pieces.filter(p => p.length >= 2).map(p => p.slice());
  const lines = [];
  while (left.length) {
    let line = left.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const p = left[i];
        const head = line[0];
        const tail = line[line.length - 1];
        let joined = null;
        if (same(tail, p[0], tol)) joined = line.concat(p.slice(1));
        else if (same(tail, p[p.length - 1], tol)) joined = line.concat(p.slice(0, -1).reverse());
        else if (same(head, p[p.length - 1], tol)) joined = p.slice(0, -1).concat(line);
        else if (same(head, p[0], tol)) joined = p.slice(1).reverse().concat(line);
        if (joined) {
          line = joined;
          left.splice(i, 1);
          grew = true;
          break;
        }
      }
    }
    lines.push(line);
  }
  return lines.sort((a, b) => lineLength(b) - lineLength(a));
}

/**
 * One line from pieces: the stitched chains, longest first, each following
 * chain attached at whichever end is nearer. Gaps are bridged straight.
 */
export function stitchToOne(pieces, tol = 25) {
  const chains = stitch(pieces, tol);
  if (!chains.length) return [];
  let line = chains[0];
  for (const c of chains.slice(1)) {
    const options = [
      [dist(line[line.length - 1], c[0]), () => line.concat(c)],
      [dist(line[line.length - 1], c[c.length - 1]), () => line.concat(c.slice().reverse())],
      [dist(line[0], c[c.length - 1]), () => c.concat(line)],
      [dist(line[0], c[0]), () => c.slice().reverse().concat(line)],
    ].sort((a, b) => a[0] - b[0]);
    // A far-off piece with the same name is a different trail: leave it out.
    if (options[0][0] > 1500) continue;
    line = options[0][1]();
  }
  return line;
}

/** Douglas–Peucker simplification to within `tolM` metres. */
export function simplify(line, tolM = 5) {
  if (line.length < 3) return line.slice();
  const k = Math.cos(rad(line[0][0]));
  const xy = line.map(p => [p[1] * 111320 * k, p[0] * 110540]);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let at = -1;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * xy[i][0] - (bx - ax) * xy[i][1] + bx * ay - by * ax) / len;
      if (d > best) {
        best = d;
        at = i;
      }
    }
    if (best > tolM) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

/** Simplify harder until the line has at most `max` points. */
export function simplifyTo(line, max = 600) {
  let tol = 3;
  let out = simplify(line, tol);
  while (out.length > max && tol < 500) {
    tol *= 1.6;
    out = simplify(line, tol);
  }
  return out;
}

/** The point at distance `d` along a line (with cumulative distances `cum`). */
export function pointAt(line, cum, d) {
  if (d <= 0) return line[0];
  const total = cum[cum.length - 1];
  if (d >= total) return line[line.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const f = (d - cum[lo]) / span;
  return [line[lo][0] + (line[hi][0] - line[lo][0]) * f, line[lo][1] + (line[hi][1] - line[lo][1]) * f];
}

/** `n` evenly spaced points along a line, with their distances: [{ d, p }]. */
export function resample(line, n = 100) {
  const cum = cumulative(line);
  const total = cum[cum.length - 1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 0 : (total * i) / (n - 1);
    out.push({ d, p: pointAt(line, cum, d) });
  }
  return out;
}

/**
 * Where a position falls on a line: the nearest point, how far off the
 * line it is (m) and how far along (m). Uses a flat projection, which is
 * exact enough over a trail's few kilometres.
 */
export function locateOnLine(line, pos, cum = cumulative(line)) {
  const k = Math.cos(rad(pos[0]));
  const toXY = p => [(p[1] - pos[1]) * 111320 * k, (p[0] - pos[0]) * 110540];
  let best = { off: Infinity, along: 0, index: 0, point: line[0] };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = toXY(line[i - 1]);
    const [bx, by] = toXY(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const x = ax + dx * t;
    const y = ay + dy * t;
    const off = Math.hypot(x, y);
    if (off < best.off) {
      const seg = cum[i] - cum[i - 1];
      best = {
        off,
        along: cum[i - 1] + seg * t,
        index: i - 1,
        point: [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t],
      };
    }
  }
  return best;
}

/** Shortest distance from a point to a line, in metres. */
export const distanceToLine = (line, pos) => (line.length < 2 ? (line.length ? dist(line[0], pos) : Infinity) : locateOnLine(line, pos).off);

/** True when a line starts and ends within `tol` metres: a loop. */
export const isLoop = (line, tol = 200) => line.length > 3 && dist(line[0], line[line.length - 1]) <= tol && lineLength(line) > tol * 3;
