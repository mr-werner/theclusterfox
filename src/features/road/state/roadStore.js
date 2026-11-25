// RoadFox's saved data, in this browser: your trip settings, car, saved
// trips and game progress. Plain functions so tests and TaskFox can use them.

import { VEHICLE_PRESETS } from "../model/fuel.js";
import { DEFAULT_DRIVE } from "../model/days.js";
import { STAY_BY_ID } from "../model/stays.js";

export const STORAGE_KEY = "roadfox-data-v1";

export function emptyData() {
  return {
    version: 1,
    from: null, // { id, name, region, lat, lon }
    to: null,
    departDate: null, // "YYYY-MM-DD"
    hoursPerDay: 7,
    drive: { ...DEFAULT_DRIVE }, // your driving day: start/finish (minutes after midnight), flex minutes, stay kind, $ a night
    dayTimes: {}, // { dayIndex: { start, finish } } for days that differ
    plan: "planned", // planned | further | earlier
    vehicle: { ...VEHICLE_PRESETS[1] },
    pack: emptyPack(),
    trips: [],
    games: { plates: {}, bingo: null, alphabet: null, trivia: { right: 0, asked: 0 } },
    updatedAt: null,
  };
}

/**
 * Where you're staying and what you've packed. The first stay is the trip's
 * end (place null); others are places you go on to. checked: { itemId: true }.
 */
