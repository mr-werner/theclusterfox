// GroceryFox: the list, sections, coupons, comparison, spending and the
// CookFox link. Run with `node src/features/grocery/tests/validate.mjs`.
import assert from "node:assert/strict";
import { guessSection, SECTIONS } from "../data/sections.js";
import { savingsFor } from "../data/savings.js";
import { addItem, amountText, bySection, clearChecked, listText, parseEntry, toggleItem } from "../model/list.js";
import { compareList, couponAdjuster, couponFitsItem, couponFitsStore, couponSaves, couponTotal, itemsToPrice, versusPreferred } from "../model/compare.js";
import { lastMonths, spendingSummary } from "../model/spending.js";
import { addCookItems, cookItems, newCookItems } from "../model/cookLink.js";
import { emptyData, normalizeData, MAX_STORES } from "../state/groceryStore.js";
import { compareStores } from "../../cook/model/stores.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("typed entries split into amount, unit and name", () => {
  assert.deepEqual(parseEntry("2 lb chicken breast"), { qty: 2, unit: "lb", name: "chicken breast" });
  assert.deepEqual(parseEntry("eggs x2"), { qty: 2, unit: "each", name: "eggs" });
  assert.deepEqual(parseEntry("3 apples"), { qty: 3, unit: "each", name: "apples" });
  assert.deepEqual(parseEntry("1 gallon of milk"), { qty: 1, unit: "gal", name: "milk" });
  assert.deepEqual(parseEntry("  paper   towels "), { qty: 1, unit: "each", name: "paper towels" });
  assert.equal(parseEntry("0 bananas").qty, 1, "a zero amount means one");
  assert.equal(parseEntry("").name, "");
});

test("items land in the right store section", () => {
  assert.equal(guessSection("bananas"), "produce");
  assert.equal(guessSection("peanut butter"), "pantry", "longer words win over 'butter'");
  assert.equal(guessSection("ice cream"), "frozen");
  assert.equal(guessSection("butter"), "dairy");
  assert.equal(guessSection("paper towels"), "household");
  assert.equal(guessSection("ground beef"), "meat");
  assert.equal(guessSection("dog food"), "pet");
  assert.equal(guessSection("widgets"), "other");
  assert.ok(SECTIONS.at(-1).id === "other");
});

test("adding, merging, checking and clearing", () => {
  let list = addItem([], "2 lb chicken");
  list = addItem(list, "eggs");
  list = addItem(list, "Eggs"); // same item bumps the amount
  assert.equal(list.length, 2);
  assert.equal(list.find(i => i.name === "eggs").qty, 2);
  assert.equal(amountText(list.find(i => i.name === "chicken")), "2 lb");
  list = toggleItem(list, list[0].id);
  assert.equal(list.filter(i => i.checked).length, 1);
  assert.ok(!listText(list).includes("chicken") || !list.find(i => i.name === "chicken").checked);
  const groups = bySection(list);
  assert.ok(groups.every(([, items]) => items.length));
  assert.equal(clearChecked(list).length, 1);
  assert.equal(addItem(list, "   ").length, list.length, "blank entries are ignored");
});

const stores = [
  { id: "a", name: "Kroger", chain: "KROGER", krogerId: "01400376" },
  { id: "b", name: "ALDI", brand: "Aldi" },
  { id: "c", name: "Corner Market" },
];

test("coupons match items and stores", () => {
  const item = { term: "Cheerios cereal" };
  assert.ok(couponFitsItem({ item: "cheerios" }, item));
  assert.ok(couponFitsItem({ item: "Eggs" }, { term: "egg" }), "plurals don't matter");
  assert.ok(!couponFitsItem({ item: "honey cheerios" }, item));
  assert.ok(couponFitsStore({ store: "any" }, stores[1]));
  assert.ok(couponFitsStore({ store: "chain:kroger" }, stores[0]));
  assert.ok(!couponFitsStore({ store: "chain:kroger" }, stores[1]));
  assert.ok(couponFitsStore({ store: "b" }, stores[1]));
  assert.equal(couponSaves({ kind: "off", value: 1 }, 3.49, 1), 1);
  assert.equal(couponSaves({ kind: "percent", value: 25 }, 4, 2), 2);
  assert.equal(couponSaves({ kind: "off", value: 9 }, 2, 1), 2, "never more than the item costs");
  assert.equal(couponSaves({ kind: "off", value: 1, minQty: 2 }, 2, 1), 0, "needs the minimum");
});

