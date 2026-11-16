import assert from "node:assert/strict";
import { recipes, recipesById } from "../../cook/data/recipes.js";
import { ingredients } from "../../cook/data/ingredients.js";
import { PRICES } from "../data/prices.js";
import * as B from "../model/body.js";
import * as P from "../model/planner.js";
import * as T from "../model/training.js";
import { mergeData, normalizeData } from "../state/f4tStore.js";
import { planItems } from "../model/planLink.js";

const get = id => recipesById.get(id);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

check("every CookFox ingredient has a price", () => {
  for (const i of ingredients) assert(PRICES[i.id] > 0, `no price for ${i.id}`);
});

check("calorie targets follow Mifflin-St Jeor, the goal and training", () => {
  const p = B.cleanProfile({ sex: "male", birthYear: 1996, heightCm: 180, activity: "desk", goal: "maintain" });
  // 30-year-old, 80 kg: 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(Math.round(B.restingCalories(p, 80 * B.LBS_PER_KG, 2026)), 1780);
  const rest = B.dayTargets(p, 80 * B.LBS_PER_KG, [], 2026);
  assert.equal(rest.kcal, Math.round((1780 * 1.2) / 10) * 10);
  const lift = B.dayTargets(p, 80 * B.LBS_PER_KG, [{ minutes: 60, met: 5 }], 2026);
  assert(lift.kcal > rest.kcal && lift.carbs > rest.carbs);
  const lose = B.dayTargets({ ...p, goal: "lose", rate: 1 }, 80 * B.LBS_PER_KG, [], 2026);
  assert.equal(lose.kcal, Math.round((1780 * 1.2 - 500) / 10) * 10);
  const tiny = B.dayTargets(B.cleanProfile({ sex: "female", birthYear: 1950, heightCm: 150, goal: "lose", rate: 2 }), 110, [], 2026);
  assert.equal(tiny.kcal, 1200);
  assert(tiny.floored);
});

check("weigh-in feedback reads the trend, not single days", () => {
  const p = B.cleanProfile({ goal: "lose", rate: 1 });
  const weights = Array.from({ length: 28 }, (_, i) => ({ day: P.addDays("2026-10-01", i), lbs: 200 - i * (1 / 7) + (i % 2 ? 1 : -1) }));
  const change = B.weeklyChange(weights, "2026-10-28");
  assert(change < -0.5 && change > -1.5, `change ${change}`);
  assert.equal(B.weightFeedback(p, weights.slice(0, 1), "2026-10-01").tone, "info");
  const flat = weights.map(w => ({ ...w, lbs: 200 }));
  const f = B.weightFeedback(p, flat, "2026-10-28");
  assert.equal(f.tone, "nudge");
  assert(f.kcal < 0, "flat while losing should suggest eating less");
});

check("LiftFox plan sessions become training days", () => {
  const raw = {
    plans: [{ id: "p1", createdAt: "2026-11-01", updatedAt: "2026-11-01", completed: {}, program: { goal: "size", daysPerWeek: 3, minutes: 50, weeks: 1, startDate: "2026-11-16", schedule: [{ index: 0, deload: false, sessions: [{ id: "w1d1", name: "Full body", weekday: 0 }, { id: "w1d2", name: "Full body", weekday: 2 }, { id: "w1d3", name: "Full body", weekday: 4 }] }] } }],
    activePlanId: "p1",
  };
  const w = T.liftWorkouts(raw, "2026-11-16", "2026-11-22");
  assert.deepEqual(w.map(x => x.day), ["2026-11-16", "2026-11-18", "2026-11-20"]);
  assert.equal(w[0].minutes, 50);
  assert(T.fuelNote(w).includes("protein"));
});

const profile = B.cleanProfile({ sex: "female", birthYear: 1990, heightCm: 168, goal: "lose", rate: 1, style: "daily" });
const days = P.weekDays("2026-11-16");
const targets = Object.fromEntries(days.map(d => [d, B.dayTargets(profile, 165, [], 2026)]));

