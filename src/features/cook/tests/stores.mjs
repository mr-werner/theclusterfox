// Store finder, price comparison and ordering: run with `node src/features/cook/tests/stores.mjs`.
import assert from "node:assert/strict";
import { parseOsm, mergeStores, overpassQuery } from "../../../../api/cook/_osm.js";
import { parseLocations, parseProducts } from "../../../../api/cook/_kroger.js";
import { instacartBody } from "../../../../api/cook/_order.js";
import { miles, webUrl } from "../../../../api/cook/_geo.js";
import { chains, chainsByKey } from "../data/chains.js";
import { chainFor, compareStores, itemsToPrice, lookupUrl, orderItems, parsePrice, storeWebsite, unitPrice } from "../model/stores.js";
import { normalizeStores, emptyStores } from "../state/storesMemory.js";
import * as P from "../model/pantry.js";
import { recipes } from "../data/recipes.js";

const here = { lat: 39.1031, lon: -84.512 };

// --- Geography helpers -------------------------------------------------------
{
  assert(Math.abs(miles(here, { lat: 39.1031 + 1 / 69, lon: -84.512 }) - 1) < 0.01, "one degree of latitude is about 69 miles");
  assert.equal(webUrl("kroger.com"), "https://kroger.com/");
  assert.equal(webUrl("javascript:alert(1)"), null);
  assert.equal(webUrl(""), null);
  const q = overpassQuery(here.lat, here.lon, 8046.7);
  assert(q.includes("around:8047,39.10310,-84.51200") && q.includes("supermarket"), "Overpass query");
}

// --- OpenStreetMap stores --------------------------------------------------
const osmBody = {
  elements: [
    { type: "node", id: 1, lat: 39.11, lon: -84.51, tags: { shop: "supermarket", name: "Kroger", brand: "Kroger", "addr:housenumber": "100", "addr:street": "Main St", "addr:city": "Cincinnati", "addr:state": "OH", "addr:postcode": "45202" } },
    { type: "way", id: 2, center: { lat: 39.12, lon: -84.52 }, tags: { shop: "supermarket", name: "ALDI", brand: "Aldi", website: "https://www.aldi.us/store/1" } },
    { type: "node", id: 3, lat: 39.12, lon: -84.52, tags: { shop: "supermarket", name: "ALDI", brand: "Aldi" } }, // same store mapped twice
    { type: "node", id: 4, lat: 39.13, lon: -84.5, tags: { shop: "grocery", name: "Findlay Market Grocer", website: "javascript:bad" } },
    { type: "node", id: 5, lat: 39.13, lon: -84.5, tags: { shop: "grocery" } }, // no name
    { type: "node", id: 6, tags: { shop: "grocery", name: "No place" } },
  ],
};
const osm = parseOsm(osmBody, here);
{
  assert.equal(osm.length, 4, "unnamed and unplaced stores are skipped");
  assert.equal(osm[0].address, "100 Main St, Cincinnati, OH 45202");
  assert.equal(osm[1].id, "osm:way/2");
  assert.equal(osm[1].lat, 39.12, "ways use their center");
  assert.equal(osm[3].website, null, "only web links");
  assert(osm.every(s => s.distance >= 0));
}

// --- Kroger locations and products ------------------------------------------
{
  const locations = parseLocations({
    data: [
      { locationId: "01400943", chain: "KROGER", name: "Kroger", address: { addressLine1: "100 Main St", city: "Cincinnati", state: "OH", zipCode: "45202" }, geolocation: { latitude: 39.1101, longitude: -84.5101 } },
      { locationId: "70100001", chain: "RALPHS", name: "Ralphs", geolocation: {} },
    ],
  });
  assert.equal(locations.length, 1, "needs a position");
  assert.equal(locations[0].krogerId, "01400943");
  assert.equal(locations[0].id, "kroger:01400943");

  const merged = mergeStores(osm, locations, here);
  assert(!merged.some(s => s.id === "osm:node/1"), "Kroger's own listing replaces OSM's copy");
  assert(merged.some(s => s.id === "kroger:01400943"));
  assert.equal(merged.filter(s => s.name === "ALDI").length, 1, "duplicate mapping is dropped");
  for (let i = 1; i < merged.length; i++) assert(merged[i - 1].distance <= merged[i].distance, "nearest first");

  const products = parseProducts({
    data: [
      { productId: "1", brand: "Kroger", description: "Kroger Grade A Large Eggs", productPageURI: "/p/kroger-eggs/0001111060903?x=1", items: [{ size: "12 ct", price: { regular: 2.99, promo: 2.49 } }] },
      { productId: "2", brand: "Eggland's Best", description: "Large Eggs", items: [{ size: "12 ct", price: { regular: 4.49, promo: 0 } }] },
      { productId: "3", description: "No price here", items: [{ size: "1 ct" }] },
      { productId: "4", description: "Gone", items: [{ price: { regular: 1 }, inventory: { stockLevel: "TEMPORARILY_OUT_OF_STOCK" } }] },
    ],
  });
  assert.equal(products.length, 2);
  assert.equal(products[0].price, 2.49, "sale price wins");
  assert(products[0].sale);
  assert.equal(products[0].name, "Kroger Grade A Large Eggs", "brand isn't doubled");
  assert.equal(products[0].path, "/p/kroger-eggs/0001111060903");
  assert.equal(products[1].price, 4.49);
  assert(!products[1].sale);
}

