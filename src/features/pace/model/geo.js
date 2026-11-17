// GPS track math: distance between fixes, filtering bad fixes, splits,
// drawing the route, and reading and writing GPX files.

import { SPORTS } from "../data/events.js";

const R = 6371008.8;
const rad = d => (d * Math.PI) / 180;

/** Meters between two { lat, lon } points. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const MAX_ACCURACY_M = 35;
export const GAP_SEC = 20;

/**
 * Decide what a new GPS fix adds to a recording.
 * last: the previous accepted fix or null (null after a pause).
 * Returns { accept, meters, gap } where gap is true when the fixes are far
 * apart in time (the phone stopped reporting, usually with the screen off).
 */
export function stepFor(last, fix, sport = "run") {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return { accept: false, meters: 0, gap: false };
  if (fix.acc > MAX_ACCURACY_M) return { accept: false, meters: 0, gap: false };
  if (!last) return { accept: true, meters: 0, gap: false };
  const dt = (fix.t - last.t) / 1000;
  if (dt <= 0) return { accept: false, meters: 0, gap: false };
  const d = haversine(last, fix);
  const max = SPORTS[sport]?.maxSpeed ?? 12;
  // Faster than the sport allows: a GPS jump, not you.
  if (d / dt > max) return { accept: false, meters: 0, gap: false };
  // Standing still, GPS wanders a few meters; don't count jitter.
  const noise = Math.max(2, Math.min(fix.acc ?? 10, last.acc ?? 10) * 0.5);
  if (d < noise && dt < GAP_SEC) return { accept: false, meters: 0, gap: false };
  return { accept: true, meters: d, gap: dt >= GAP_SEC };
}

/** Speed in m/s over the last `windowSec` of accepted fixes. */
export function recentSpeed(points, windowSec = 20, now = null) {
  if (!points || points.length < 2) return null;
  const end = points[points.length - 1];
  if (now && now - end.t > 15000) return 0;
  let dist = 0;
  let first = end;
  for (let i = points.length - 1; i > 0; i -= 1) {
    const a = points[i - 1];
    const b = points[i];
    if (b.seg !== a.seg) break;
    if ((end.t - a.t) / 1000 > windowSec) break;
    dist += haversine(a, b);
    first = a;
  }
  const dt = (end.t - first.t) / 1000;
  return dt >= 4 ? dist / dt : null;
}

/** Keep at most `max` points, always keeping the first and last of each segment. */
export function downsample(points, max = 500) {
  if (!points || points.length <= max) return points ?? [];
  const step = points.length / max;
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const segEdge = i === 0 || i === points.length - 1 || points[i - 1].seg !== p.seg || points[i + 1]?.seg !== p.seg;
    if (segEdge || Math.floor(i / step) !== Math.floor((i - 1) / step)) out.push(p);
  }
  return out;
}

/** Round coordinates and drop extras for storage. */
export const compact = p => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: p.t, ...(p.seg != null ? { seg: p.seg } : {}), ...(Number.isFinite(p.ele) ? { ele: Math.round(p.ele) } : {}), ...(p.hr ? { hr: p.hr } : {}) });

/** Time for each whole unit of distance (mile, km, or 500 m). [{ n, sec, meters }] */
export function splits(points, unitM) {
  if (!points || points.length < 2) return [];
  const out = [];
  let dist = 0;
  let mark = points[0].t;
  let next = unitM;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const d = b.seg === a.seg ? haversine(a, b) : 0;
    if (!d) continue;
    while (dist + d >= next) {
      const f = (next - dist) / d;
      const t = a.t + (b.t - a.t) * f;
      out.push({ n: out.length + 1, sec: (t - mark) / 1000, meters: unitM });
      mark = t;
      next += unitM;
    }
    dist += d;
  }
  return out;
}

/** Total meters along points, not counting across pauses. */
export function trackDistance(points) {
  let d = 0;
  for (let i = 1; i < (points?.length ?? 0); i += 1) if (points[i].seg === points[i - 1].seg) d += haversine(points[i - 1], points[i]);
  return d;
}

