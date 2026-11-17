// A recording in progress, as plain data, and the pure steps that change
// it. The screen, GPS, sensors and voice live in the React hook; this file
// only does the bookkeeping so it can be tested and saved after every fix
// (a phone can close a background tab at any time, and the recording
// must survive that).

import { stepFor, downsample, compact, splits as splitList, trackDistance } from "./geo.js";
import { unitMeters, toIsoDay, fmtClock } from "./units.js";
import { ZONES } from "./zones.js";
import { sessionName } from "./sessions.js";

export function newLive({ sport, mode, steps = null, planId = null, sessionId = null, sessionType = null, title, now }) {
  return {
    id: `a${now.toString(36)}`,
    sport,
    mode,
    title: title || (sessionType ? sessionName(sessionType, sport) : { run: "Run", ride: "Ride", row: "Row" }[sport]),
    planId,
    sessionId,
    sessionType,
    steps,
    startedAt: now,
    segments: [{ from: now, to: null }],
    status: "running",
    meters: 0,
    points: [],
    seg: 0,
    gapSec: 0,
    hr: { sum: 0, n: 0, max: 0 },
    power: { sum: 0, n: 0 },
    machine: null, // { start, last } total distance from an FTMS machine
    cues: { step: -1, split: 0 },
  };
}

export function activeSec(live, now) {
  if (!live) return 0;
  return live.segments.reduce((n, s) => n + Math.max(0, (s.to ?? now) - s.from), 0) / 1000;
}

export function pause(live, now) {
  if (live.status !== "running") return live;
  const segments = live.segments.map((s, i) => (i === live.segments.length - 1 ? { ...s, to: now } : s));
  return { ...live, status: "paused", segments };
}

export function resume(live, now) {
  if (live.status !== "paused") return live;
  return { ...live, status: "running", segments: [...live.segments, { from: now, to: null }], seg: live.seg + 1 };
}

/** Add a GPS fix. Ignored while paused. */
export function addFix(live, fix) {
  if (live.status !== "running" || live.mode !== "gps") return live;
  const last = live.points.at(-1);
  const anchor = last && last.seg === live.seg ? last : null;
  const s = stepFor(anchor, fix, live.sport);
  if (!s.accept) return live;
  const p = { lat: fix.lat, lon: fix.lon, t: fix.t, acc: Math.round(fix.acc ?? 0), seg: live.seg, ...(Number.isFinite(fix.ele) ? { ele: fix.ele } : {}), ...(fix.hr ? { hr: fix.hr } : {}) };
  return {
    ...live,
    points: [...live.points, p],
    meters: live.meters + s.meters,
    gapSec: live.gapSec + (s.gap ? (fix.t - anchor.t) / 1000 : 0),
  };
}

/** Add sensor readings (heart rate, power, machine distance). */
export function addSensor(live, v) {
  if (live.status !== "running") return live;
  let next = live;
  if (v.hr > 30 && v.hr < 240) next = { ...next, hr: { sum: next.hr.sum + v.hr, n: next.hr.n + 1, max: Math.max(next.hr.max, v.hr) } };
  if (Number.isFinite(v.power) && v.power >= 0 && v.power < 2500) next = { ...next, power: { sum: next.power.sum + v.power, n: next.power.n + 1 } };
  if (live.mode === "indoor" && Number.isFinite(v.distance)) {
    const m = next.machine ?? { start: v.distance, last: v.distance };
    // A machine reset (distance going back) starts counting again from there.
    const start = v.distance < m.last ? v.distance - (m.last - m.start) : m.start;
    next = { ...next, machine: { start, last: v.distance }, meters: Math.max(0, v.distance - start) };
  }
  return next;
}

/** Which step of the session you are on, at this many active seconds. */
export function stepAt(steps, sec) {
  if (!steps?.length) return null;
  let t = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const s = steps[i];
    const end = t + s.sec;
    // An open step (a race) lasts until you finish.
    if (sec < end || s.open || i === steps.length - 1) {
      return { index: i, step: s, into: sec - t, left: s.open ? null : Math.max(0, end - sec), next: steps[i + 1] ?? null, done: !s.open && i === steps.length - 1 && sec >= end };
    }
    t = end;
  }
  return null;
}

