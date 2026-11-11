// Comparing what the shopping list costs at nearby stores, and handing the
// list to a store or Instacart to order. Pure functions; the panel in
// components/StoresPanel.jsx does the fetching and remembering.
//
// A price is always for one store package (one can, one carton), since
// that's what both shelf tags and the Kroger API price. An item's cost at a
// store is that price times how many packages the list says to buy.
import { chains } from "../data/chains.js";
import { ingredientsById } from "../data/ingredients.js";
import { buyFor } from "./buying.js";
import { shoppingAmount } from "./pantry.js";

export const MAX_COMPARE = 4;

const cents = n => Math.round(n * 100) / 100;

// The chain a store belongs to, if CookFox knows it.
export function chainFor(store) {
  if (!store) return null;
  if (store.chain) {
    const byCode = chains.find(c => c.codes?.includes(store.chain));
    if (byCode) return byCode;
  }
  const label = `${store.brand ?? ""} ${store.name ?? ""}`;
  return chains.find(c => c.match.test(label)) ?? null;
}

// A link to look an item up at a store: its own product search when known,
// else its website, else a web search for the store and item.
export function lookupUrl(store, term) {
  const chain = chainFor(store);
  if (chain?.search) return chain.search(term);
  if (store.website) return store.website;
  return `https://duckduckgo.com/?q=${encodeURIComponent(`${store.name} ${term} price`)}`;
}

export function storeWebsite(store) {
  return store.website ?? chainFor(store)?.site ?? null;
}

const UNIT_WORDS = ["can", "bag", "box", "bottle", "jar", "bunch", "head"];
const unitFromLabel = label => UNIT_WORDS.find(w => new RegExp(`\\b${w}\\b`, "i").test(label)) ?? "package";

// The unchecked list as things to price: { key, term, label, count, unit }.
// `key` stays the same for an item from visit to visit, so typed prices stick.
export function itemsToPrice(list) {
  const out = [];
  for (const i of list) {
    if (i.checked) continue;
    if (!i.ing) {
      if (i.name) out.push({ key: `n:${i.name.toLowerCase()}`, term: i.name, label: i.name, count: 1, unit: "each" });
      continue;
    }
    const item = ingredientsById.get(i.ing);
    if (!item) continue;
    const amount = shoppingAmount(i);
    const buy = amount > 0 ? buyFor(item, amount) : null;
    const base = { key: `i:${item.id}`, term: item.name };
    if (buy?.packs.length === 1) {
      const p = buy.packs[0];
      out.push({ ...base, label: `${item.name}, ${p.label}`, count: p.count, unit: unitFromLabel(p.label) });
    } else if (buy?.packs.length > 1) {
      // Mixed sizes ("1-lb box + 1 stick"): one price per package bought.
      const count = buy.packs.reduce((n, p) => n + p.count, 0);
      out.push({ ...base, label: `${item.name}, ${buy.text}`, count, unit: "package" });
    } else if (buy?.named) {
      out.push({ ...base, label: item.name, count: buy.total, unit: "each" });
    } else {
      // Sold by weight at the counter, or added by hand: one priced pack.
      out.push({ ...base, label: item.name, count: 1, unit: "package" });
    }
  }
  return out;
}

// The price CookFox uses for an item at a store: what the shopper typed
// wins over a live price, and a live price is the product they chose (or
// the best match).
export function unitPrice(item, store, { typed = {}, live = {}, chosen = {} } = {}) {
  const own = typed[store.id]?.[item.key];
  if (Number.isFinite(own) && own >= 0) return { price: own, source: "typed" };
  const products = live[store.id]?.[item.term];
  if (products?.length) {
    const pick = products.find(p => p.id === chosen[store.id]?.[item.key]) ?? products[0];
    return { price: pick.price, source: "live", product: pick, sale: pick.sale };
  }
  return null;
}

// Totals per store and the cheapest way to buy everything.
//   rows[i].cells[s] -> { price, cost, source } | null, plus the cheapest store id
//   totals[s]        -> { storeId, total, priced, missing }
//   common           -> how many items have a price at every store (the fair comparison)
//   best             -> cheapest store on those common items, and how much it saves
//   split            -> cheapest store for each item, and what that saves over `best`
export function compareStores(items, stores, prices) {
  const rows = items.map(item => {
    const cells = stores.map(s => {
      const p = unitPrice(item, s, prices);
      return p ? { ...p, cost: cents(p.price * item.count) } : null;
    });
    const costs = cells.map(c => c?.cost ?? Infinity);
    const low = Math.min(...costs);
    return { item, cells, cheapest: Number.isFinite(low) ? stores[costs.indexOf(low)].id : null };
  });

  const totals = stores.map((s, si) => {
    const priced = rows.filter(r => r.cells[si]);
    return { storeId: s.id, total: cents(priced.reduce((sum, r) => sum + r.cells[si].cost, 0)), priced: priced.length, missing: items.length - priced.length };
  });

  const common = rows.filter(r => r.cells.every(Boolean));
  let best = null;
  if (stores.length > 1 && common.length) {
    const sums = stores.map((s, si) => cents(common.reduce((sum, r) => sum + r.cells[si].cost, 0)));
    const low = Math.min(...sums);
    best = { storeId: stores[sums.indexOf(low)].id, total: low, savings: cents(Math.max(...sums) - low), sums };
  }

  let split = null;
  const pricedRows = rows.filter(r => r.cheapest);
  if (stores.length > 1 && pricedRows.length) {
    const stops = new Map();
    let total = 0;
    for (const r of pricedRows) {
      total += r.cells[stores.findIndex(s => s.id === r.cheapest)].cost;
      stops.set(r.cheapest, (stops.get(r.cheapest) ?? 0) + 1);
    }
    const commonSplit = cents(common.reduce((sum, r) => sum + Math.min(...r.cells.map(c => c.cost)), 0));
    split = { total: cents(total), stops: [...stops].map(([storeId, count]) => ({ storeId, count })), savings: best ? cents(best.total - commonSplit) : null };
  }

  return { rows, totals, common: common.length, best, split };
}

// The list in the shape /api/cook/order sends to Instacart.
export function orderItems(items) {
  return items.map(i => ({ name: i.term, quantity: i.count, unit: i.unit, display: i.label }));
}

export const money = n => (Number.isFinite(n) ? `$${n.toFixed(2)}` : "");

// "12.5", "$3" or " 2.49 " -> a number; "" -> null (clear it); anything else -> undefined.
export function parsePrice(text) {
  const t = String(text ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 10000 ? cents(n) : undefined;
}

export const milesText = d => (d < 0.1 ? "nearby" : `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`);
