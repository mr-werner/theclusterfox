// SnowFox's saved data, in this browser: favorite mountains, home (for drive
// times), units and planned ski days. Plain functions so tests and PlanFox
// can use them.

export const STORAGE_KEY = "snowfox-data-v1";

export function emptyData() {
  return {
    version: 1,
    favorites: ["vail", "alta", "jackson-hole"], // resort or backcountry ids
    region: "co",
    home: null, // { name, lat, lon }
    units: "us",
    custom: [], // searched places: [{ id, name, state, lat, lon, base, summit }]
    trips: [], // [{ id, spot, name, day, time, note }]
    updatedAt: null,
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanPlace(p) {
  if (!isObj(p) || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  return { name: str(p.name, 80) || "Home", lat: p.lat, lon: p.lon };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  return {
    ...base,
    favorites: Array.isArray(raw.favorites) ? [...new Set(raw.favorites.filter(v => typeof v === "string").map(v => v.slice(0, 60)))].slice(0, 40) : base.favorites,
    region: typeof raw.region === "string" ? raw.region.slice(0, 12) : base.region,
    home: cleanPlace(raw.home),
    units: raw.units === "metric" ? "metric" : "us",
    custom: (Array.isArray(raw.custom) ? raw.custom : [])
      .filter(c => isObj(c) && typeof c.id === "string" && Number.isFinite(c.lat) && Number.isFinite(c.lon))
      .map(c => ({ id: c.id.slice(0, 60), name: str(c.name, 80), state: str(c.state, 40), lat: c.lat, lon: c.lon, base: Number.isFinite(c.base) ? c.base : 6000, summit: Number.isFinite(c.summit) ? c.summit : 8000, custom: true }))
      .slice(0, 20),
    trips: (Array.isArray(raw.trips) ? raw.trips : [])
      .filter(t => isObj(t) && typeof t.id === "string" && typeof t.spot === "string" && DAY.test(t.day ?? ""))
      .map(t => ({ id: t.id.slice(0, 40), spot: t.spot.slice(0, 60), name: str(t.name, 80), day: t.day, time: /^\d{2}:\d{2}$/.test(t.time ?? "") ? t.time : null, note: str(t.note, 300) }))
      .slice(0, 100),
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