test("the comparison takes coupons off and finds the cheaper store", () => {
  let list = addItem([], "milk");
  list = addItem(list, "2 cheerios");
  const prices = { typed: { a: { "n:milk": 3.5, "n:cheerios": 4 }, b: { "n:milk": 2.9, "n:cheerios": 3.5 } }, live: {}, chosen: {} };
  const today = "2026-11-23";
  const plain = compareList(list, stores.slice(0, 2), prices, [], today);
  assert.equal(plain.totals[0].total, 11.5);
  assert.equal(plain.totals[1].total, 9.9);
  assert.equal(plain.best.storeId, "b");

  const coupons = [{ id: "1", item: "cheerios", store: "chain:kroger", kind: "off", value: 2, minQty: 1, expires: null, used: false }];
  const withCoupon = compareList(list, stores.slice(0, 2), prices, coupons, today);
  assert.equal(withCoupon.totals[0].total, 9.5, "$2 off the two boxes");
  assert.equal(couponTotal(withCoupon, 0), 2);
  assert.equal(withCoupon.best.storeId, "a");

  const expired = [{ ...coupons[0], expires: "2026-11-01" }];
  assert.equal(compareList(list, stores.slice(0, 2), prices, expired, today).totals[0].total, 11.5, "expired coupons don't count");
  assert.equal(couponAdjuster([{ ...coupons[0], used: true }], today), null, "used coupons don't count");

  const vs = versusPreferred(plain, stores.slice(0, 2), "a");
  assert.equal(vs.storeId, "b");
  assert.equal(vs.savings, 1.6);
  assert.equal(versusPreferred(withCoupon, stores.slice(0, 2), "a"), null, "preferred is already cheapest");
  assert.equal(versusPreferred(plain, stores.slice(0, 2), null), null);
});

test("CookFox's comparison is unchanged without an adjuster", () => {
  const items = itemsToPrice(addItem([], "milk"));
  const r = compareStores(items, stores.slice(0, 1), { typed: { a: { "n:milk": 2 } } });
  assert.equal(r.totals[0].total, 2);
});

test("spending: months, budget and pace", () => {
  assert.deepEqual(lastMonths("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
  const trips = [
    { date: "2026-11-02", storeName: "ALDI", total: 80 },
    { date: "2026-11-15", storeName: "Kroger", total: 120 },
    { date: "2026-10-10", storeName: "ALDI", total: 300 },
    { date: "2025-01-01", storeName: "ALDI", total: 999 },
  ];
  const s = spendingSummary(trips, "2026-11-20", 400);
  assert.equal(s.thisMonth, 200);
  assert.equal(s.trips, 2);
  assert.equal(s.perTrip, 100);
  assert.equal(s.left, 200);
  assert.equal(s.pace, 300);
  assert.equal(s.overPace, false);
  assert.equal(s.average, 300);
  assert.equal(s.months.length, 6);
  assert.equal(s.stores[0].name, "Kroger");
  assert.equal(spendingSummary([], "2026-11-02", null).pace, null);
});

test("saved data is cleaned up", () => {
  const d = normalizeData({
    list: [{ id: "1", name: "Milk", qty: -2, unit: "bogus", section: "nowhere" }, { id: "2", name: "" }, "x"],
    stores: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `Store ${i}` })),
    preferred: "s9",
    coupons: [{ id: "c", item: "eggs", kind: "percent", value: 150 }, { id: "d", item: "eggs", kind: "off", value: 1, expires: "soon" }],
    trips: [{ id: "t", date: "2026-11-01", total: 12.345, storeName: "A" }, { id: "u", date: "bad", total: 3 }],
    budget: -5,
    radius: 7,
  });
  assert.deepEqual(d.list.map(i => [i.qty, i.unit, i.section]), [[1, "each", "other"]]);
  assert.equal(d.stores.length, MAX_STORES);
  assert.equal(d.preferred, null);
  assert.equal(d.coupons.length, 1);
  assert.equal(d.coupons[0].expires, null);
  assert.deepEqual(d.trips.map(t => t.total), [12.35]);
  assert.equal(d.budget, null);
  assert.equal(d.radius, 10);
  assert.deepEqual(normalizeData(null), emptyData());
});

test("CookFox's shopping list comes over once", () => {
  const raw = {
    shopping: [
      { id: "1", ing: "olive-oil", sources: [{ recipeId: "x", amount: 60 }], extra: 0, checked: false },
      { id: "2", name: "paper towels", sources: [], checked: false },
      { id: "3", name: "done already", sources: [], checked: true },
    ],
  };
  const items = cookItems(raw);
  assert.equal(items.length, 2);
  const oil = items.find(i => i.cookKey === "i:olive-oil");
  assert.equal(oil.name, "olive oil");
  assert.equal(oil.section, "pantry");
  assert.equal(items.find(i => i.name === "paper towels").section, "household");
  const list = addCookItems([], items);
  assert.ok(list.every(i => i.from === "cookfox"));
  assert.equal(newCookItems(raw, list).length, 0, "nothing new once added");
  assert.equal(newCookItems(raw, addItem([], "Paper Towels")).length, 1, "a typed item with the same name counts as added");
  assert.deepEqual(cookItems(null), []);
});

test("coupon and weekly-ad pages for each kind of store", () => {
  const kroger = savingsFor({ name: "Kroger", chain: "KROGER" });
  assert.ok(kroger.known && kroger.coupons.startsWith("https://www.kroger.com/"));
  const safeway = savingsFor({ name: "Safeway" });
  assert.ok(safeway.coupons.startsWith("https://www.safeway.com/"));
  const walmart = savingsFor({ name: "Walmart Supercenter" });
  assert.equal(walmart.coupons, null);
  assert.ok(walmart.deals);
  const local = savingsFor({ name: "Corner Market" });
  assert.ok(!local.known && local.coupons.includes("duckduckgo.com") && local.coupons.includes("Corner%20Market"));
});

console.log(`GroceryFox: ${passed} checks passed`);
