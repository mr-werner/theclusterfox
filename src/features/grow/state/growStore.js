// Everything GrowFox remembers: your place and climate, the spots in your
// yard, your plants and the jobs you've ticked off. Saved in this browser
// and, when signed in, to the ClusterFox account.
import { plantsById } from "../data/plants.js";
import { FACINGS } from "../model/sun.js";
import { isDayKey } from "../model/dates.js";

export const STORAGE_KEY = "growfox-data-v1";
export const MAX_GARDEN = 300;
export const MAX_SPOTS = 40;
export const MAX_DONE = 3000;
export const THEMES = [
  { id: "meadow", name: "Meadow", hint: "Light linen and fern green" },
  { id: "greenhouse", name: "Greenhouse", hint: "Soft, misty sage" },
  { id: "terracotta", name: "Terracotta", hint: "Warm clay and sun" },
  { id: "night", name: "Night garden", hint: "Dark, easy on the eyes" },
];
const THEME_IDS = THEMES.map(t => t.id);
const LIGHTS = ["full", "part", "shade"];
const SOILS = ["", "clay", "loam", "sand", "wet", "rocky"];

export function emptyData() {
  return {
    version: 1,
    prefs: { theme: "meadow", units: "us", gardenDay: 6 },
    place: null, // { id, name, region, latitude, longitude }
    climate: null, // see model/climate.js computeClimate
    manualZone: null, // a zone picked by hand when there's no place
    hemisphere: "N",
    zoneShift: 0, // -1..1 in half zones: "my garden runs colder/warmer"
    spots: [], // { id, name, facing (FACINGS id | "open"), light, soil, note }
    garden: [], // { id, plantId, spotId, status: "growing"|"planned", planted, name, qty, note, added }
    done: {}, // taskId -> ISO time
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, min, max, fallback) => (Number.isFinite(v) && v >= min && v <= max ? v : fallback);

function cleanPlace(p) {
  if (!isObject(p) || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || typeof p.name !== "string") return null;
  return {
    id: String(p.id ?? `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).slice(0, 60),
    name: p.name.slice(0, 80),
    region: str(p.region, 80),
    latitude: num(p.latitude, -90, 90, 0),
    longitude: num(p.longitude, -180, 180, 0),
  };
}

function cleanClimate(c) {
  if (!isObject(c) || !Number.isFinite(c.zone) || (c.hemisphere !== "N" && c.hemisphere !== "S")) return null;
  const doy = v => (Number.isInteger(v) && v >= 1 && v <= 366 ? v : null);
  const frostless = c.frostless === true || doy(c.lastFrost) == null || doy(c.firstFrost) == null;
  const monthly = Array.isArray(c.monthly) && c.monthly.length === 12 && c.monthly.every(m => isObject(m) && Number.isFinite(m.hi) && Number.isFinite(m.lo) && Number.isFinite(m.rain)) ? c.monthly.map(m => ({ hi: m.hi, lo: m.lo, rain: m.rain })) : null;
  return {
    source: c.source === "zone" ? "zone" : "data",
    years: num(c.years, 0, 100, 0),
    hemisphere: c.hemisphere,
    latitude: Number.isFinite(c.latitude) ? c.latitude : null,
    zone: num(c.zone, 1, 13.5, 6),
    avgMinC: Number.isFinite(c.avgMinC) ? c.avgMinC : null,
    lastFrost: frostless ? null : c.lastFrost,
    firstFrost: frostless ? null : c.firstFrost,
    frostFree: num(c.frostFree, 0, 366, 180),
    frostless,
    monthly,
    summerHigh: Number.isFinite(c.summerHigh) ? c.summerHigh : null,
    summerRain: Number.isFinite(c.summerRain) ? c.summerRain : null,
    annualRain: Number.isFinite(c.annualRain) ? c.annualRain : null,
    placeId: str(c.placeId, 60),
    fetchedAt: str(c.fetchedAt, 40),
  };
}

function cleanSpot(s) {
  if (!isObject(s) || typeof s.id !== "string") return null;
  return {
    id: s.id.slice(0, 40),
    name: str(s.name, 60) || "Garden spot",
    facing: s.facing === "open" || FACINGS.some(f => f.id === s.facing) ? s.facing : "open",
    light: LIGHTS.includes(s.light) ? s.light : "full",
    soil: SOILS.includes(s.soil) ? s.soil : "",
    note: str(s.note, 300),
  };
}

function cleanEntry(e, spotIds) {
  if (!isObject(e) || typeof e.id !== "string" || !plantsById.has(e.plantId)) return null;
  return {
    id: e.id.slice(0, 40),
    plantId: e.plantId,
    spotId: spotIds.has(e.spotId) ? e.spotId : null,
    status: e.status === "planned" ? "planned" : "growing",
    planted: isDayKey(e.planted) ? e.planted : null,
    name: str(e.name, 60),
    qty: num(e.qty, 1, 9999, 1),
    note: str(e.note, 500),
    added: str(e.added, 40),
  };
}

export function normalizeData(value) {
  const base = emptyData();
  if (!isObject(value)) return base;
  const p = isObject(value.prefs) ? value.prefs : {};
  const spots = (Array.isArray(value.spots) ? value.spots : []).map(cleanSpot).filter(Boolean).slice(0, MAX_SPOTS);
  const spotIds = new Set(spots.map(s => s.id));
  const done = {};
  if (isObject(value.done)) {
    const entries = Object.entries(value.done).filter(([k, v]) => typeof k === "string" && k.length < 120 && typeof v === "string");
    for (const [k, v] of entries.slice(-MAX_DONE)) done[k] = v.slice(0, 40);
  }
  return {
    version: 1,
    prefs: {
      theme: THEME_IDS.includes(p.theme) ? p.theme : base.prefs.theme,
      units: p.units === "metric" ? "metric" : "us",
      gardenDay: num(p.gardenDay, 0, 6, 6),
    },
    place: cleanPlace(value.place),
    climate: cleanClimate(value.climate),
    manualZone: Number.isFinite(value.manualZone) && value.manualZone >= 1 && value.manualZone <= 13.5 ? value.manualZone : null,
    hemisphere: value.hemisphere === "S" ? "S" : "N",
    zoneShift: num(value.zoneShift, -1, 1, 0),
    spots,
    garden: (Array.isArray(value.garden) ? value.garden : []).map(e => cleanEntry(e, spotIds)).filter(Boolean).slice(0, MAX_GARDEN),
    done,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

// First visit: borrow the place and units already set in SkyFox.
function borrowed() {
  try {
    const sky = JSON.parse(window.localStorage.getItem("clocast-data-v1"));
    const out = {};
    if (sky?.place) out.place = sky.place;
    if (sky?.units === "metric") out.prefs = { ...emptyData().prefs, units: "metric" };
    return out;
  } catch {
    return {};
  }
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw === null ? { ...emptyData(), ...borrowed() } : JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}
