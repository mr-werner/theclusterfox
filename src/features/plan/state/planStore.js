// Everything the planner remembers lives in one document. It is kept in
// this browser for everyone, and mirrored to the account when signed in.

import { isDayKey } from "../model/dates.js";

export const STORAGE_KEY = "clusterfox:plan-v1";
const MAX_ITEMS = 1500;
const MAX_TOMBSTONES = 300;
const MAX_FEEDS = 12;
const MAX_TEAMS = 30;

/**
 * Layers the calendar can show. source says where the data comes from;
 * needsKey marks layers that only work once a server key is set.
 */
export const LAYERS = [
  { id: "weather", name: "Weather", group: "Outside", source: "Open-Meteo, 14 days ahead" },
  { id: "wear", name: "What to wear", group: "Outside", source: "CloCast clothing model" },
  { id: "alerts", name: "Severe weather alerts", group: "Outside", source: "National Weather Service (US only)" },
  { id: "car", name: "Car checks", group: "Outside", source: "From the forecast" },
  { id: "garden", name: "Gardening", group: "Outside", source: "From the forecast, plus monthly jobs" },
  { id: "events", name: "My events", group: "Mine" },
  { id: "tasks", name: "Tasks", group: "Mine" },
  { id: "bills", name: "Bills", group: "Mine" },
  { id: "deadlines", name: "Work & school deadlines", group: "Mine" },
  { id: "training", name: "Training", group: "Mine", source: "Best outdoor times from CloCast" },
  { id: "feeds", name: "Linked calendars", group: "Mine", source: "School, work or team calendar links (.ics)" },
  { id: "holidays", name: "Holidays & closures", group: "World", source: "Federal holidays and observances" },
  { id: "sports", name: "Sports", group: "World", source: "ESPN schedules" },
  { id: "movies", name: "Movie releases", group: "World", source: "TMDB" },
  { id: "games", name: "Game releases", group: "World", source: "RAWG", needsKey: "RAWG_API_KEY" },
  { id: "nearby", name: "Events nearby", group: "World", source: "Concerts, games and shows from Ticketmaster", needsKey: "TICKETMASTER_API_KEY" },
  { id: "flights", name: "Cheap flight days", group: "World", source: "Recent fares from Travelpayouts", needsKey: "TRAVELPAYOUTS_TOKEN" },
];

// Kinds of nearby events people can filter to.
export const NEARBY_KINDS = [
  { id: "music", name: "Concerts" },
  { id: "sports", name: "Sports" },
  { id: "arts", name: "Theater & comedy" },
  { id: "family", name: "Family" },
  { id: "other", name: "Other" },
];
export const RADII = [10, 25, 50];

// Short labels for the layer bar.
const SHORT = { nearby: "Nearby", flights: "Flights", alerts: "Alerts", wear: "Wear", car: "Car", garden: "Garden", events: "Events", deadlines: "Deadlines", feeds: "Linked", holidays: "Holidays", movies: "Movies", games: "Games" };
for (const layer of LAYERS) if (SHORT[layer.id]) layer.short = SHORT[layer.id];

// Quick setups: each switches on the layers that fit a way of planning.
export const PRESETS = [
  { id: "everyday", name: "Everyday life", hint: "Weather, what to wear, car checks, bills, closures", layers: ["weather", "alerts", "wear", "car", "events", "tasks", "bills", "holidays"] },
  { id: "training", name: "Training", hint: "Best times to train outside, what to wear for it", layers: ["weather", "wear", "training", "events"] },
  { id: "family", name: "School & family", hint: "Deadlines, school calendars, holidays, tasks", layers: ["events", "tasks", "deadlines", "feeds", "holidays", "weather", "wear"] },
  { id: "fan", name: "Sports fan", hint: "Your teams' games and traffic near stadiums", layers: ["sports", "events", "weather"] },
  { id: "fun", name: "Entertainment", hint: "Concerts and shows nearby, movie and game releases", layers: ["nearby", "movies", "games", "events"] },
  { id: "travel", name: "Travel", hint: "Cheapest days to fly, weather, holidays", layers: ["flights", "weather", "holidays", "events"] },
  { id: "home", name: "Home & garden", hint: "Frost and watering, car care, bills, chores", layers: ["weather", "alerts", "garden", "car", "bills", "tasks"] },
];