check("a filled week is sized to the target and follows the CookFox profile", () => {
  const allowed = P.allowedRecipes(recipes, { allergies: ["milk"], diets: ["vegetarian"] });
  const week = P.fillWeek({ days, targets, recipes: allowed, profile, seed: 7 });
  for (const d of days) {
    for (const s of P.SLOTS) {
      const e = week[d].slots[s.id];
      assert(e, `${d} ${s.id} empty`);
      assert(allowed.some(r => r.id === e.recipeId), "recipe outside the profile");
    }
    const kcal = P.dayTotals(week[d], get).kcal;
    assert(Math.abs(kcal - targets[d].kcal) / targets[d].kcal < 0.3, `${d}: ${kcal} vs ${targets[d].kcal}`);
  }
});

check("meal prep cooks in two batches and the rest are leftovers", () => {
  const prep = { ...profile, style: "prep" };
  const week = P.fillWeek({ days, targets, recipes, profile: prep, seed: 3 });
  const cooks = P.cookSchedule(week, days, 1);
  assert.deepEqual([...new Set(cooks.map(c => c.day))], [days[0], days[3]]);
});

check("groceries cover what's cooked, in store packages, and leave out the pantry", () => {
  const week = P.fillWeek({ days, targets, recipes, profile, seed: 5 });
  const cooks = P.cookSchedule(week, days, 2);
  const shop = P.groceries(cooks, get);
  assert(shop.total > 0 && shop.eatCost > 0 && shop.items.length > 5);
  const first = shop.items.find(i => !i.staple);
  const less = P.groceries(cooks, get, [{ id: "x", ing: first.ing, name: null, expires: null, low: false }]);
  assert(!less.items.some(i => i.ing === first.ing));
  assert(P.cookShopHref(cooks).startsWith("/cook?shop="));
});

check("a budget pushes the plan cheaper", () => {
  const args = { days, targets, recipes, profile, seed: 9 };
  const free = P.fillWithinBudget(args, { budget: null, getRecipe: get });
  const tight = P.fillWithinBudget(args, { budget: 40, getRecipe: get });
  assert(tight.bill <= free.bill);
});

check("plans, weigh-ins and workouts merge between devices", () => {
  const a = normalizeData({ plan: { "2026-11-16": { slots: { dinner: { recipeId: "koshari", portions: 1 } }, updatedAt: "2026-11-16T10:00:00Z" } }, weights: [{ day: "2026-11-15", lbs: 180, at: "2026-11-15T08:00:00Z" }], updatedAt: "2026-11-16T10:00:00Z" });
  const b = normalizeData({ plan: { "2026-11-16": { slots: {}, updatedAt: "2026-11-16T09:00:00Z" }, "2026-11-17": { slots: { lunch: { recipeId: "koshari", portions: 2, leftover: true } }, updatedAt: "2026-11-16T09:00:00Z" } }, weights: [{ day: "2026-11-15", lbs: 181, at: "2026-11-15T09:00:00Z" }], deletedWeights: [], updatedAt: "2026-11-15T00:00:00Z" });
  const m = mergeData(a, b);
  assert.equal(m.plan["2026-11-16"].slots.dinner.recipeId, "koshari");
  assert.equal(m.plan["2026-11-17"].slots.lunch.portions, 2);
  assert.equal(m.weights[0].lbs, 181);
});

check("PlanFox gets the day's meals and what to cook", () => {
  const raw = { plan: { "2026-11-16": { slots: { dinner: { recipeId: "koshari", portions: 1 } } }, "2026-11-17": { slots: { lunch: { recipeId: "koshari", portions: 1, leftover: true } } } } };
  const items = planItems(raw, "2026-11-16", "2026-11-17");
  assert(items.some(i => i.id === "meals:2026-11-16" && i.href === "/f4t?day=2026-11-16"));
  const cook = items.find(i => i.id.startsWith("cook:"));
  assert.equal(cook.day, "2026-11-16");
  assert(cook.href.includes("servings=2"));
});

console.log(`\n${passed} diet planner checks passed`);