const say = sec => {
  const s = Math.round(sec);
  if (s < 90) return `${s} seconds`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!r) return `${m} minute${m === 1 ? "" : "s"}`;
  if (r === 30) return `${m} and a half minutes`;
  return `${m} minutes ${r} seconds`;
};
/** "7:05" as speech: "7 oh 5". */
const sayClock = sec => {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} flat` : `${m} ${r < 10 ? `oh ${r}` : r}`;
};

/** What the voice says at the start of a step. target comes from zoneTarget(). */
export function stepAnnouncement(step, target, unit) {
  const parts = [];
  const rep = step.rep && step.kind === "work" ? `${step.rep[0]} of ${step.rep[1]}. ` : "";
  const len = step.open ? "" : `, ${say(step.sec)}`;
  parts.push(`${rep}${step.label}${len}.`);
  if (step.kind === "work" || step.kind === "steady") {
    if (target?.metric === "pace") parts.push(`Aim for ${sayClock(target.low)} to ${sayClock(target.high)} per ${unit === "km" ? "kilometer" : "mile"}.`);
    else if (target?.metric === "power") parts.push(`Aim for ${target.low} to ${target.high} watts.`);
    else if (target?.metric === "split") parts.push(`Aim for ${sayClock(target.low)} to ${sayClock(target.high)} splits.`);
    else if (target?.metric === "hr") parts.push(`Heart rate ${target.low} to ${target.high}.`);
    else parts.push(`${ZONES[step.zone]?.feel ?? ""}`);
  }
  if (step.cue) parts.push(step.cue);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** What the voice says at each mile, kilometer or (rowing) 500 m. */
export function splitAnnouncement(n, sec, sport, unit) {
  const what = sport === "row" ? `${n * 500} meters` : `${unit === "km" ? "Kilometer" : "Mile"} ${n}`;
  return `${what} in ${say(sec)}.`;
}

export const splitUnitFor = (sport, unit) => (sport === "row" ? "500m" : unit);
export const splitMeters = (sport, unit) => (sport === "row" ? 500 : unitMeters(unit));

/** Turn a finished recording into an activity and its route. */
export function finishLive(live, now, { unit: prefUnit = "mi", manualMeters = null, rpe = null, notes = "", title } = {}) {
  const ended = pause(live, now);
  const sec = activeSec(ended, now);
  const pts = live.points.map(p => compact(p));
  const meters = manualMeters != null ? manualMeters : live.mode === "gps" ? Math.max(live.meters, trackDistance(pts) * 0.98) : live.meters;
  const unit = splitUnitFor(live.sport, prefUnit);
  const splitSecs = live.mode === "gps" ? splitList(pts, splitMeters(live.sport, prefUnit)).map(s => s.sec) : [];
  const activity = {
    id: live.id,
    sport: live.sport,
    title: title || live.title,
    start: new Date(live.startedAt).toISOString(),
    day: toIsoDay(live.startedAt),
    sec,
    meters,
    hrAvg: live.hr.n ? Math.round(live.hr.sum / live.hr.n) : null,
    hrMax: live.hr.max || null,
    powerAvg: live.power.n ? Math.round(live.power.sum / live.power.n) : null,
    rpe,
    notes,
    source: live.mode === "gps" ? "gps" : manualMeters != null ? "manual" : "indoor",
    planId: live.planId,
    sessionId: live.sessionId,
    sessionType: live.sessionType,
    gapSec: Math.round(live.gapSec),
    splits: splitSecs,
    splitUnit: splitSecs.length ? unit : null,
  };
  return { activity, track: pts.length > 1 ? downsample(pts, 600) : null };
}

/** A short line about time lost to the screen being off. */
export const gapNote = gapSec => (gapSec >= 30 ? `GPS had gaps adding up to ${fmtClock(gapSec)} (usually the screen turning off). Those stretches were counted as straight lines.` : null);