export function emptyPack() {
  return { stays: [{ id: "end", place: null, nights: 2 }], roundTrip: false, checked: {} };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const str = (v, max = 80) => (typeof v === "string" ? v.slice(0, max) : "");
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function cleanPlace(p) {
  if (!isObj(p) || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
  return { id: str(p.id, 40) || `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`, name: str(p.name) || "Somewhere", region: str(p.region), lat: p.lat, lon: p.lon };
}

function cleanVehicle(v) {
  const base = VEHICLE_PRESETS[1];
  if (!isObj(v)) return { ...base };
  const kind = ["gas", "diesel", "ev"].includes(v.kind) ? v.kind : "gas";
  return {
    id: str(v.id, 20) || "custom",
    name: str(v.name, 40) || "My car",
    kind,
    mpg: num(v.mpg, base.mpg, 3, 150),
    tankGal: num(v.tankGal, base.tankGal, 3, 200),
    rangeMi: num(v.rangeMi, 250, 50, 700),
    plug: ["ccs", "nacs", "chademo"].includes(v.plug) ? v.plug : "ccs",
  };
}

function cleanStop(s) {
  const p = cleanPlace(s);
  if (!p) return null;
  return { ...p, label: str(s.label, 30), theme: str(s.theme, 12), mile: num(s.mile, 0, 0, 20000), minutes: num(s.minutes, 45, 0, 600), wiki: /^https:\/\//.test(s.wiki ?? "") ? s.wiki : null };
}

export function cleanPack(p) {
  if (!isObj(p)) return emptyPack();
  const stays = (Array.isArray(p.stays) ? p.stays : [])
    .filter(isObj)
    .slice(0, 6)
    .map((s, i) => ({ id: i === 0 ? "end" : str(s.id, 40) || `s${i}`, place: i === 0 ? null : cleanPlace(s.place), nights: num(Math.round(s.nights), 2, 1, 30) }))
    .filter((s, i) => i === 0 || s.place);
  const checked = {};
  for (const [k, v] of Object.entries(isObj(p.checked) ? p.checked : {}).slice(0, 80)) if (v === true && /^[a-z-]{1,30}$/.test(k)) checked[k] = true;
  return { stays: stays.length ? stays : emptyPack().stays, roundTrip: p.roundTrip === true, checked };
}

function cleanTrip(t) {
  if (!isObj(t) || !str(t.id, 40)) return null;
  const from = cleanPlace(t.from);
  const to = cleanPlace(t.to);
  const line = (Array.isArray(t.line) ? t.line : []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 500);
  if (!from || !to || line.length < 2) return null;
  return {
    id: str(t.id, 40),
    title: str(t.title, 90) || `${from.name} to ${to.name}`,
    from,
    to,
    theme: str(t.theme, 12) || "fastest",
    departDate: isDay(t.departDate) ? t.departDate : null,
    hoursPerDay: num(t.hoursPerDay, 7, 1, 16),
    miles: num(t.miles, 0, 0, 20000),
    minutes: num(t.minutes, 0, 0, 100000),
    line,
    stops: (Array.isArray(t.stops) ? t.stops : []).map(cleanStop).filter(Boolean).slice(0, 25),
    days: (Array.isArray(t.days) ? t.days : [])
      .filter(isObj)
      .slice(0, 30)
      .map(d => ({ driveMinutes: num(d.driveMinutes, 0, 0, 2000), stopMinutes: num(d.stopMinutes, 0, 0, 2000), miles: num(d.miles, 0, 0, 2000), endName: str(d.endName, 60), stopNames: (Array.isArray(d.stopNames) ? d.stopNames : []).map(s => str(s, 90)).slice(0, 10) })),
    pack: cleanPack(t.pack),
    createdAt: str(t.createdAt, 30),
  };
}

export function cleanDrive(d) {
  const base = DEFAULT_DRIVE;
  if (!isObj(d)) return { ...base };
  const start = num(Math.round(d.start), base.start, 0, 23 * 60);
  const finish = num(Math.round(d.finish), base.finish, 60, 28 * 60);
  return {
    start,
    finish: finish > start + 30 ? finish : Math.min(28 * 60, start + 10 * 60),
    flex: num(Math.round(d.flex), base.flex, 15, 240),
    stay: STAY_BY_ID[d.stay] ? d.stay : base.stay,
    budget: num(Math.round(d.budget), base.budget, 0, 2000),
  };
}

export function cleanDayTimes(t) {
  const out = {};
  for (const [k, v] of Object.entries(isObj(t) ? t : {}).slice(0, 40)) {
    if (!/^\d{1,2}$/.test(k) || !isObj(v)) continue;
    const day = {};
    if (Number.isFinite(v.start)) day.start = num(Math.round(v.start), 480, 0, 23 * 60);
    if (Number.isFinite(v.finish)) day.finish = num(Math.round(v.finish), 1080, 60, 28 * 60);
    if (Object.keys(day).length) out[k] = day;
  }
  return out;
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const g = isObj(raw.games) ? raw.games : {};
  const plates = {};
  for (const [k, v] of Object.entries(isObj(g.plates) ? g.plates : {})) if (/^[A-Z]{2}$/.test(k) && v) plates[k] = true;
  const bingo = isObj(g.bingo) && Number.isFinite(g.bingo.seed) ? { seed: g.bingo.seed, marks: (Array.isArray(g.bingo.marks) ? g.bingo.marks : []).filter(i => Number.isInteger(i) && i >= 0 && i < 25).slice(0, 25) } : null;
  const alphabet = isObj(g.alphabet) && Array.isArray(g.alphabet.players) ? { players: g.alphabet.players.filter(isObj).slice(0, 6).map(p => ({ name: str(p.name, 20) || "Player", at: num(p.at, 0, 0, 26) })) } : null;
  return {
    ...base,
    from: cleanPlace(raw.from),
    to: cleanPlace(raw.to),
    departDate: isDay(raw.departDate) ? raw.departDate : null,
    hoursPerDay: num(raw.hoursPerDay, base.hoursPerDay, 1, 16),
    drive: cleanDrive(raw.drive),
    dayTimes: cleanDayTimes(raw.dayTimes),
    plan: ["planned", "further", "earlier"].includes(raw.plan) ? raw.plan : "planned",
    vehicle: cleanVehicle(raw.vehicle),
    pack: cleanPack(raw.pack),
    trips: (Array.isArray(raw.trips) ? raw.trips : []).map(cleanTrip).filter(Boolean).slice(0, 40),
    games: { plates, bingo, alphabet, trivia: isObj(g.trivia) ? { right: num(g.trivia.right, 0, 0), asked: num(g.trivia.asked, 0, 0) } : base.games.trivia },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
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
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
