// Everything GroceryFox remembers: the list, your stores (and which one you
// prefer), prices you typed, coupons you clipped, trips and the budget. It
// lives in this browser and, when you're signed in, in your account.
import { SECTION_IDS } from "../data/sections.js";
import { MAX_ITEMS, UNITS } from "../model/list.js";

export const STORAGE_KEY = "groceryfox-data-v1";
export const MAX_STORES = 4;
export const RADII = [3, 5, 10, 15, 25];
export const MAX_COUPONS = 200;
export const MAX_TRIPS = 500;

export function emptyData() {
  return {
    version: 1,
    updatedAt: null,
    list: [],
    place: null,
    radius: 10,
    stores: [],
    preferred: null,
    typed: {},
    chosen: {},
    coupons: [],
    trips: [],
    budget: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const money = (v, max = 100000) => (Number.isFinite(v) && v >= 0 && v < max ? Math.round(v * 100) / 100 : null);

function cleanItem(i) {
  if (!isObject(i) || !i.id || !str(i.name, 80).trim()) return null;
  return {
    id: String(i.id).slice(0, 40),
    name: str(i.name, 80).trim(),
    qty: Number.isFinite(i.qty) && i.qty > 0 ? Math.min(99, i.qty) : 1,
    unit: UNITS.includes(i.unit) ? i.unit : "each",
    note: str(i.note, 140),
    section: SECTION_IDS.includes(i.section) ? i.section : "other",
    checked: i.checked === true,
    from: i.from === "cookfox" ? "cookfox" : null,
    cookKey: typeof i.cookKey === "string" ? i.cookKey.slice(0, 80) : null,
    added: str(i.added, 40) || null,
  };
}

export const cleanStore = s =>
  isObject(s) && typeof s.id === "string" && typeof s.name === "string"
    ? {
        id: s.id.slice(0, 80),
        name: s.name.slice(0, 80),
        brand: typeof s.brand === "string" ? s.brand.slice(0, 60) : null,
        chain: typeof s.chain === "string" ? s.chain.slice(0, 30) : null,
        address: typeof s.address === "string" ? s.address.slice(0, 160) : "",
        website: typeof s.website === "string" && /^https?:\/\//.test(s.website) ? s.website.slice(0, 300) : null,
        distance: Number.isFinite(s.distance) ? s.distance : null,
        krogerId: typeof s.krogerId === "string" ? s.krogerId.slice(0, 12) : null,
      }
    : null;

const cleanNested = (m, ok) =>
  Object.fromEntries(
    Object.entries(isObject(m) ? m : {})
      .filter(([, v]) => isObject(v))
      .slice(0, 60)
      .map(([k, v]) => [k.slice(0, 80), Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x)).slice(0, 400))])
  );

function cleanCoupon(c) {
  if (!isObject(c) || !c.id || !str(c.item, 60).trim()) return null;
  const kind = c.kind === "percent" ? "percent" : "off";
  const value = Number(c.value);
  if (!Number.isFinite(value) || value <= 0 || (kind === "percent" && value > 100) || value > 500) return null;
  return {
    id: String(c.id).slice(0, 40),
    item: str(c.item, 60).trim(),
    store: str(c.store, 90) || "any",
    storeName: str(c.storeName, 80),
    kind,
    value: Math.round(value * 100) / 100,
    minQty: Number.isInteger(c.minQty) && c.minQty > 1 ? Math.min(20, c.minQty) : 1,
    expires: isDay(c.expires) ? c.expires : null,
    note: str(c.note, 120),
    used: c.used === true,
  };
}

function cleanTrip(t) {
  if (!isObject(t) || !t.id || !isDay(t.date)) return null;
  const total = money(t.total);
  if (total === null) return null;
  return {
    id: String(t.id).slice(0, 40),
    date: t.date,
    storeId: str(t.storeId, 80) || null,
    storeName: str(t.storeName, 80) || "Store",
    total,
    items: Number.isInteger(t.items) && t.items >= 0 ? Math.min(999, t.items) : 0,
    saved: money(t.saved) ?? 0,
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const p = raw.place;
  const stores = (Array.isArray(raw.stores) ? raw.stores : []).map(cleanStore).filter(Boolean).slice(0, MAX_STORES);
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    list: (Array.isArray(raw.list) ? raw.list : []).map(cleanItem).filter(Boolean).slice(0, MAX_ITEMS),
    place: isObject(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { name: str(p.name, 80), lat: p.lat, lon: p.lon } : null,
    radius: RADII.includes(raw.radius) ? raw.radius : base.radius,
    stores,
    preferred: stores.some(s => s.id === raw.preferred) ? raw.preferred : null,
    typed: cleanNested(raw.typed, x => Number.isFinite(x) && x >= 0 && x < 10000),
    chosen: cleanNested(raw.chosen, x => typeof x === "string"),
    coupons: (Array.isArray(raw.coupons) ? raw.coupons : []).map(cleanCoupon).filter(Boolean).slice(0, MAX_COUPONS),
    trips: (Array.isArray(raw.trips) ? raw.trips : []).map(cleanTrip).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_TRIPS),
    budget: money(raw.budget) || null,
  };
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
    // Private windows can refuse storage; the list still works for this visit.
  }
}
