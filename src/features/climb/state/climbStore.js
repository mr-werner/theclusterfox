// ClimbFox's saved data, in this browser: favorite areas, your to-do list,
// your ticks (what you've climbed) and planned climbing days. Plain
// functions so tests and TaskFox can use them.

export const STORAGE_KEY = "climbfox-data-v1";

export const TICK_STYLES = [
  { id: "onsight", name: "Onsight", hint: "First try, no beta" },
  { id: "flash", name: "Flash", hint: "First try, with beta" },
  { id: "redpoint", name: "Redpoint", hint: "Clean send after working it" },
  { id: "toprope", name: "Top rope", hint: "Clean on top rope" },
  { id: "follow", name: "Followed", hint: "Seconded the route" },
  { id: "attempt", name: "Attempt", hint: "Tried it, not sent yet" },
];
const STYLE_IDS = new Set(TICK_STYLES.map(s => s.id));
export const isSend = style => style !== "attempt";

export function emptyData() {
  return {
    version: 1,
    units: "us", // "us" (°F, ft) or "metric"
    saved: [], // [{ uuid, name, path, lat, lng, totalClimbs }]
    recent: [], // same shape, newest first
    todo: [], // [climb snapshot]
    ticks: [], // [{ id, date, style, notes, ...climb snapshot }]
    trips: [], // [{ id, title, day, time, area: area snapshot, routes: [climb snapshot], notes, createdAt }]
    updatedAt: null,
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const numOrNull = v => (Number.isFinite(v) ? v : null);
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The bits of an area worth keeping. */
export function areaSnap(a) {
  if (!isObj(a) || typeof a.uuid !== "string" || !a.uuid) return null;
  return {
    uuid: a.uuid.slice(0, 64),
    name: str(a.name) || "Area",
    path: (Array.isArray(a.path) ? a.path : []).filter(p => typeof p === "string").slice(0, 10).map(p => p.slice(0, 80)),
    lat: numOrNull(a.lat),
    lng: numOrNull(a.lng),
    totalClimbs: Number.isFinite(a.totalClimbs) ? a.totalClimbs : 0,
  };
}

/** The bits of a route worth keeping. */
export function climbSnap(c) {
  if (!isObj(c) || typeof c.uuid !== "string" || !c.uuid) return null;
  const grades = {};
  for (const k of ["yds", "vscale", "french", "font", "ewbank", "uiaa", "wi"]) if (typeof c.grades?.[k] === "string") grades[k] = c.grades[k].slice(0, 12);
  return {
    uuid: c.uuid.slice(0, 64),
    name: str(c.name) || "Route",
    grades,
    types: (Array.isArray(c.types) ? c.types : []).filter(t => typeof t === "string").slice(0, 6),
    length: numOrNull(c.length),
    bolts: numOrNull(c.bolts),
    pitches: Number.isFinite(c.pitches) ? c.pitches : Array.isArray(c.pitches) ? Math.max(1, c.pitches.length) : null,
    areaUuid: str(c.areaUuid, 64) || null,
    areaName: str(c.areaName) || null,
    lat: numOrNull(c.lat),
    lng: numOrNull(c.lng),
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const list = (v, fn, max) => {
    const seen = new Set();
    return (Array.isArray(v) ? v : []).map(fn).filter(x => x && !seen.has(x.uuid ?? x.id) && seen.add(x.uuid ?? x.id)).slice(0, max);
  };
  return {
    ...base,
    units: raw.units === "metric" ? "metric" : "us",
    saved: list(raw.saved, areaSnap, 100),
    recent: list(raw.recent, areaSnap, 12),
    todo: list(raw.todo, climbSnap, 500),
    ticks: (Array.isArray(raw.ticks) ? raw.ticks : [])
      .map(t => {
        const c = climbSnap(t);
        if (!c || typeof t.id !== "string" || !isDay(t.date)) return null;
        return { ...c, id: t.id.slice(0, 40), date: t.date, style: STYLE_IDS.has(t.style) ? t.style : "redpoint", notes: str(t.notes, 500) };
      })
      .filter(Boolean)
      .slice(0, 5000),
    trips: (Array.isArray(raw.trips) ? raw.trips : [])
      .map(t => {
        if (!isObj(t) || typeof t.id !== "string" || !isDay(t.day)) return null;
        const area = areaSnap(t.area);
        if (!area) return null;
        return {
          id: t.id.slice(0, 40),
          title: str(t.title) || `Climb at ${area.name}`,
          day: t.day,
          time: typeof t.time === "string" && /^\d{2}:\d{2}$/.test(t.time) ? t.time : null,
          area,
          routes: (Array.isArray(t.routes) ? t.routes : []).map(climbSnap).filter(Boolean).slice(0, 40),
          notes: str(t.notes, 1000),
          createdAt: str(t.createdAt, 40),
        };
      })
      .filter(Boolean)
      .slice(0, 300),
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

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const toggleIn = (list, item, max = 500) => (list.some(x => x.uuid === item.uuid) ? list.filter(x => x.uuid !== item.uuid) : [item, ...list].slice(0, max));

/** Remember an area you opened, newest first. */
export const pushRecent = (recent, area) => {
  const a = areaSnap(area);
  return a ? [a, ...recent.filter(r => r.uuid !== a.uuid)].slice(0, 12) : recent;
};

/** Sends per route: { uuid -> { sent, tries, best } }. */
export function tickSummary(ticks) {
  const out = {};
  for (const t of ticks) {
    const s = out[t.uuid] ?? { sent: false, tries: 0, last: null };
    s.tries += 1;
    if (isSend(t.style)) s.sent = true;
    if (!s.last || t.date > s.last) s.last = t.date;
    out[t.uuid] = s;
  }
  return out;
}

/** The upcoming plan at an area, if there is one (soonest first). */
export function upcomingTripAt(trips, areaUuid, today) {
  return trips.filter(t => t.area.uuid === areaUuid && t.day >= today).sort((a, b) => a.day.localeCompare(b.day))[0] ?? null;
}

/** A new climbing day at an area. */
export function newTrip(area, day, routes = []) {
  const a = areaSnap(area);
  return {
    id: newId(),
    title: `Climb at ${a.name}`,
    day,
    time: "08:00",
    area: a,
    routes: routes.map(climbSnap).filter(Boolean),
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

/** Add a route to the upcoming plan at its area, or start one. Returns { trips, trip }. */
export function addRouteToTrip(trips, route, area, today, defaultDay) {
  const existing = upcomingTripAt(trips, area.uuid, today);
  const r = climbSnap(route);
  if (existing) {
    const trip = existing.routes.some(x => x.uuid === r.uuid) ? existing : { ...existing, routes: [...existing.routes, r] };
    return { trips: trips.map(t => (t.id === trip.id ? trip : t)), trip };
  }
  const trip = newTrip(area, defaultDay, [r]);
  return { trips: [...trips, trip], trip };
}
