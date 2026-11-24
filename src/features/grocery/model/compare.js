// Pricing the grocery list at the shopper's stores, with their coupons.
// The comparison itself is CookFox's (model/stores.js in cook), so both apps
// count the same way; GroceryFox adds coupons and the preferred store.
import { chainFor, compareStores } from "../../cook/model/stores.js";
import { amountText, itemKey } from "./list.js";

const cents = n => Math.round(n * 100) / 100;

// The unchecked list in the shape the comparison prices: { key, term, label, count, unit }.
export function itemsToPrice(list) {
  return list
    .filter(i => !i.checked && i.name)
    .map(i => ({ key: itemKey(i.name), term: i.name, label: [amountText(i), i.name].filter(Boolean).join(" "), count: i.qty, unit: i.unit }));
}

const words = s => String(s ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
const stem = w => w.replace(/(es|s)$/, "");

// Does a coupon for "Tide pods" apply to the list item "tide pods 42 ct"? Every
// word of the coupon has to be in the item (plurals don't matter).
export function couponFitsItem(coupon, item) {
  const want = words(coupon.item).map(stem);
  if (!want.length) return false;
  const have = new Set(words(item.term ?? item.name).map(stem));
  return want.every(w => have.has(w));
}

// "any" store, a whole chain ("chain:kroger") or one store by id.
export function couponFitsStore(coupon, store) {
  if (!coupon.store || coupon.store === "any") return true;
  if (coupon.store.startsWith("chain:")) return chainFor(store)?.key === coupon.store.slice(6);
  return coupon.store === store.id;
}

export const couponLive = (coupon, today) => !coupon.used && (!coupon.expires || coupon.expires >= today);

// What a coupon takes off one line of the list (count packages at price each).
export function couponSaves(coupon, price, count) {
  if (count < (coupon.minQty || 1)) return 0;
  const line = price * count;
  const off = coupon.kind === "percent" ? (line * coupon.value) / 100 : coupon.value;
  return cents(Math.min(line, Math.max(0, off)));
}

// The comparison's price adjuster: the best live coupon comes off each item.
export function couponAdjuster(coupons, today) {
  const live = coupons.filter(c => couponLive(c, today));
  if (!live.length) return null;
  return (found, item, store) => {
    let best = null;
    for (const c of live) {
      if (!couponFitsStore(c, store) || !couponFitsItem(c, item)) continue;
      const saves = couponSaves(c, found.price, item.count);
      if (saves > 0 && (!best || saves > best.saves)) best = { coupon: c, saves };
    }
    if (!best) return found;
    return { ...found, price: cents(Math.max(0, found.price - best.saves / item.count)), before: found.price, coupon: best.coupon, couponSaves: best.saves };
  };
}

export function compareList(list, stores, prices, coupons, today) {
  return compareStores(itemsToPrice(list), stores, prices, couponAdjuster(coupons, today));
}

// How the preferred store stacks up: for each other store, what the items
// priced at both cost there instead. Returns the best alternative, or null
// when the preferred store is already cheapest (or there's nothing to compare).
export function versusPreferred(result, stores, preferredId) {
  const pi = stores.findIndex(s => s.id === preferredId);
  if (pi < 0 || stores.length < 2) return null;
  let best = null;
  stores.forEach((s, si) => {
    if (si === pi) return;
    let here = 0;
    let there = 0;
    let n = 0;
    for (const r of result.rows) {
      if (!r.cells[pi] || !r.cells[si]) continue;
      here += r.cells[pi].cost;
      there += r.cells[si].cost;
      n++;
    }
    const savings = cents(here - there);
    if (n && savings > 0 && (!best || savings > best.savings)) best = { storeId: s.id, savings, items: n, preferredTotal: cents(here), otherTotal: cents(there) };
  });
  return best;
}

// The total coupons take off at one store.
export function couponTotal(result, storeIndex) {
  return cents(result.rows.reduce((sum, r) => sum + (r.cells[storeIndex]?.couponSaves ?? 0), 0));
}

// The store the list is estimated at: the preferred one, else the cheapest.
export function estimateStore(data, result) {
  const at = id => data.stores.findIndex(s => s.id === id);
  const i = data.preferred ? at(data.preferred) : result.best ? at(result.best.storeId) : data.stores.length ? 0 : -1;
  if (i < 0) return null;
  const t = result.totals[i];
  return t?.priced ? { store: data.stores[i], index: i, total: t.total, priced: t.priced, missing: t.missing } : null;
}
