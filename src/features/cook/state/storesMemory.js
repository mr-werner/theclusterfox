// What the store comparer remembers, on this device only: where you shop,
// the stores you compare, prices you typed and which product you picked.
// Kept apart from the main CookFox data so it never gets in its way.
import { useCallback, useState } from "react";
import { MAX_COMPARE } from "../model/stores.js";

export const STORES_KEY = "cookfox-stores-v1";

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const RADII = [3, 5, 10, 15, 25];

export function emptyStores() {
  return { place: null, radius: 10, picked: [], typed: {}, chosen: {} };
}

const cleanStore = s =>
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

// Keeps only well-formed numbers in { storeId: { itemKey: value } } maps.
const cleanNested = (m, ok) =>
  Object.fromEntries(
    Object.entries(isObject(m) ? m : {})
      .filter(([, v]) => isObject(v))
      .slice(0, 60)
      .map(([k, v]) => [k.slice(0, 80), Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x)).slice(0, 300))])
  );

export function normalizeStores(raw) {
  const base = emptyStores();
  if (!isObject(raw)) return base;
  const p = raw.place;
  return {
    place: isObject(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { name: String(p.name ?? "").slice(0, 80), lat: p.lat, lon: p.lon } : null,
    radius: RADII.includes(raw.radius) ? raw.radius : base.radius,
    picked: (Array.isArray(raw.picked) ? raw.picked : []).map(cleanStore).filter(Boolean).slice(0, MAX_COMPARE),
    typed: cleanNested(raw.typed, x => Number.isFinite(x) && x >= 0 && x < 10000),
    chosen: cleanNested(raw.chosen, x => typeof x === "string"),
  };
}

function load() {
  try {
    return normalizeStores(JSON.parse(localStorage.getItem(STORES_KEY) ?? "null"));
  } catch {
    return emptyStores();
  }
}

export { RADII };

export function useStoresMemory() {
  const [memory, setMemory] = useState(load);
  const update = useCallback(fn => {
    setMemory(m => {
      const next = normalizeStores({ ...m, ...fn(m) });
      try {
        localStorage.setItem(STORES_KEY, JSON.stringify(next));
      } catch {
        // Private windows can refuse storage; the comparison still works for this visit.
      }
      return next;
    });
  }, []);
  return [memory, update];
}