/**
 * Picking a quick setup switches its layers on; picking it again switches
 * off the ones no other chosen setup needs.
 */
export function togglePreset(layers, preset) {
  const isOn = p => p.layers.every(id => layers[id]);
  if (!isOn(preset)) return { ...layers, ...Object.fromEntries(preset.layers.map(id => [id, true])) };
  const keep = new Set(PRESETS.filter(p => p.id !== preset.id && isOn(p)).flatMap(p => p.layers));
  return { ...layers, ...Object.fromEntries(preset.layers.filter(id => !keep.has(id)).map(id => [id, false])) };
}

export const ITEM_KINDS = [
  { id: "event", name: "Event", layer: "events" },
  { id: "task", name: "Task", layer: "tasks" },
  { id: "bill", name: "Bill", layer: "bills" },
  { id: "deadline", name: "Deadline", layer: "deadlines" },
  { id: "training", name: "Training", layer: "training" },
];
export const itemLayer = kind => ITEM_KINDS.find(k => k.id === kind)?.layer ?? "events";

export const REPEATS = [
  { id: "none", name: "Doesn't repeat" },
  { id: "daily", name: "Every day" },
  { id: "weekly", name: "Every week" },
  { id: "biweekly", name: "Every 2 weeks" },
  { id: "monthly", name: "Every month" },
  { id: "yearly", name: "Every year" },
];

// New calendars start small; quick setup and the layer bar add the rest.
const STARTING_LAYERS = ["weather", "alerts", "wear", "events", "tasks", "holidays"];
const DEFAULT_LAYERS = Object.fromEntries(LAYERS.map(l => [l.id, STARTING_LAYERS.includes(l.id)]));

export function emptyData() {
  return {
    version: 1,
    units: "us",
    country: "US",
    place: null,
    layers: { ...DEFAULT_LAYERS },
    // { id, kind, title, day, time, repeat, until, place, outdoor, amount,
    //   activityId, minutes, notes, done: [day keys], updatedAt }
    items: [],
    deletedItemIds: [],
    // Linked calendars: { id, name, url, updatedAt }
    feeds: [],
    leagues: ["nfl", "cfb", "nba", "nhl", "mlb"],
    // Team names to highlight, e.g. "Bears".
    teams: [],
    trainingActivityId: "run-easy",
    // Training plan: { id, goal, level, days, start, weeks, cardio, time, updatedAt }
    program: null,
    // Plan sessions checked off, by session id.
    programDone: [],
    // Events nearby: miles from your place, and which kinds to show.
    nearby: { radius: 25, kinds: NEARBY_KINDS.map(k => k.id) },
    // Cheap flight days: { code, name } airports or cities.
    flights: { from: null, to: [] },
    // The quick setup card shows until a choice is made or it's closed.
    setupDone: false,
    updatedAt: null,
    syncedUserId: null,
  };
}

