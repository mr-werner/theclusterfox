// Everything CalmFox remembers lives in this browser: settings, favorites and history.
import { CUSTOM_DEFAULT, CUSTOM_LIMITS } from "../data/breathing.js";

export const STORAGE_KEY = "calmfox-data-v1";
export const MAX_HISTORY = 300;

export const INTERVALS = [20, 45, 60, 120, 180, 300, 0];
export const CUE_MODES = ["voice", "voiceThenTone", "tone", "off"];
export const AMBIENTS = ["none", "rain", "ocean", "brown", "drone"];
export const MOODS = ["calmer", "same", "restless"];

export function emptyData() {
  return {
    version: 1,
    prefs: {
      interval: 60,
      cueMode: "voiceThenTone",
      pace: 1,
      voiceURI: "",
      rate: 0.85,
      pitch: 1,
      voiceVolume: 1,
      ambient: "rain",
      ambientVolume: 0.35,
      bells: true,
      // Seconds for the "Breathe" experience; a hold or rest of 0 is skipped.
      custom: { ...CUSTOM_DEFAULT },
      // "auto" follows the device; "light" and "dark" pin it.
      theme: "auto",
    },
    favorites: [],
    // { id, date (YYYY-MM-DD), startedAt, sessionId, title, goal, minutes, planned, mood }
    history: [],
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const num = (v, min, max, fallback) => (Number.isFinite(v) && v >= min && v <= max ? v : fallback);

export const THEMES = ["auto", "light", "dark"];

function cleanCustom(c) {
  const out = { ...CUSTOM_DEFAULT };
  if (!isObject(c)) return out;
  for (const [key, [min, max]] of Object.entries(CUSTOM_LIMITS)) {
    if (Number.isFinite(c[key])) out[key] = Math.min(max, Math.max(min, Math.round(c[key])));
  }
  return out;
}

function cleanPrefs(p) {
  const base = emptyData().prefs;
  if (!isObject(p)) return base;
  return {
    interval: INTERVALS.includes(p.interval) ? p.interval : base.interval,
    cueMode: CUE_MODES.includes(p.cueMode) ? p.cueMode : base.cueMode,
    pace: num(p.pace, 0.75, 1.5, base.pace),
    voiceURI: typeof p.voiceURI === "string" ? p.voiceURI.slice(0, 200) : "",
    rate: num(p.rate, 0.5, 1.3, base.rate),
    pitch: num(p.pitch, 0.5, 1.5, base.pitch),
    voiceVolume: num(p.voiceVolume, 0, 1, base.voiceVolume),
    ambient: AMBIENTS.includes(p.ambient) ? p.ambient : base.ambient,
    ambientVolume: num(p.ambientVolume, 0, 1, base.ambientVolume),
    bells: p.bells !== false,
    custom: cleanCustom(p.custom),
    theme: THEMES.includes(p.theme) ? p.theme : base.theme,
  };
}

function cleanEntry(e) {
  if (!isObject(e) || !e.id || typeof e.sessionId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) return null;
  return {
    id: String(e.id),
    date: e.date,
    startedAt: typeof e.startedAt === "string" ? e.startedAt : null,
    sessionId: e.sessionId,
    title: typeof e.title === "string" ? e.title.slice(0, 80) : "Session",
    goal: typeof e.goal === "string" ? e.goal : "",
    minutes: num(e.minutes, 0, 600, 0),
    planned: num(e.planned, 0, 600, 0),
    mood: MOODS.includes(e.mood) ? e.mood : null,
  };
}

export function normalizeData(value) {
  const base = emptyData();
  if (!isObject(value)) return base;
  return {
    ...base,
    prefs: cleanPrefs(value.prefs),
    favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(x => typeof x === "string"))] : [],
    history: Array.isArray(value.history) ? value.history.map(cleanEntry).filter(Boolean).slice(0, MAX_HISTORY) : [],
  };
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw === null ? null : JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private windows); the app still works without it.
  }
}
