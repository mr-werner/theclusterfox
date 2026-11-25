// TripFox's saved data, in this browser (and the account when signed in):
// where home is, your home airport, and each trip you're planning.
// Plain functions so tests and TaskFox can use them.

export const STORAGE_KEY = "tripfox-data-v1";
const MAX_TRIPS = 20;
const MAX_PLAN = 120;

export const TRAVEL = [
  { id: "drive", name: "Drive" },
  { id: "fly", name: "Fly" },
  { id: "train", name: "Train" },
  { id: "bus", name: "Bus" },
];

// Where you sleep. nightly is a starting guess for the price a night.
export const STAY_KINDS = [
  { id: "hotel", name: "Hotel", nightly: 160 },
  { id: "motel", name: "Motel", nightly: 90 },
  { id: "rental", name: "Vacation rental", nightly: 210 },
  { id: "hostel", name: "Hostel or guest house", nightly: 55 },
  { id: "camp", name: "Campground", nightly: 35 },
  { id: "free", name: "Free camping or friends", nightly: 0 },
];

export const VEHICLES = [
  { id: "sedan", name: "Sedan", mpg: 32 },
  { id: "suv", name: "SUV / crossover", mpg: 25 },
  { id: "minivan", name: "Minivan", mpg: 22 },
  { id: "truck", name: "Pickup", mpg: 19 },
  { id: "hybrid", name: "Hybrid", mpg: 50 },
  { id: "rv", name: "RV / towing", mpg: 9 },
  { id: "ev", name: "Electric", mpg: null },
];

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
const money = v => (Number.isFinite(v) && v >= 0 ? Math.min(1e6, Math.round(v * 100) / 100) : null);
export const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const isTime = v => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isLink = v => typeof v === "string" && /^https:\/\/[^\s]{3,500}$/.test(v);

export function cleanPlace(p) {
  if (!isObj(p)) return null;
  const lat = p.lat ?? p.latitude;
  const lon = p.lon ?? p.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { id: str(p.id, 40) || `${lat.toFixed(3)},${lon.toFixed(3)}`, name: str(p.name) || "Somewhere", region: str(p.region), lat, lon };
}

export function cleanAirport(a) {
  if (!isObj(a) || !/^[A-Z]{3}$/.test(a.code ?? "")) return null;
  return { code: a.code, name: str(a.name) || a.code };
}

/** One thing on the plan: day null means "an idea, not on a day yet". */
function cleanPlanItem(i) {
  if (!isObj(i) || !str(i.id, 60) || !str(i.title, 120)) return null;
  const at = cleanPlace({ lat: i.lat, lon: i.lon, name: i.title });
  return {
    id: str(i.id, 60),
    day: isDay(i.day) ? i.day : null,
    time: isTime(i.time) ? i.time : null,
    title: str(i.title, 120),
    kind: str(i.kind, 20) || "custom",
    indoor: i.indoor === true,
    cost: money(i.cost),
    perPerson: i.perPerson === true,
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
    url: isLink(i.url) ? i.url : null,
  };
}

function cleanStay(s) {
  const p = cleanPlace(s);
  if (!p) return null;
  return { ...p, kind: str(s.kind, 20), url: isLink(s.url) ? s.url : null };
}

export function newTrip(fields = {}) {
  return cleanTrip({ id: crypto.randomUUID(), adults: 2, kids: 0, rooms: 1, travel: "drive", vehicle: "suv", stayKind: "hotel", nightly: 160, food: 45, fun: 30, ...fields });
}

export function cleanTrip(t) {
  if (!isObj(t) || !str(t.id, 60)) return null;
  const start = isDay(t.start) ? t.start : null;
  const end = start && isDay(t.end) && t.end >= start ? t.end : null;
  const stayKind = STAY_KINDS.some(k => k.id === t.stayKind) ? t.stayKind : "hotel";
  return {
    id: str(t.id, 60),
    name: str(t.name, 80),
    dest: cleanPlace(t.dest),
    start,
    end,
    adults: int(t.adults, 2, 1, 12),
    kids: int(t.kids, 0, 0, 12),
    rooms: int(t.rooms, 1, 1, 6),
    travel: TRAVEL.some(m => m.id === t.travel) ? t.travel : "drive",
    vehicle: VEHICLES.some(v => v.id === t.vehicle) ? t.vehicle : "suv",
    airport: cleanAirport(t.airport),
    stayKind,
    nightly: money(t.nightly) ?? STAY_KINDS.find(k => k.id === stayKind).nightly,
    budget: money(t.budget) || null,
    food: money(t.food) ?? 45,
    fun: money(t.fun) ?? 30,
    travelCost: money(t.travelCost),
    stay: cleanStay(t.stay),
    plan: (Array.isArray(t.plan) ? t.plan : []).map(cleanPlanItem).filter(Boolean).slice(0, MAX_PLAN),
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
  };
}

export function emptyData() {
  return { version: 1, home: null, homeAirport: null, units: "us", trips: [], currentId: null, updatedAt: null };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const trips = (Array.isArray(raw.trips) ? raw.trips : []).map(cleanTrip).filter(Boolean).slice(0, MAX_TRIPS);
  return {
    version: 1,
    home: cleanPlace(raw.home),
    homeAirport: cleanAirport(raw.homeAirport),
    units: raw.units === "metric" ? "metric" : "us",
    trips,
    currentId: trips.some(t => t.id === raw.currentId) ? raw.currentId : (trips[0]?.id ?? null),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

/** The trip's name: what you called it, or where it goes. */
export const tripTitle = t => t.name || (t.dest ? `Trip to ${t.dest.name}` : t.airport ? `Trip to ${t.airport.name}` : "New trip");

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
    // Private windows can refuse storage; the trip still works for this visit.
  }
}

/**
 * On first use, start from what TaskFox already knows: your town and the
 * airport you fly from. Reads TaskFox's saved data; never writes it.
 */
export function fromTaskFox(raw) {
  if (!isObj(raw)) return {};
  return { home: cleanPlace(raw.place), homeAirport: cleanAirport(raw.flights?.from) };
}

/** A watched TaskFox destination by airport code: { code, name } or null. */
export function taskFoxDestination(raw, code) {
  const list = isObj(raw) && isObj(raw.flights) && Array.isArray(raw.flights.to) ? raw.flights.to : [];
  return cleanAirport(list.find(t => t?.code === code)) ?? cleanAirport({ code });
}
