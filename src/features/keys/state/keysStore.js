// What KeysFox remembers: your practice settings, your best run on each
// song (per difficulty and hand) and a practice log for PlanFox. Saved in
// this browser and, when signed in, to the ClusterFox account.
// Songs you import are kept separately (see importedSongs.js) because they
// can be large; they stay on this device.

export const STORAGE_KEY = "keysfox-data-v1";
export const MAX_HISTORY = 500;

export const DEFAULT_SETTINGS = {
  level: "easy",
  hands: "R",
  mode: "wait",
  speed: 0.75,
  view: "both",
  noteNames: true,
  otherHand: "play",
  metronome: false,
  mySound: true,
  input: "auto",
};

export function emptyData() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, best: {}, history: [], recent: [], updatedAt: null };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, lo, hi, d) => (Number.isFinite(v) && v >= lo && v <= hi ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const str = (v, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");

export function normalizeSettings(raw) {
  const s = isObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    level: oneOf(s.level, ["easy", "medium", "hard"], d.level),
    hands: oneOf(s.hands, ["R", "L", "both"], d.hands),
    mode: oneOf(s.mode, ["wait", "play"], d.mode),
    speed: num(s.speed, 0.25, 1.5, d.speed),
    view: oneOf(s.view, ["both", "falling", "sheet"], d.view),
    noteNames: typeof s.noteNames === "boolean" ? s.noteNames : d.noteNames,
    otherHand: oneOf(s.otherHand, ["play", "mute"], d.otherHand),
    metronome: typeof s.metronome === "boolean" ? s.metronome : d.metronome,
    mySound: typeof s.mySound === "boolean" ? s.mySound : d.mySound,
    input: oneOf(s.input, ["auto", "mic", "keys"], d.input),
  };
}

function cleanRun(r) {
  return {
    id: str(r.id, 40) || `${r.day}-${r.songId}`,
    day: r.day,
    songId: str(r.songId, 40),
    title: str(r.title),
    level: oneOf(r.level, ["easy", "medium", "hard"], "hard"),
    hands: oneOf(r.hands, ["R", "L", "both"], "both"),
    mode: oneOf(r.mode, ["wait", "play"], "wait"),
    speed: num(r.speed, 0.25, 1.5, 1),
    accuracy: Math.round(num(r.accuracy, 0, 100, 0)),
    stars: Math.round(num(r.stars, 0, 3, 0)),
    seconds: Math.round(num(r.seconds, 0, 36000, 0)),
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const best = {};
  if (isObject(raw.best)) {
    for (const [k, v] of Object.entries(raw.best)) {
      if (!isObject(v) || !/^[\w-]{1,40}:(easy|medium|hard):(R|L|both)$/.test(k)) continue;
      best[k] = { accuracy: Math.round(num(v.accuracy, 0, 100, 0)), stars: Math.round(num(v.stars, 0, 3, 0)), speed: num(v.speed, 0.25, 1.5, 1), mode: oneOf(v.mode, ["wait", "play"], "wait") };
    }
  }
  const history = Array.isArray(raw.history) ? raw.history.filter(r => isObject(r) && isDay(r.day) && typeof r.songId === "string").slice(-MAX_HISTORY).map(cleanRun) : [];
  const recent = Array.isArray(raw.recent) ? raw.recent.filter(x => typeof x === "string").slice(0, 8).map(x => x.slice(0, 40)) : [];
  return { ...base, settings: normalizeSettings(raw.settings), best, history, recent, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null };
}

export const bestKey = (songId, level, hands) => `${songId}:${level}:${hands}`;

/** Add a finished run; keeps the best score per song, level and hand. */
export function addRun(data, run) {
  const r = cleanRun(run);
  const k = bestKey(r.songId, r.level, r.hands);
  const prev = data.best[k];
  // A run in time (play mode) beats the same accuracy in wait mode.
  const score = x => x.stars * 1000 + (x.mode === "play" ? 500 : 0) + x.accuracy + x.speed;
  const best = !prev || score(r) >= score(prev) ? { accuracy: r.accuracy, stars: r.stars, speed: r.speed, mode: r.mode } : prev;
  return { ...data, best: { ...data.best, [k]: best }, history: [...data.history, r].slice(-MAX_HISTORY) };
}

/** Remember a song as recently opened. */
export const touchRecent = (data, songId) => ({ ...data, recent: [songId, ...data.recent.filter(x => x !== songId)].slice(0, 8) });

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
    // Storage blocked or full: the app still works for this visit.
  }
}