function cleanPlace(place) {
  if (!place || typeof place !== "object" || typeof place.name !== "string") return null;
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return null;
  return {
    id: String(place.id ?? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`),
    name: place.name.slice(0, 80),
    region: typeof place.region === "string" ? place.region.slice(0, 80) : "",
    latitude: place.latitude,
    longitude: place.longitude,
    postcode: typeof place.postcode === "string" ? place.postcode.slice(0, 12) : null,
  };
}

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const isTime = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function cleanItem(item) {
  if (!item || typeof item !== "object" || !item.id || !isDayKey(item.day)) return null;
  const kind = ITEM_KINDS.some(k => k.id === item.kind) ? item.kind : "event";
  const amount = Number(item.amount);
  return {
    id: String(item.id),
    kind,
    title: text(item.title, 120).trim() || "Untitled",
    day: item.day,
    time: isTime(item.time) ? item.time : null,
    repeat: REPEATS.some(r => r.id === item.repeat) ? item.repeat : "none",
    until: isDayKey(item.until) ? item.until : null,
    place: cleanPlace(item.place),
    outdoor: item.outdoor === true,
    amount: kind === "bill" && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    activityId: kind === "training" && typeof item.activityId === "string" ? item.activityId : null,
    minutes: kind === "training" ? Math.min(240, Math.max(15, Math.round(Number(item.minutes) || 60))) : null,
    notes: text(item.notes, 1000),
    done: Array.isArray(item.done) ? [...new Set(item.done.filter(isDayKey))].slice(-400) : [],
    updatedAt: item.updatedAt ?? null,
  };
}

function cleanProgram(p) {
  if (!p || typeof p !== "object" || !p.id || !isDayKey(p.start)) return null;
  return {
    id: String(p.id),
    goal: ["general", "strength", "cardio", "5k"].includes(p.goal) ? p.goal : "general",
    level: p.level === "some" ? "some" : "new",
    days: Math.min(6, Math.max(3, Math.round(Number(p.days) || 3))),
    start: p.start,
    weeks: [8, 12, 16].includes(p.weeks) ? p.weeks : 12,
    cardio: ["run", "bike", "walk"].includes(p.cardio) ? p.cardio : "run",
    time: ["any", "morning", "midday", "evening"].includes(p.time) ? p.time : "any",
    updatedAt: p.updatedAt ?? null,
  };
}

const cleanAirport = a =>
  a && typeof a === "object" && /^[A-Z]{3}$/.test(a.code) ? { code: a.code, name: text(a.name, 80).trim() || a.code } : null;

function cleanNearby(n) {
  const base = emptyData().nearby;
  if (!n || typeof n !== "object") return base;
  const kinds = Array.isArray(n.kinds) ? NEARBY_KINDS.map(k => k.id).filter(id => n.kinds.includes(id)) : base.kinds;
  return { radius: RADII.includes(n.radius) ? n.radius : base.radius, kinds };
}

function cleanFlights(f) {
  if (!f || typeof f !== "object") return { from: null, to: [] };
  const from = cleanAirport(f.from);
  const to = (Array.isArray(f.to) ? f.to.map(cleanAirport).filter(Boolean) : []).filter((a, i, list) => a.code !== from?.code && list.findIndex(b => b.code === a.code) === i);
  return { from, to: to.slice(0, 3) };
}

function cleanFeed(feed) {
  if (!feed || typeof feed !== "object" || !feed.id || typeof feed.url !== "string") return null;
  return { id: String(feed.id), name: text(feed.name, 60).trim() || "Calendar", url: feed.url.slice(0, 1000), updatedAt: feed.updatedAt ?? null };
}

const cleanList = (list, clean, max) => (Array.isArray(list) ? list.map(clean).filter(Boolean).slice(0, max) : []);
const cleanTombstones = list => (Array.isArray(list) ? list.filter(t => t && t.id).slice(-MAX_TOMBSTONES) : []);

export function normalizeData(value) {
  const base = emptyData();
  if (!value || typeof value !== "object") return base;
  const layers = { ...base.layers };
  if (value.layers && typeof value.layers === "object") {
    for (const id of Object.keys(layers)) if (typeof value.layers[id] === "boolean") layers[id] = value.layers[id];
  }
  return {
    ...base,
    units: value.units === "metric" ? "metric" : "us",
    country: typeof value.country === "string" && /^[A-Z]{2}$/.test(value.country) ? value.country : base.country,
    place: cleanPlace(value.place),
    layers,
    items: cleanList(value.items, cleanItem, MAX_ITEMS),
    deletedItemIds: cleanTombstones(value.deletedItemIds),
    feeds: cleanList(value.feeds, cleanFeed, MAX_FEEDS),
    leagues: Array.isArray(value.leagues) ? [...new Set(value.leagues.filter(l => typeof l === "string"))].slice(0, 20) : base.leagues,
    teams: Array.isArray(value.teams)
      ? [...new Set(value.teams.filter(t => typeof t === "string").map(t => t.trim().slice(0, 40)).filter(Boolean))].slice(0, MAX_TEAMS)
      : [],
    trainingActivityId: typeof value.trainingActivityId === "string" ? value.trainingActivityId : base.trainingActivityId,
    program: cleanProgram(value.program),
    nearby: cleanNearby(value.nearby),
    flights: cleanFlights(value.flights),
    programDone: Array.isArray(value.programDone) ? [...new Set(value.programDone.filter(id => typeof id === "string"))].slice(-600) : [],
    setupDone: value.setupDone === true || (Array.isArray(value.items) && value.items.length > 0),
    updatedAt: value.updatedAt ?? null,
    syncedUserId: value.syncedUserId ?? null,
  };
}

// First visit: borrow the place and units already set in CloCast, and the
// leagues picked in WatchFox.
function borrowed() {
  const out = {};
  try {
    const clo = JSON.parse(window.localStorage.getItem("clocast-data-v1"));
    if (clo?.place) out.place = clo.place;
    if (clo?.units) out.units = clo.units;
  } catch {
    /* nothing to borrow */
  }
  try {
    const watch = JSON.parse(window.localStorage.getItem("clusterfox:watch-v1"));
    if (Array.isArray(watch?.leagues) && watch.leagues.length) out.leagues = watch.leagues;
  } catch {
    /* nothing to borrow */
  }
  return out;
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

const time = value => (value ? Date.parse(value) || 0 : 0);

// Items merge one by one (newest edit wins, deletions stick).
function mergeItems(listA, listB, tombA, tombB) {
  const deleted = new Map();
  for (const entry of [...tombA, ...tombB]) {
    if (time(entry.at) >= time(deleted.get(entry.id)?.at)) deleted.set(entry.id, entry);
  }
  const items = new Map();
  for (const item of [...listA, ...listB]) {
    const current = items.get(item.id);
    if (!current || time(item.updatedAt) > time(current.updatedAt)) items.set(item.id, item);
  }
  for (const [id, entry] of deleted) {
    if (items.has(id) && time(items.get(id).updatedAt) <= time(entry.at)) items.delete(id);
  }
  return { items: [...items.values()], tombstones: [...deleted.values()].slice(-MAX_TOMBSTONES) };
}

// Settings follow the newer document; items and linked calendars merge.
export function mergeData(local, remote) {
  const a = normalizeData(local);
  const b = normalizeData(remote);
  const newer = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  const older = newer === a ? b : a;
  const items = mergeItems(a.items, b.items, a.deletedItemIds, b.deletedItemIds);
  const feeds = [...newer.feeds];
  for (const feed of older.feeds) if (!feeds.some(f => f.id === feed.id || f.url === feed.url)) feeds.push(feed);
  return {
    ...newer,
    place: newer.place ?? older.place,
    items: items.items.sort((x, y) => x.day.localeCompare(y.day)),
    deletedItemIds: items.tombstones,
    feeds: feeds.slice(0, MAX_FEEDS),
    programDone: [...new Set([...a.programDone, ...b.programDone])].slice(-600),
    setupDone: a.setupDone || b.setupDone,
    updatedAt: [a.updatedAt, b.updatedAt].sort((x, y) => time(y) - time(x))[0] ?? null,
    syncedUserId: a.syncedUserId,
  };
}

export function toRemote(data) {
  // eslint-disable-next-line no-unused-vars
  const { syncedUserId, ...rest } = data;
  return rest;
}