// --- Instacart request ------------------------------------------------------
{
  const body = instacartBody({
    title: "",
    back: "https://theclusterfox.com/cook?tab=shopping",
    items: [{ name: "eggs", quantity: 2, unit: "package", display: "eggs, carton of 12" }, { name: "" }, { name: "lemons", quantity: -1, unit: "crate" }],
  });
  assert.equal(body.title, "CookFox shopping list");
  assert.equal(body.link_type, "shopping_list");
  assert.equal(body.line_items.length, 2);
  assert.deepEqual(body.line_items[0], { name: "eggs", line_item_measurements: [{ quantity: 2, unit: "package" }], display_text: "eggs, carton of 12" });
  assert.deepEqual(body.line_items[1].line_item_measurements, [{ quantity: 1, unit: "each" }], "bad amounts fall back");
  assert.equal(body.landing_page_configuration.partner_linkback_url, "https://theclusterfox.com/cook?tab=shopping");
}

// --- Chains -----------------------------------------------------------------
{
  const keys = new Set();
  for (const c of chains) {
    assert(!keys.has(c.key), `duplicate chain ${c.key}`);
    keys.add(c.key);
    assert(c.site.startsWith("https://"), `${c.key}: site`);
    assert(c.match instanceof RegExp, `${c.key}: match`);
    if (c.search) {
      const url = new URL(c.search("black beans & rice"));
      assert(url.protocol === "https:", `${c.key}: search link`);
      assert(url.href.includes("black%20beans%20%26%20rice") || url.href.includes("black+beans"), `${c.key}: search term is encoded`);
    }
  }
  assert.equal(chainFor({ name: "ALDI", brand: "Aldi" }).key, "aldi");
  assert.equal(chainFor({ name: "Walmart Supercenter" }).key, "walmart");
  assert.equal(chainFor({ name: "Ralphs", chain: "RALPHS" }).key, "ralphs");
  assert.equal(chainFor({ name: "Fred Meyer - Burlingame", chain: "FRED" }).key, "fred-meyer");
  assert.equal(chainFor({ name: "Super Target" }).key, "target");
  assert.equal(chainFor({ name: "Corner Grocer" }), null);
  assert(chainsByKey.get("kroger").kroger);

  assert(lookupUrl({ name: "ALDI", brand: "Aldi" }, "eggs").startsWith("https://www.aldi.us/results?q=eggs"));
  assert.equal(lookupUrl({ name: "Corner Grocer", website: "https://corner.example/" }, "eggs"), "https://corner.example/");
  assert(lookupUrl({ name: "Corner Grocer" }, "eggs").startsWith("https://duckduckgo.com/?q=Corner%20Grocer%20eggs"));
  assert.equal(storeWebsite({ name: "Lidl" }), "https://www.lidl.com");
}

