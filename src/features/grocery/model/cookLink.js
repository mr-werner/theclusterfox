// GroceryFox and CookFox share a kitchen. CookFox's recipe shopping list
// (saved in this browser as cookfox-data-v1) can come over to GroceryFox,
// where it gets prices, coupons and a budget; the stores CookFox already
// compares seed GroceryFox's on first use.
import { ingredientsById } from "../../cook/data/ingredients.js";
import { itemsToPrice } from "../../cook/model/stores.js";
import { FROM_COOK_AISLE, guessSection } from "../data/sections.js";
import { itemKey, newId, MAX_ITEMS } from "./list.js";

export const COOK_KEY = "cookfox-data-v1";
export const COOK_STORES_KEY = "cookfox-stores-v1";

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const UNIT = { can: "can", bag: "bag", box: "box", bottle: "bottle", jar: "jar", bunch: "bunch" };

// CookFox's unchecked shopping list as GroceryFox entries.
export function cookItems(raw) {
  const shopping = isObject(raw) && Array.isArray(raw.shopping) ? raw.shopping : [];
  const list = shopping
    .filter(i => isObject(i) && !i.checked && (ingredientsById.has(i.ing) || (typeof i.name === "string" && i.name.trim())))
    .map(i => ({
      ing: ingredientsById.has(i.ing) ? i.ing : null,
      name: ingredientsById.has(i.ing) ? null : String(i.name).slice(0, 60),
      sources: Array.isArray(i.sources) ? i.sources.filter(s => isObject(s) && Number.isFinite(s.amount) && s.amount > 0) : [],
      extra: Number.isFinite(i.extra) ? i.extra : 0,
      checked: false,
    }));
  return itemsToPrice(list).map(p => {
    const ing = p.key.startsWith("i:") ? ingredientsById.get(p.key.slice(2)) : null;
    const detail = p.label.startsWith(`${p.term}, `) ? p.label.slice(p.term.length + 2) : "";
    return {
      cookKey: p.key,
      name: p.term,
      qty: Math.min(99, Math.max(1, Math.round(p.count * 100) / 100)),
      unit: UNIT[p.unit] ?? "each",
      note: detail,
      section: ing ? FROM_COOK_AISLE[ing.aisle] ?? guessSection(p.term) : guessSection(p.term),
    };
  });
}

// The CookFox items not already on the GroceryFox list.
export function newCookItems(raw, list) {
  const have = new Set(list.filter(i => !i.checked).flatMap(i => [i.cookKey, itemKey(i.name)].filter(Boolean)));
  return cookItems(raw).filter(c => !have.has(c.cookKey) && !have.has(itemKey(c.name)));
}

export function addCookItems(list, items) {
  const now = new Date().toISOString();
  const added = items.map(c => ({ id: newId(), ...c, checked: false, from: "cookfox", added: now }));
  return [...added, ...list].slice(0, MAX_ITEMS);
}

export function readCook(key = COOK_KEY) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
