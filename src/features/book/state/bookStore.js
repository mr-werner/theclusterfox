// Everything BookFox remembers: your books and where you are in each, your
// highlights, notes and bookmarks, how long you read each day, and how you
// like the page to look. Saved in this browser and, when signed in, to the
// ClusterFox account, so your place follows you from phone to computer.
// The books' text is not in here; it lives in this device's book cache.

export const STORAGE_KEY = "bookfox-data-v1";
export const MAX_SESSIONS = 800;
export const MAX_MARKS = 5000;

export const SHELVES = [
  { id: "reading", name: "Reading" },
  { id: "want", name: "Want to read" },
  { id: "done", name: "Finished" },
];
export const SHELF_IDS = SHELVES.map(s => s.id);

export const COLORS = [
  { id: "yellow", name: "Yellow" },
  { id: "green", name: "Green" },
  { id: "blue", name: "Blue" },
  { id: "pink", name: "Pink" },
];
export const COLOR_IDS = COLORS.map(c => c.id);

export const THEMES = ["paper", "sepia", "night"];
export const FONTS = ["serif", "sans", "mono"];
export const MODES = ["scroll", "pages"];

export function defaultPrefs() {
  return { theme: "paper", size: 19, font: "serif", mode: "pages", spacing: 1.6, width: 38 };
}