/** SVG path data for the route, fitted into a w×h box. */
export function routePath(points, w = 300, h = 200, pad = 12) {
  if (!points || points.length < 2) return null;
  const lat0 = points.reduce((n, p) => n + p.lat, 0) / points.length;
  const k = Math.cos(rad(lat0));
  const xs = points.map(p => p.lon * k);
  const ys = points.map(p => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const scale = Math.min((w - pad * 2) / Math.max(maxX - minX, span * 0.2), (h - pad * 2) / Math.max(maxY - minY, span * 0.2));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  let d = "";
  for (let i = 0; i < points.length; i += 1) {
    const x = (ox + (xs[i] - minX) * scale).toFixed(1);
    const y = (oy + (ys[i] - minY) * scale).toFixed(1);
    d += `${i === 0 || points[i].seg !== points[i - 1].seg ? "M" : "L"}${x} ${y}`;
  }
  const end = points.length - 1;
  return {
    d,
    start: [ox + (xs[0] - minX) * scale, oy + (ys[0] - minY) * scale],
    end: [ox + (xs[end] - minX) * scale, oy + (ys[end] - minY) * scale],
  };
}

const esc = s => String(s).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

/** A GPX file for an activity with a track. */
export function toGpx(activity, points) {
  const type = { run: "running", ride: "cycling", row: "rowing" }[activity.sport] ?? "other";
  const pts = points
    .map((p, i) => {
      const brk = i > 0 && p.seg !== points[i - 1].seg ? "</trkseg><trkseg>" : "";
      const ele = Number.isFinite(p.ele) ? `<ele>${p.ele}</ele>` : "";
      const hr = p.hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : "";
      return `${brk}<trkpt lat="${p.lat}" lon="${p.lon}">${ele}<time>${new Date(p.t).toISOString()}</time>${hr}</trkpt>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PaceFox (theclusterfox.com)" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<metadata><name>${esc(activity.title)}</name><time>${new Date(activity.start).toISOString()}</time></metadata>
<trk><name>${esc(activity.title)}</name><type>${type}</type><trkseg>
${pts}
</trkseg></trk>
</gpx>
`;
}

/**
 * Read a GPX file (from a watch, Strava, Garmin, etc). Needs a DOMParser
 * (pass one in outside the browser). Returns { name, type, points } or throws.
 */
export function parseGpx(text, Parser = globalThis.DOMParser) {
  const doc = new Parser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("That file isn't a readable GPX file.");
  const local = (el, name) => Array.from(el.getElementsByTagName("*")).filter(n => n.localName === name || n.nodeName === name || n.nodeName.endsWith(`:${name}`));
  const first = (el, name) => local(el, name)[0] ?? null;
  const points = [];
  const segs = local(doc, "trkseg");
  const groups = segs.length ? segs : [doc];
  groups.forEach((seg, si) => {
    for (const pt of local(seg, "trkpt")) {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      const time = first(pt, "time")?.textContent;
      const t = time ? Date.parse(time) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(t)) continue;
      const ele = parseFloat(first(pt, "ele")?.textContent);
      const hr = parseInt(first(pt, "hr")?.textContent, 10);
      points.push({ lat, lon, t, seg: si, ...(Number.isFinite(ele) ? { ele } : {}), ...(hr > 0 ? { hr } : {}) });
    }
  });
  if (points.length < 2) throw new Error("No timed track points in that file.");
  points.sort((a, b) => a.t - b.t);
  const name = first(doc, "name")?.textContent?.trim() || null;
  const type = (first(doc, "type")?.textContent ?? "").toLowerCase();
  return { name, type, points };
}

/** Guess the sport from a GPX type and its speed. */
export function guessSport(type, mps) {
  if (/cycl|bik|ride/.test(type)) return "ride";
  if (/row|kayak|paddl|canoe/.test(type)) return "row";
  if (/run|walk|hik/.test(type)) return "run";
  return mps > 6 ? "ride" : "run";
}

/** Moving time in seconds: time between fixes, skipping long stops and pauses. */
export function movingSeconds(points) {
  let s = 0;
  for (let i = 1; i < (points?.length ?? 0); i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (b.seg !== a.seg) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) continue;
    if (dt > 60 && haversine(a, b) / dt < 0.5) continue;
    s += dt;
  }
  return s;
}
