// Everything StudyFox remembers: the decks you added from other apps (as
// links, never copies), the review schedule for each thing in them, a
// day-by-day log of how much you studied, and your reminder settings.
// Saved in this browser and, when signed in, to the ClusterFox account.
//
// Other apps add and remove decks through src/app/studyShelf.js, which
// uses addDeck/removeDeck below on this same saved document.
import { isDay } from "../model/dates.js";
import { grade } from "../model/srs.js";

export const STORAGE_KEY = "studyfox-data-v1";
export const MAX_DECKS = 200;
export const MAX_ITEMS = 6000;
export const MAX_LOG = 400;

export function emptyData() {
  return {
    version: 1,
    decks: [], // [{ app, id, title, added (ISO) }], newest first
    items: {}, // "app:deck:kind:id" -> { ivl, ease, reps, lapses, due, last, first }
    log: [], // [{ day, n, right }]
    settings: { newPerDay: 15, time: "18:00", remind: true },
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, lo, hi, dflt) => (Number.isFinite(v) && v >= lo && v <= hi ? v : dflt);
const isTime = v => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const ID = /^[\w.#@ ()'&,/+-]{1,80}$/;

export const deckKey = (app, id) => `${app}:${id}`;
export const itemKey = (app, deck, kind, id) => `${app}:${deck}:${kind}:${id}`;

function cleanItem(r) {
  if (!isObject(r)) return null;
  return {
    ivl: Math.round(num(r.ivl, 0, 365, 0)),
    ease: num(r.ease, 1.3, 5, 2.5),
    reps: Math.round(num(r.reps, 0, 1e5, 0)),
    lapses: Math.round(num(r.lapses, 0, 1e5, 0)),
    due: isDay(r.due) ? r.due : null,
    last: isDay(r.last) ? r.last : null,
    first: isDay(r.first) ? r.first : null,
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const seen = new Set();
  const decks = (Array.isArray(raw.decks) ? raw.decks : [])
    .filter(d => isObject(d) && typeof d.app === "string" && /^[a-z0-9]{2,20}$/.test(d.app) && typeof d.id === "string" && ID.test(d.id))
    .filter(d => {
      const k = deckKey(d.app, d.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_DECKS)
    .map(d => ({ app: d.app, id: d.id, title: str(d.title) || d.id, added: str(d.added, 40) || null }));
  const items = {};
  if (isObject(raw.items)) {
    for (const [k, v] of Object.entries(raw.items).slice(-MAX_ITEMS)) {
      const item = typeof k === "string" && k.length <= 200 ? cleanItem(v) : null;
      if (item) items[k] = item;
    }
  }
  const log = (Array.isArray(raw.log) ? raw.log : [])
    .filter(e => isObject(e) && isDay(e.day))
    .slice(-MAX_LOG)
    .map(e => ({ day: e.day, n: Math.round(num(e.n, 0, 1e5, 0)), right: Math.round(num(e.right, 0, 1e5, 0)) }));
  const s = isObject(raw.settings) ? raw.settings : {};
  return {
    ...base,
    decks,
    items,
    log,
    settings: {
      newPerDay: Math.round(num(s.newPerDay, 0, 200, base.settings.newPerDay)),
      time: isTime(s.time) ? s.time : base.settings.time,
      remind: typeof s.remind === "boolean" ? s.remind : base.settings.remind,
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export const hasDeck = (data, app, id) => data.decks.some(d => d.app === app && d.id === id);

/** Put a deck on the shelf (newest first). Adding twice does nothing. */
export function addDeck(data, { app, id, title }, when = new Date().toISOString()) {
  if (hasDeck(data, app, id)) return data;
  return { ...data, decks: [{ app, id, title: str(title) || id, added: when }, ...data.decks].slice(0, MAX_DECKS) };
}

/** Take a deck off the shelf. Its review schedule is kept, in case it comes back. */
export function removeDeck(data, app, id) {
  return { ...data, decks: data.decks.filter(d => !(d.app === app && d.id === id)) };
}

/** Record one answer: reschedule the item and count it in today's log. */
export function recordReview(data, key, rating, today) {
  const items = { ...data.items, [key]: grade(data.items[key], rating, today) };
  const right = rating !== "again";
  const last = data.log.at(-1);
  const log =
    last?.day === today
      ? [...data.log.slice(0, -1), { day: today, n: last.n + 1, right: last.right + (right ? 1 : 0) }]
      : [...data.log, { day: today, n: 1, right: right ? 1 : 0 }].slice(-MAX_LOG);
  return { ...data, items, log };
}

/** An answer from a quiz, matching or sorting round. Right answers only move
 * things that were due or new, so a quick quiz can't push everything months out. */
export function recordPractice(data, key, right, today) {
  const s = data.items[key];
  if (!right) return recordReview(data, key, "again", today);
  if (s && s.due && s.due > today) return data;
  return recordReview(data, key, "good", today);
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