export function emptyData() {
  return {
    version: 1,
    books: {}, // key -> { id, title, authors, shelf, added, opened, pos: { b }, progress, finished }
    marks: {}, // markId -> { id, book, kind: "hl" | "bm", a: [block, offset], z: [block, offset], text, note, color, at, edited }
    sessions: [], // { id, day, book, secs, from, to }
    prefs: defaultPrefs(),
    goal: 20, // minutes a day
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v, max = 1e7) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const frac = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const isIso = v => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

/** The key a book is stored under: "1342" or "se:author/title". */
export const bookKey = id => String(id);

/** Back from a key to the id the catalog uses. */
export const idOfKey = key => (/^\d+$/.test(key) ? Number(key) : key);

export const isBookKey = k => typeof k === "string" && (/^\d{1,7}$/.test(k) || /^se:[a-z0-9-]+(\/[a-z0-9-]+){1,4}$/.test(k));

function cleanPos(p) {
  if (!isObject(p)) return null;
  return { b: int(p.b, 1e6) };
}

function cleanBook(key, b) {
  if (!isObject(b)) return null;
  const authors = Array.isArray(b.authors) ? b.authors.filter(a => typeof a === "string").map(a => a.slice(0, 120)).slice(0, 4) : [];
  return {
    id: idOfKey(key),
    title: str(b.title, 300) || "Untitled",
    authors,
    shelf: SHELF_IDS.includes(b.shelf) ? b.shelf : "want",
    added: isIso(b.added) ? b.added : null,
    opened: isIso(b.opened) ? b.opened : null,
    pos: cleanPos(b.pos),
    progress: frac(b.progress),
    finished: isIso(b.finished) ? b.finished : null,
  };
}

function cleanPoint(p) {
  return Array.isArray(p) && p.length === 2 ? [int(p[0], 1e6), int(p[1], 1e6)] : null;
}

function cleanMark(id, m, books) {
  if (!isObject(m) || !isBookKey(m.book) || !books[m.book]) return null;
  const kind = m.kind === "bm" ? "bm" : "hl";
  const a = cleanPoint(m.a);
  const z = cleanPoint(m.z) ?? a;
  if (!a || !z) return null;
  const [start, end] = comparePoints(a, z) <= 0 ? [a, z] : [z, a];
  return {
    id: str(id, 40),
    book: m.book,
    kind,
    a: start,
    z: end,
    text: str(m.text, 4000),
    note: str(m.note, 8000),
    color: COLOR_IDS.includes(m.color) ? m.color : "yellow",
    at: isIso(m.at) ? m.at : new Date(0).toISOString(),
    edited: isIso(m.edited) ? m.edited : null,
    label: str(m.label, 200),
  };
}

export function comparePoints(p, q) {
  return p[0] - q[0] || p[1] - q[1];
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const books = {};
  if (isObject(raw.books)) {
    for (const [key, b] of Object.entries(raw.books)) {
      if (!isBookKey(key)) continue;
      const clean = cleanBook(key, b);
      if (clean) books[key] = clean;
    }
  }
  const marks = {};
  if (isObject(raw.marks)) {
    for (const [id, m] of Object.entries(raw.marks).slice(-MAX_MARKS)) {
      const clean = cleanMark(id, m, books);
      if (clean) marks[clean.id] = clean;
    }
  }
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .filter(s => isObject(s) && isDay(s.day) && isBookKey(s.book))
        .slice(-MAX_SESSIONS)
        .map(s => ({ id: str(s.id, 60) || `${s.day}:${s.book}`, day: s.day, book: s.book, secs: int(s.secs, 86400), from: frac(s.from), to: frac(s.to) }))
    : [];
  const p = isObject(raw.prefs) ? raw.prefs : {};
  const d = defaultPrefs();
  const prefs = {
    theme: THEMES.includes(p.theme) ? p.theme : d.theme,
    size: Number.isFinite(p.size) ? Math.min(32, Math.max(13, Math.round(p.size))) : d.size,
    font: FONTS.includes(p.font) ? p.font : d.font,
    mode: MODES.includes(p.mode) ? p.mode : d.mode,
    spacing: Number.isFinite(p.spacing) ? Math.min(2.2, Math.max(1.2, Math.round(p.spacing * 10) / 10)) : d.spacing,
    width: Number.isFinite(p.width) ? Math.min(50, Math.max(28, Math.round(p.width))) : d.width,
  };
  return {
    ...base,
    books,
    marks,
    sessions,
    prefs,
    goal: Number.isInteger(raw.goal) && raw.goal >= 0 && raw.goal <= 600 ? raw.goal : base.goal,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

/** What BookFox keeps about a book from the catalog. */
export function bookSummary(b) {
  return { title: b.title, authors: (b.authors ?? []).slice(0, 4) };
}

/** Put a book on a shelf (adding it to your books if needed). */
export function shelveBook(data, book, shelf, now = new Date().toISOString()) {
  const key = bookKey(book.id);
  const prev = data.books[key];
  const next = cleanBook(key, {
    ...(prev ?? { added: now, progress: 0 }),
    ...bookSummary(book),
    shelf,
    finished: shelf === "done" ? prev?.finished ?? now : prev?.finished ?? null,
  });
  return { ...data, books: { ...data.books, [key]: next } };
}

/** Take a book off your shelves, with its notes. */
export function removeBook(data, key) {
  if (!data.books[key]) return data;
  const books = { ...data.books };
  delete books[key];
  const marks = Object.fromEntries(Object.entries(data.marks).filter(([, m]) => m.book !== key));
  return { ...data, books, marks };
}

/** Opening a book puts it on Reading and remembers when. */
export function openBook(data, book, now = new Date().toISOString()) {
  const key = bookKey(book.id);
  const prev = data.books[key];
  const shelf = !prev || prev.shelf === "want" ? "reading" : prev.shelf;
  const next = cleanBook(key, { ...(prev ?? { added: now, progress: 0 }), ...bookSummary(book), shelf, opened: now });
  return { ...data, books: { ...data.books, [key]: next } };
}

/** Save your place. progress is 0..1 through the book's own text. */
export function savePlace(data, key, b, progress) {
  const prev = data.books[key];
  if (!prev) return data;
  if (prev.pos?.b === b && Math.abs(prev.progress - progress) < 0.0005) return data;
  return { ...data, books: { ...data.books, [key]: { ...prev, pos: { b }, progress: frac(progress) } } };
}

let counter = 0;
export function newId(prefix = "m") {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Add or replace a highlight or bookmark. */
export function putMark(data, mark, now = new Date().toISOString()) {
  const prev = data.marks[mark.id];
  const clean = cleanMark(mark.id, { ...prev, ...mark, at: prev?.at ?? mark.at ?? now, edited: prev ? now : null }, data.books);
  if (!clean) return data;
  return { ...data, marks: { ...data.marks, [clean.id]: clean } };
}

export function deleteMark(data, id) {
  if (!data.marks[id]) return data;
  const marks = { ...data.marks };
  delete marks[id];
  return { ...data, marks };
}

/** A book's marks in reading order. */
export function marksFor(data, key, kind) {
  return Object.values(data.marks)
    .filter(m => m.book === key && (!kind || m.kind === kind))
    .sort((p, q) => comparePoints(p.a, q.a) || comparePoints(p.z, q.z));
}

/** Add reading time to today's line for a book. */
export function logReading(data, { day, book, secs, from, to }) {
  if (!secs) return data;
  const id = `${day}:${book}`;
  const i = data.sessions.findIndex(s => s.id === id);
  const sessions = [...data.sessions];
  if (i >= 0) sessions[i] = { ...sessions[i], secs: Math.min(86400, sessions[i].secs + secs), to: frac(to) };
  else sessions.push({ id, day, book, secs: Math.min(86400, secs), from: frac(from), to: frac(to) });
  return { ...data, sessions: sessions.slice(-MAX_SESSIONS) };
}

/** Minutes read on a day, across all books. */
export function minutesOn(data, day) {
  return Math.round(data.sessions.filter(s => s.day === day).reduce((n, s) => n + s.secs, 0) / 60);
}

/** Days in a row, ending today or yesterday, with any reading. */
export function streak(data, today) {
  const days = new Set(data.sessions.filter(s => s.secs >= 60).map(s => s.day));
  const d = new Date(`${today}T12:00:00`);
  if (!days.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) return n;
    n += 1;
    d.setDate(d.getDate() - 1);
  }
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
    // Storage blocked or full: the app still works for this visit.
  }
}
