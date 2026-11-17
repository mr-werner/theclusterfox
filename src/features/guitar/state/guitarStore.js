// Everything FretFox remembers: how you like to practice, your best score
// on each song, a practice log for PlanFox, and songs you imported. Saved
// in this browser and, when signed in, to the ClusterFox account.

export const STORAGE_KEY = "fretfox-data-v1";
export const MAX_HISTORY = 400;
export const MAX_SONGS = 40;
export const MAX_NOTES = 3000;

const PARTS = ["lead", "rhythm", "both"];
const LEVELS = ["easy", "medium", "hard"];
const SIGS = ["4/4", "3/4", "6/8"];

export function emptyData() {
  return {
    version: 1,
    prefs: { part: "lead", level: "medium", speed: 0.75, staff: true, metronome: true, backing: true, wait: false, lefty: false, sound: true },
    best: {}, // songId -> { "lead:medium": accuracy 0-100 }
    history: [], // { id, day, songId, title, part, level, minutes, accuracy (or null) }
    songs: [], // imported songs (same shape as the built-in ones)
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, lo, hi, d) => (Number.isFinite(v) && v >= lo && v <= hi ? v : d);
const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");

/** Cleans an imported song so nothing odd from storage reaches the player. */
export function cleanSong(s) {
  if (!isObject(s) || typeof s.id !== "string" || !s.id.startsWith("u-")) return null;
  const out = {
    id: s.id.slice(0, 40),
    title: str(s.title, 120) || "Imported song",
    by: str(s.by, 120) || "Imported",
    sig: SIGS.includes(s.sig) ? s.sig : "4/4",
    bpm: Math.round(num(s.bpm, 30, 260, 90)),
    key: str(s.key, 6),
    level: Math.round(num(s.level, 1, 3, 2)),
    imported: true,
    source: str(s.source, 20),
    addedAt: str(s.addedAt, 40),
  };
  if (typeof s.chords === "string" && s.chords.length < 8000) out.chords = s.chords;
  if (Array.isArray(s.notes)) {
    out.notes = s.notes
      .filter(n => isObject(n) && Number.isInteger(n.midi) && n.midi >= 20 && n.midi <= 110 && Number.isFinite(n.beat) && n.beats > 0)
      .slice(0, MAX_NOTES)
      .map(n => ({ midi: n.midi, beat: Math.round(n.beat * 1000) / 1000, beats: Math.round(n.beats * 1000) / 1000 }));
    if (!out.notes.length) delete out.notes;
  }
  if (Array.isArray(s.tab)) {
    out.tab = s.tab
      .filter(t => Array.isArray(t) && Number.isInteger(t[0]) && t[0] >= 0 && t[0] <= 5 && Number.isInteger(t[1]) && t[1] >= 0 && t[1] <= 24)
      .slice(0, MAX_NOTES)
      .map(t => [t[0], t[1], num(t[2], -8, 1e5, 0), num(t[3], 0.05, 64, 1)]);
    if (!out.tab.length) delete out.tab;
  }
  if (!out.notes && !out.tab && !out.chords) return null;
  if (!out.notes && !out.tab) out.rhythmOnly = true;
  return out;
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const p = isObject(raw.prefs) ? raw.prefs : {};
  const prefs = {
    part: PARTS.includes(p.part) ? p.part : base.prefs.part,
    level: LEVELS.includes(p.level) ? p.level : base.prefs.level,
    speed: num(p.speed, 0.25, 1.5, base.prefs.speed),
    staff: typeof p.staff === "boolean" ? p.staff : base.prefs.staff,
    metronome: typeof p.metronome === "boolean" ? p.metronome : base.prefs.metronome,
    backing: typeof p.backing === "boolean" ? p.backing : base.prefs.backing,
    wait: typeof p.wait === "boolean" ? p.wait : base.prefs.wait,
    lefty: typeof p.lefty === "boolean" ? p.lefty : base.prefs.lefty,
    sound: typeof p.sound === "boolean" ? p.sound : base.prefs.sound,
  };
  const best = {};
  if (isObject(raw.best)) {
    for (const [id, rec] of Object.entries(raw.best).slice(0, 500)) {
      if (!isObject(rec)) continue;
      const clean = {};
      for (const [k, v] of Object.entries(rec)) {
        const [part, level] = k.split(":");
        if (PARTS.includes(part) && LEVELS.includes(level) && Number.isFinite(v)) clean[k] = Math.round(Math.min(100, Math.max(0, v)));
      }
      if (Object.keys(clean).length) best[str(id, 40)] = clean;
    }
  }
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter(h => isObject(h) && isDay(h.day) && typeof h.songId === "string")
        .slice(-MAX_HISTORY)
        .map(h => ({
          id: str(h.id, 40) || `${h.day}-${h.songId}`,
          day: h.day,
          songId: str(h.songId, 40),
          title: str(h.title, 120),
          part: PARTS.includes(h.part) ? h.part : "lead",
          level: LEVELS.includes(h.level) ? h.level : "medium",
          minutes: num(h.minutes, 0, 600, 0),
          accuracy: Number.isFinite(h.accuracy) ? Math.round(Math.min(100, Math.max(0, h.accuracy))) : null,
        }))
    : [];
  const songs = Array.isArray(raw.songs) ? raw.songs.map(cleanSong).filter(Boolean).slice(0, MAX_SONGS) : [];
  return { version: 1, prefs, best, history, songs, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null };
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
    /* storage full or blocked: keep going for this visit */
  }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Log a practice run. Runs of the same song, part and level on one day add up. */
export function addPractice(data, { songId, title, part, level, minutes, accuracy = null, day = today() }) {
  const history = [...data.history];
  const i = history.findIndex(h => h.day === day && h.songId === songId && h.part === part && h.level === level);
  if (i >= 0) {
    const h = history[i];
    history[i] = { ...h, minutes: Math.round((h.minutes + minutes) * 10) / 10, accuracy: accuracy == null ? h.accuracy : Math.max(h.accuracy ?? 0, accuracy) };
  } else {
    history.push({ id: `${day}-${songId}-${part}-${level}`.slice(0, 40), day, songId, title, part, level, minutes: Math.round(minutes * 10) / 10, accuracy });
  }
  let best = data.best;
  if (accuracy != null) {
    const key = `${part}:${level}`;
    const prev = best[songId]?.[key] ?? -1;
    if (accuracy > prev) best = { ...best, [songId]: { ...best[songId], [key]: accuracy } };
  }
  return { ...data, history: history.slice(-MAX_HISTORY), best };
}

export function addSong(data, song) {
  const clean = cleanSong(song);
  if (!clean) return data;
  return { ...data, songs: [clean, ...data.songs.filter(s => s.id !== clean.id)].slice(0, MAX_SONGS) };
}

export const removeSong = (data, id) => ({ ...data, songs: data.songs.filter(s => s.id !== id) });
