// TrailFox's saved data, in this browser: trails you've looked at or saved
// (with their line, elevation profile and points of interest, so they work
// offline), planned hikes, the hike you're recording and past hikes.
// Plain functions so tests and TaskFox can use them.

export const STORAGE_KEY = "trailfox-data-v1";
const MAX_RECENT = 12;
const MAX_HIKES = 40;

export function emptyData() {
  return {
    version: 1,
    units: "us", // "us" | "metric"
    pace: 1,
    trackMode: "saver",
    place: null, // last searched { name, lat, lon }
    trails: [],
    hikes: [], // [{ id, trailId, name, startedAt, endedAt, points, distance, moving, gain }]
    active: null, // { id, trailId, name, startedAt, mode, points, pausedAt }
    updatedAt: null,
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const num = (v, d = null) => (Number.isFinite(v) ? v : d);
const str = (v, n = 120) => (typeof v === "string" ? v.slice(0, n) : "");
const isLat = v => Number.isFinite(v) && Math.abs(v) <= 90;
const isLon = v => Number.isFinite(v) && Math.abs(v) <= 180;
const cleanPt = p => (Array.isArray(p) && isLat(p[0]) && isLon(p[1]) ? [p[0], p[1]] : null);
const cleanPlace = p => (isObj(p) && isLat(p.lat) && isLon(p.lon) ? { name: str(p.name, 80) || "Pinned spot", lat: p.lat, lon: p.lon } : null);
const isDay = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = s => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
export const SHAPE_IDS = ["loop", "out-back", "one-way"];

export function cleanTrail(t) {
  if (!isObj(t) || typeof t.id !== "string" || !t.id) return null;
  const line = (Array.isArray(t.line) ? t.line : []).map(cleanPt).filter(Boolean).slice(0, 1200);
  if (line.length < 2) return null;
  const profile = (Array.isArray(t.profile) ? t.profile : []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => [Math.round(p[0]), Math.round(p[1])]).slice(0, 400);
  return {
    id: t.id.slice(0, 60),
    name: str(t.name, 100) || "Trail",
    source: t.source === "gpx" ? "gpx" : "osm",
    ref: str(t.ref, 40),
    line,
    profile,
    shape: SHAPE_IDS.includes(t.shape) ? t.shape : "out-back",
    sac: str(t.sac, 40) || null,
    info: isObj(t.info) ? Object.fromEntries(Object.entries(t.info).filter(([, v]) => typeof v === "string" && v).map(([k, v]) => [k.slice(0, 30), v.slice(0, 400)]).slice(0, 12)) : {},
    trailhead: cleanPlace(t.trailhead),
    pois: (Array.isArray(t.pois) ? t.pois : [])
      .filter(p => isObj(p) && isLat(p.lat) && isLon(p.lon))
      .slice(0, 60)
      .map(p => ({ id: str(p.id, 40), kind: str(p.kind, 20), name: str(p.name, 80), lat: p.lat, lon: p.lon, ele: num(p.ele), d: num(p.d) })),
    saved: t.saved === true,
    viewedAt: str(t.viewedAt, 40),
    savedAt: str(t.savedAt, 40) || null,
    offline: isObj(t.offline) && Number.isFinite(t.offline.tiles) ? { layer: str(t.offline.layer, 10), tiles: t.offline.tiles, maxZoom: num(t.offline.maxZoom, 0), at: str(t.offline.at, 40) } : null,
    plan: isObj(t.plan) && isDay(t.plan.day) ? { day: t.plan.day, start: isTime(t.plan.start) ? t.plan.start : null } : null,
    gear: isObj(t.gear) ? Object.fromEntries(Object.entries(t.gear).filter(([, v]) => v === true).slice(0, 60)) : {},
  };
}

const cleanTrack = pts =>
  (Array.isArray(pts) ? pts : [])
    .filter(p => Array.isArray(p) && isLat(p[0]) && isLon(p[1]) && Number.isFinite(p[3]))
    .map(p => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : null, p[3]])
    .slice(-20000);

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const trails = (Array.isArray(raw.trails) ? raw.trails : []).map(cleanTrail).filter(Boolean);
  const active = isObj(raw.active) && typeof raw.active.id === "string"
    ? {
        id: raw.active.id,
        trailId: str(raw.active.trailId, 60) || null,
        name: str(raw.active.name, 100) || "Hike",
        startedAt: num(raw.active.startedAt, Date.now() / 1000),
        mode: ["full", "saver", "sparse", "manual"].includes(raw.active.mode) ? raw.active.mode : "saver",
        points: cleanTrack(raw.active.points),
        pausedAt: num(raw.active.pausedAt),
      }
    : null;
  return {
    ...base,
    units: raw.units === "metric" ? "metric" : "us",
    pace: [0.8, 1, 1.2, 1.45].includes(raw.pace) ? raw.pace : 1,
    trackMode: ["full", "saver", "sparse", "manual"].includes(raw.trackMode) ? raw.trackMode : "saver",
    place: cleanPlace(raw.place),
    trails: keepTrails(trails),
    hikes: (Array.isArray(raw.hikes) ? raw.hikes : [])
      .filter(isObj)
      .map(h => ({
        id: str(h.id, 40),
        trailId: str(h.trailId, 60) || null,
        name: str(h.name, 100) || "Hike",
        startedAt: num(h.startedAt, 0),
        endedAt: num(h.endedAt, 0),
        points: cleanTrack(h.points),
        distance: num(h.distance, 0),
        moving: num(h.moving, 0),
        gain: num(h.gain, 0),
      }))
      .filter(h => h.id)
      .slice(0, MAX_HIKES),
    active,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

/** Saved and planned trails all stay; only the most recent unsaved views are kept. */
function keepTrails(trails) {
  const seen = new Set();
  const unique = trails.filter(t => !seen.has(t.id) && seen.add(t.id));
  const kept = unique.filter(t => t.saved || t.plan || t.offline);
  const recent = unique
    .filter(t => !(t.saved || t.plan || t.offline))
    .sort((a, b) => (b.viewedAt || "").localeCompare(a.viewedAt || ""))
    .slice(0, MAX_RECENT);
  return [...kept, ...recent];
}

/** Put a trail in the list (replacing one with the same id), keeping the list tidy. */
export function upsertTrail(trails, trail) {
  const clean = cleanTrail(trail);
  if (!clean) return trails;
  const old = trails.find(t => t.id === clean.id);
  const merged = old ? { ...clean, saved: clean.saved || old.saved, savedAt: clean.savedAt || old.savedAt, offline: clean.offline ?? old.offline, plan: clean.plan ?? old.plan, gear: { ...old.gear, ...clean.gear } } : clean;
  return keepTrails([merged, ...trails.filter(t => t.id !== clean.id)]);
}

export function loadData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage full or blocked: keep working in memory
  }
}

// Units.
export const fmt = units => {
  const us = units !== "metric";
  return {
    dist: m => (us ? `${(m / 1609.344).toFixed(m < 16093 ? 1 : 0)} mi` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`),
    short: m => (us ? (m < 305 ? `${Math.round(m * 3.28084)} ft` : `${(m / 1609.344).toFixed(1)} mi`) : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`),
    ele: m => (Number.isFinite(m) ? (us ? `${Math.round(m * 3.28084).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`) : "—"),
    temp: c => (us ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`),
    wind: k => (us ? `${Math.round(k / 1.609)} mph` : `${Math.round(k)} km/h`),
    vol: l => (us ? `${l} L (${Math.round(l * 33.8)} oz)` : `${l} L`),
    eleUnit: us ? "ft" : "m",
    toEle: m => (us ? m * 3.28084 : m),
    distUnit: us ? "mi" : "km",
    toDist: m => (us ? m / 1609.344 : m / 1000),
  };
};

export function duration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}
