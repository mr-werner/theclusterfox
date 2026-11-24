// The grocery list: adding, checking off and sorting items. Pure functions
// over the saved list (see state/groceryStore.js for its shape).
import { guessSection, SECTIONS } from "../data/sections.js";

export const MAX_ITEMS = 300;
export const UNITS = ["each", "lb", "oz", "gal", "dozen", "pack", "can", "bag", "box", "bottle", "jar", "bunch"];

const UNIT_WORDS = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  gal: "gal", gallon: "gal", gallons: "gal",
  dozen: "dozen", doz: "dozen",
  pack: "pack", packs: "pack", pk: "pack",
  can: "can", cans: "can",
  bag: "bag", bags: "bag",
  box: "box", boxes: "box",
  bottle: "bottle", bottles: "bottle",
  jar: "jar", jars: "jar",
  bunch: "bunch", bunches: "bunch",
};

let counter = 0;
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const tidy = s => String(s ?? "").replace(/\s+/g, " ").trim();

// "2 lb chicken breast" -> { qty: 2, unit: "lb", name: "chicken breast" }
// "eggs x 2", "3 apples", "milk" all work too.
export function parseEntry(text) {
  let t = tidy(text).slice(0, 80);
  let qty = 1;
  let unit = "each";
  const tail = t.match(/^(.*?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i);
  if (tail) {
    t = tail[1];
    qty = Number(tail[2]);
  } else {
    const lead = t.match(/^(\d+(?:\.\d+)?|½|¼)\s+(.*)$/);
    if (lead) {
      qty = lead[1] === "½" ? 0.5 : lead[1] === "¼" ? 0.25 : Number(lead[1]);
      t = lead[2];
    }
  }
  const u = t.match(/^([a-z]+)\.?\s+(?:of\s+)?(.+)$/i);
  if (u && UNIT_WORDS[u[1].toLowerCase()]) {
    unit = UNIT_WORDS[u[1].toLowerCase()];
    t = u[2];
  }
  if (!Number.isFinite(qty) || qty <= 0) qty = 1;
  return { qty: Math.min(99, Math.round(qty * 100) / 100), unit, name: tidy(t) };
}

export const itemKey = name => `n:${tidy(name).toLowerCase()}`;

// Adds an entry, or bumps the amount when the same unchecked item is already on the list.
export function addItem(list, text, extra = {}) {
  const parsed = parseEntry(text);
  if (!parsed.name) return list;
  const key = itemKey(parsed.name);
  const same = list.find(i => !i.checked && itemKey(i.name) === key && i.unit === parsed.unit);
  if (same) return list.map(i => (i === same ? { ...i, qty: Math.min(99, i.qty + parsed.qty) } : i));
  const item = { id: newId(), name: parsed.name, qty: parsed.qty, unit: parsed.unit, note: "", section: guessSection(parsed.name), checked: false, from: null, cookKey: null, added: new Date().toISOString(), ...extra };
  return [item, ...list].slice(0, MAX_ITEMS);
}

export const updateItem = (list, id, patch) => list.map(i => (i.id === id ? { ...i, ...patch } : i));
export const removeItem = (list, id) => list.filter(i => i.id !== id);
export const toggleItem = (list, id) => list.map(i => (i.id === id ? { ...i, checked: !i.checked } : i));
export const clearChecked = list => list.filter(i => !i.checked);

// [[sectionId, items], ...] in store order; checked items sink to the bottom of each.
export function bySection(list) {
  const groups = new Map(SECTIONS.map(s => [s.id, []]));
  for (const i of list) (groups.get(i.section) ?? groups.get("other")).push(i);
  return [...groups]
    .filter(([, items]) => items.length)
    .map(([id, items]) => [id, [...items].sort((a, b) => Number(a.checked) - Number(b.checked))]);
}

const qtyText = n => (Number.isInteger(n) ? String(n) : String(n).replace(/^0\./, "."));
export function amountText(item) {
  if (item.unit === "each") return item.qty === 1 ? "" : `${qtyText(item.qty)}`;
  return `${qtyText(item.qty)} ${item.unit}`;
}

// The list as text, to paste into a message.
export function listText(list) {
  return bySection(list.filter(i => !i.checked))
    .map(([, items]) => items.map(i => `- ${[amountText(i), i.name].filter(Boolean).join(" ")}${i.note ? ` (${i.note})` : ""}`).join("\n"))
    .join("\n");
}
