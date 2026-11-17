// RoadFox's saved data, in this browser: your trip settings, car, saved
// trips and game progress. Plain functions so tests and PlanFox can use them.

import { VEHICLE_PRESETS } from "../model/fuel.js";

export const STORAGE_KEY = "roadfox-data-v1";

export function emptyData() {
  return {
    version: 1,
    from: null, // { id, name, region, lat, lon }
    to: null,
    departDate: null, // "YYYY-MM-DD"
    hoursPerDay: 7,
    vehicle: { ...VEHICLE_PRESETS[1] },
    trips: [],
    games: { plates: {}, bingo: null, alphabet: null, trivia: { right: 0, asked: 0 } },
    updatedAt: null,
  };
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
    hoursPerDay: num(t.hoursPerDay, 7, 2, 14),
    miles: num(t.miles, 0, 0, 20000),
    minutes: num(t.minutes, 0, 0, 100000),
    line,
    stops: (Array.isArray(t.stops) ? t.stops : []).map(cleanStop).filter(Boolean).slice(0, 25),
    days: (Array.isArray(t.days) ? t.days : [])
      .filter(isObj)
      .slice(0, 30)
      .map(d => ({ driveMinutes: num(d.driveMinutes, 0, 0, 2000), stopMinutes: num(d.stopMinutes, 0, 0, 2000), miles: num(d.miles, 0, 0, 2000), endName: str(d.endName, 60), stopNames: (Array.isArray(d.stopNames) ? d.stopNames : []).map(s => str(s, 90)).slice(0, 10) })),
    createdAt: str(t.createdAt, 30),
  };
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
    hoursPerDay: num(raw.hoursPerDay, base.hoursPerDay, 2, 14),
    vehicle: cleanVehicle(raw.vehicle),
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