// --- Items to price come from the shopping list ------------------------------
const recipe = recipes.find(r => r.ingredients.some(l => l.ing === "egg")) ?? recipes[0];
let list = P.addRecipeToList([], recipe, recipe.servings, { pantry: [] });
list = P.addManualItem(list, "paper towels");
const items = itemsToPrice(list);
{
  assert(items.length > 1);
  assert(items.every(i => i.key && i.term && i.label && i.count >= 1), "every item has a key, term and package count");
  assert(items.some(i => i.key === "n:paper towels"), "hand-added items are priced too");
  const checked = itemsToPrice(list.map(i => ({ ...i, checked: true })));
  assert.equal(checked.length, 0, "checked items are already bought");
  const eggs = items.find(i => i.key === "i:egg");
  if (eggs) assert(/carton/.test(eggs.label), "eggs are priced by the carton");
  const order = orderItems(items);
  assert.equal(order.length, items.length);
  assert(order.every(o => o.name && o.quantity >= 1 && o.unit));
}

// --- Comparing stores ---------------------------------------------------------
{
  const A = { id: "a", name: "A" };
  const B = { id: "b", name: "B" };
  const two = [
    { key: "x", term: "eggs", label: "eggs", count: 2, unit: "package" },
    { key: "y", term: "milk", label: "milk", count: 1, unit: "package" },
    { key: "z", term: "bread", label: "bread", count: 1, unit: "package" },
  ];
  const prices = {
    typed: { a: { x: 3, y: 4 }, b: { x: 2.5, y: 4.5, z: 3 } },
    live: { a: { bread: [{ id: "p1", price: 2, sale: false }, { id: "p2", price: 1.5, sale: true }] } },
    chosen: { a: { z: "p2" } },
  };
  assert.equal(unitPrice(two[2], A, prices).price, 1.5, "the chosen product is used");
  assert.equal(unitPrice(two[2], A, { ...prices, chosen: {} }).price, 2, "else the best match");
  assert.equal(unitPrice(two[0], A, { ...prices, typed: { a: { x: 9 } } }).source, "typed", "a typed price wins");

  const r = compareStores(two, [A, B], prices);
  assert.equal(r.rows[0].cells[0].cost, 6, "price × packages");
  assert.deepEqual(
    r.totals.map(t => t.total),
    [11.5, 12.5]
  );
  assert.equal(r.common, 3);
  assert.equal(r.best.storeId, "a");
  assert.equal(r.best.savings, 1);
  assert.equal(r.rows[0].cheapest, "b");
  // Eggs at B (5), milk at A (4), bread at A (1.5) = 10.5, a dollar under A alone.
  assert.equal(r.split.total, 10.5);
  assert.equal(r.split.savings, 1);
  assert.deepEqual(r.split.stops, [{ storeId: "b", count: 1 }, { storeId: "a", count: 2 }]);

  // Unpriced items don't make a store look cheaper.
  const partial = compareStores(two, [A, B], { typed: { a: { x: 3 }, b: { x: 2.5, y: 1, z: 1 } } });
  assert.equal(partial.common, 1, "only eggs are priced at both");
  assert.equal(partial.best.storeId, "b");
  assert.equal(partial.best.total, 5);
  assert.equal(partial.totals[0].missing, 2);

  const single = compareStores(two, [A], prices);
  assert.equal(single.best, null, "nothing to compare with one store");
  assert.equal(compareStores(two, [A, B], {}).best, null, "no prices, no winner");
}

// --- Typed prices --------------------------------------------------------------
{
  assert.equal(parsePrice("$3"), 3);
  assert.equal(parsePrice(" 2.499 "), 2.5);
  assert.equal(parsePrice("1,299"), 1299);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("abc"), undefined);
  assert.equal(parsePrice("-2"), undefined);
}

// --- What the comparer remembers -------------------------------------------
{
  assert.deepEqual(normalizeStores(null), emptyStores());
  const m = normalizeStores({
    place: { name: "Cincinnati", lat: 39.1, lon: -84.5 },
    radius: 7,
    picked: [{ id: "a", name: "A" }, { id: "b", name: "B", website: "javascript:x" }, { nope: 1 }, { id: "c", name: "C" }, { id: "d", name: "D" }, { id: "e", name: "E" }],
    typed: { a: { x: 3, y: "4", z: -1 }, b: "bad" },
    chosen: { a: { x: "p1", y: 2 } },
  });
  assert.equal(m.radius, 10, "unknown distances reset");
  assert.equal(m.picked.length, 4, "at most four stores");
  assert.equal(m.picked[1].website, null);
  assert.deepEqual(m.typed, { a: { x: 3 } });
  assert.deepEqual(m.chosen, { a: { x: "p1" } });
}

console.log("CookFox stores: all checks passed");
