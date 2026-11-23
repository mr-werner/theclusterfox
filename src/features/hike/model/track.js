// Recording a hike without draining the phone. A fix is only kept when it's
// accurate enough and you've actually moved, so a long day stays a few
// thousand points and the screen barely redraws. Points are
// [lat, lon, ele|null, unixSeconds].

import { dist } from "./geo.js";

export const MODES = [
  { id: "full", name: "Full detail", every: 0, detail: "GPS stays on. Smoothest track, uses the most battery." },
  { id: "saver", name: "Battery saver", every: 60, detail: "A fix each minute, GPS off in between. About a third of the battery use." },
  { id: "sparse", name: "Ultra saver", every: 180, detail: "A fix every 3 minutes. For all-day hikes." },
  { id: "manual", name: "Check-ins only", every: null, detail: "No tracking. Tap Locate me when you want to see where you are." },
];
export const modeById = id => MODES.find(m => m.id === id) ?? MODES[1];

/**
 * Whether to keep a new fix. Keeps it when it's accurate (≤ 40 m, or ≤ 80 m
 * if we've had nothing for 3 minutes) and at least `minMove` metres from the
 * last kept point (or the accuracy, if that's worse).
 */
export function shouldKeep(last, fix, minMove = 10) {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return false;
  const acc = Number.isFinite(fix.accuracy) ? fix.accuracy : 30;
  if (!last) return acc <= 80;
  const age = fix.time - last[3];
  if (acc > 40 && !(acc <= 80 && age >= 180)) return false;
  return dist([last[0], last[1]], [fix.lat, fix.lon]) >= Math.max(minMove, acc * 0.6);
}

/** Add a fix ({ lat, lon, alt, accuracy, time: unix s }) if it's worth keeping. */
export function addFix(points, fix, minMove) {
  const last = points[points.length - 1];
  if (!shouldKeep(last, fix, minMove)) return points;
  return [...points, [round(fix.lat, 6), round(fix.lon, 6), Number.isFinite(fix.alt) ? Math.round(fix.alt) : null, Math.round(fix.time)]];
}
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

/**
 * Distance (m), moving and total time (s), climb (m) and current speed.
 * Stops longer than 2 minutes between points that barely moved don't count
 * as moving time.
 */
export function trackStats(points) {
  let distance = 0;
  let moving = 0;
  let gain = 0;
  let ref = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (Number.isFinite(p[2])) {
      if (ref === null) ref = p[2];
      else if (p[2] - ref >= 6) {
        gain += p[2] - ref;
        ref = p[2];
      } else if (ref - p[2] >= 6) ref = p[2];
    }
    if (!i) continue;
    const q = points[i - 1];
    const d = dist(q, p);
    const dt = p[3] - q[3];
    distance += d;
    if (dt > 0 && (d / dt > 0.25 || dt < 120)) moving += dt;
  }
  const total = points.length > 1 ? points[points.length - 1][3] - points[0][3] : 0;
  return { distance, moving, total, gain: Math.round(gain) };
}
