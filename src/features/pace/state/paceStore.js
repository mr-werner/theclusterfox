// Everything PaceFox remembers. The main document (settings, your zones,
// plans and the activity log) is saved in this browser and, when signed
// in, to the ClusterFox account. Routes are bigger, so they stay on this
// device under their own key, as does a recording in progress.

import { eventById, SPORT_IDS, LEVEL_IDS } from "../data/events.js";
import { KINDS } from "../model/sessions.js";

export const STORAGE_KEY = "pacefox-data-v1";
export const TRACKS_KEY = "pacefox-tracks-v1";
export const LIVE_KEY = "pacefox-live-v1";
export const MAX_ACTIVITIES = 500;
export const MAX_TRACKS = 40;

export function emptyData() {
  return {
    version: 1,
    prefs: { unit: "mi", sport: "run", voice: true, splitCues: true, keepAwake: true, trainTime: null },
    profile: { age: null, maxHr: null, restHr: null, runRace: null, ftp: null, row2k: null },
    plans: [],
    activePlanId: null,
    activities: [],
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");

function cleanProfile(p) {
  const base = emptyData().profile;
  if (!isObject(p)) return base;
  const race = isObject(p.runRace) && num(p.runRace.distanceM, 400, 200000) && num(p.runRace.seconds, 60, 200000) ? { distanceM: p.runRace.distanceM, seconds: p.runRace.seconds } : null;
  return {
    age: num(p.age, 10, 100),
    maxHr: num(p.maxHr, 100, 230),
    restHr: num(p.restHr, 30, 100),
    runRace: race,
    ftp: num(p.ftp, 40, 700),
    row2k: num(p.row2k, 300, 900),
  };
}

function cleanPrefs(p) {
  const base = emptyData().prefs;
  if (!isObject(p)) return base;
  return {
    unit: p.unit === "km" ? "km" : "mi",
    sport: SPORT_IDS.includes(p.sport) ? p.sport : base.sport,
    voice: p.voice !== false,
    splitCues: p.splitCues !== false,
    keepAwake: p.keepAwake !== false,
    trainTime: typeof p.trainTime === "string" && /^\d{2}:\d{2}$/.test(p.trainTime) ? p.trainTime : null,
  };
}

function cleanPlan(p) {
  if (!isObject(p) || !eventById.has(p.eventId) || !Array.isArray(p.weeks)) return null;
  const weeks = p.weeks
    .filter(w => isObject(w) && isDay(w.start) && Array.isArray(w.sessions))
    .slice(0, 30)
    .map((w, i) => ({
      index: Number.isInteger(w.index) ? w.index : i,
      start: w.start,
      phase: ["base", "build", "peak", "taper"].includes(w.phase) ? w.phase : "base",
      recovery: Boolean(w.recovery),
      minutes: num(w.minutes, 0, 5000) ?? 0,
      sessions: w.sessions
        .filter(s => isObject(s) && isDay(s.day) && KINDS.includes(s.type) && typeof s.id === "string")
        .slice(0, 10)
        .map(s => ({ id: s.id.slice(0, 20), day: s.day, weekday: Number.isInteger(s.weekday) ? s.weekday : 0, type: s.type, minutes: num(s.minutes, 0, 900) ?? 30 })),
    }));
  const completed = {};
  if (isObject(p.completed)) for (const [k, v] of Object.entries(p.completed)) if (typeof v === "string" || v === true) completed[k.slice(0, 20)] = v === true ? true : v.slice(0, 40);
  const skipped = {};
  if (isObject(p.skipped)) for (const k of Object.keys(p.skipped)) skipped[k.slice(0, 20)] = true;
  return {
    id: str(p.id, 40) || `p${Math.random().toString(36).slice(2, 8)}`,
    sport: eventById.get(p.eventId).sport,
    eventId: p.eventId,
    raceDate: isDay(p.raceDate) ? p.raceDate : null,
    level: LEVEL_IDS.includes(p.level) ? p.level : "regular",
    days: num(p.days, 2, 6) ?? 4,
    longDay: p.longDay === 6 ? 6 : 5,
    startMinutes: num(p.startMinutes, 30, 1200) ?? 180,
    createdAt: isDay(p.createdAt) ? p.createdAt : null,
    title: str(p.title, 80) || null,
    weeks,
    completed,
    skipped,
  };
}

export function cleanActivity(a) {
  if (!isObject(a) || !SPORT_IDS.includes(a.sport) || typeof a.start !== "string" || !Number.isFinite(Date.parse(a.start))) return null;
  const splits = Array.isArray(a.splits) ? a.splits.filter(s => Number.isFinite(s) && s > 0).slice(0, 300).map(s => Math.round(s)) : [];
  return {
    id: str(a.id, 40) || `a${Date.parse(a.start).toString(36)}`,
    sport: a.sport,
    title: str(a.title, 80) || "Workout",
    start: a.start,
    day: isDay(a.day) ? a.day : a.start.slice(0, 10),
    sec: num(a.sec, 0, 200000) ?? 0,
    meters: num(a.meters, 0, 2000000) ?? 0,
    hrAvg: num(a.hrAvg, 30, 240),
    hrMax: num(a.hrMax, 30, 240),
    powerAvg: num(a.powerAvg, 1, 2500),
    rpe: num(a.rpe, 1, 10),
    notes: str(a.notes, 600),
    source: ["gps", "indoor", "manual", "gpx"].includes(a.source) ? a.source : "manual",
    planId: str(a.planId, 40) || null,
    sessionId: str(a.sessionId, 20) || null,
    sessionType: KINDS.includes(a.sessionType) ? a.sessionType : null,
    gapSec: num(a.gapSec, 0, 200000) ?? 0,
    hasTrack: Boolean(a.hasTrack),
    splits,
    splitUnit: ["mi", "km", "500m"].includes(a.splitUnit) ? a.splitUnit : null,
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const plans = Array.isArray(raw.plans) ? raw.plans.map(cleanPlan).filter(Boolean).slice(0, 12) : [];
  const activities = Array.isArray(raw.activities)
    ? raw.activities
        .map(cleanActivity)
        .filter(Boolean)
        .sort((a, b) => (a.start < b.start ? 1 : -1))
        .slice(0, MAX_ACTIVITIES)
    : [];
  return {
    ...base,
    prefs: cleanPrefs(raw.prefs),
    profile: cleanProfile(raw.profile),
    plans,
    activePlanId: plans.some(p => p.id === raw.activePlanId) ? raw.activePlanId : plans[0]?.id ?? null,
    activities,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function loadData() {
  try {
    return normalizeData(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: keeps working for this visit.
  }
}

// ---- Routes (this device only) ---------------------------------------------

export function loadTracks() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TRACKS_KEY) ?? "null");
    return isObject(raw) ? raw : {};
  } catch {
    return {};
  }
}

export function saveTrack(id, points) {
  const all = loadTracks();
  all[id] = points;
  const ids = Object.keys(all);
  // Oldest routes go first when there are too many.
  if (ids.length > MAX_TRACKS) {
    ids.sort((a, b) => (all[a][0]?.t ?? 0) - (all[b][0]?.t ?? 0));
    for (const old of ids.slice(0, ids.length - MAX_TRACKS)) delete all[old];
  }
  for (let tries = 0; tries < 5; tries += 1) {
    try {
      window.localStorage.setItem(TRACKS_KEY, JSON.stringify(all));
      return true;
    } catch {
      const rest = Object.keys(all).filter(k => k !== id);
      if (!rest.length) return false;
      delete all[rest[0]];
    }
  }
  return false;
}

export function deleteTrack(id) {
  const all = loadTracks();
  if (!(id in all)) return;
  delete all[id];
  try {
    window.localStorage.setItem(TRACKS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// ---- Recording in progress --------------------------------------------------

export function loadLive() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LIVE_KEY) ?? "null");
    return isObject(raw) && raw.startedAt ? raw : null;
  } catch {
    return null;
  }
}

export function saveLive(live) {
  try {
    if (live) window.localStorage.setItem(LIVE_KEY, JSON.stringify(live));
    else window.localStorage.removeItem(LIVE_KEY);
  } catch {
    /* ignore */
  }
}
