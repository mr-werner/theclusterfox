// The meal plan: a week of breakfasts, lunches, dinners and snacks built
// from CookFox recipes, sized to your calorie target, priced against a
// budget, and turned into a cooking schedule and a grocery list.
// Pure functions; the page keeps the plan in the F4T data.

import { ingredientsById } from "../../cook/data/ingredients.js";
import { factsOf, hardBlock } from "../../cook/model/discover.js";
import { buyFor } from "../../cook/model/buying.js";
import { addRecipeToList, shoppingAmount } from "../../cook/model/pantry.js";
import { scaledLines } from "../../cook/model/recipe.js";
import { pricePerUnit } from "../data/prices.js";

export const SLOTS = [
  { id: "breakfast", name: "Breakfast", share: 0.25, meals: ["breakfast"] },
  { id: "lunch", name: "Lunch", share: 0.3, meals: ["lunch"] },
  { id: "dinner", name: "Dinner", share: 0.35, meals: ["dinner"] },
  { id: "snack", name: "Snack", share: 0.1, meals: ["snack"] },
];
export const slotsById = new Map(SLOTS.map(s => [s.id, s]));

// --- Days ------------------------------------------------------------------

const pad = n => String(n).padStart(2, "0");
export const toDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromDay = day => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
export const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function addDays(day, n) {
  const d = fromDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** 0 = Monday ... 6 = Sunday. */
export const weekdayOf = day => (fromDay(day).getDay() + 6) % 7;

/** The first day of the plan week holding `day`: the prep day for batch cooks, else Monday. */
export function weekStart(day, profile) {
  const first = profile?.style === "prep" ? profile.prepDay : 0;
  return addDays(day, -((weekdayOf(day) - first + 7) % 7));
}

export const weekDays = start => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const dayLabel = (day, opts = { weekday: "short", month: "short", day: "numeric" }) => fromDay(day).toLocaleDateString(undefined, opts);

// --- Recipes ---------------------------------------------------------------

const cents = n => Math.round(n * 100) / 100;
const costCache = new WeakMap();

/** Dollars of ingredients in one serving (what you eat, not what you buy). */
export function servingCost(recipe) {
  if (!costCache.has(recipe)) {
    const total = scaledLines(recipe, recipe.servings).reduce((sum, l) => sum + pricePerUnit(l.item) * l.amount * (l.retained ?? 1), 0);
    costCache.set(recipe, total / recipe.servings);
  }
  return costCache.get(recipe);
}

/** Per-serving facts the planner uses. */
export function recipeFacts(recipe) {
  const n = factsOf(recipe).nutrition;
  return { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, cost: servingCost(recipe) };
}

/** Recipes the CookFox profile allows (allergies, diets and dislikes are hard limits). */
export const allowedRecipes = (recipes, cookProfile) => recipes.filter(r => !hardBlock(r, cookProfile ?? {}, {}));

/** Nutrition for one planned entry (a recipe portion, or what you ate instead). */
export function entryFacts(entry, getRecipe) {
  if (!entry) return null;
  if (entry.off) return { kcal: entry.off.kcal, protein: entry.off.protein ?? 0, carbs: 0, fat: 0, cost: 0, off: true };
  const recipe = getRecipe(entry.recipeId);
  if (!recipe) return null;
  const f = recipeFacts(recipe);
  const p = entry.portions;
  return { kcal: f.kcal * p, protein: f.protein * p, carbs: f.carbs * p, fat: f.fat * p, cost: f.cost * p };
}

/** What was planned for an entry, ignoring an off-plan swap. */
export const plannedFacts = (entry, getRecipe) => (entry ? entryFacts({ ...entry, off: null }, getRecipe) : null);

export function dayTotals(dayPlan, getRecipe) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 };
  for (const slot of SLOTS) {
    const f = entryFacts(dayPlan?.slots?.[slot.id], getRecipe);
    if (!f) continue;
    for (const k of Object.keys(total)) total[k] += f[k];
  }
  return total;
}

// --- Filling the week --------------------------------------------------------

function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PREP_FRIENDLY = r =>
  (r.occasions ?? []).includes("meal-prep") || (r.tags ?? []).some(t => ["make-ahead", "leftover-friendly", "freezer-friendly"].includes(t));

/** Portions (in half servings) that bring a recipe closest to a calorie goal. */
export function portionsFor(kcalPerServing, goal, max = 2.5) {
  if (!(kcalPerServing > 0)) return 1;
  return Math.min(max, Math.max(0.5, Math.round((goal / kcalPerServing) * 2) / 2));
}
const maxPortions = slotId => (slotId === "breakfast" || slotId === "snack" ? 2 : 2.5);

function score(recipe, { slotId, goal, proteinRatio, training, costWeight, favorites, random }) {
  const f = recipeFacts(recipe);
  const portions = portionsFor(f.kcal, goal, maxPortions(slotId));
  const kcal = f.kcal * portions;
  const fit = Math.abs(kcal - goal) / Math.max(goal, 1);
  const proteinPer100 = (f.protein * 4) / Math.max(f.kcal, 1);
  const proteinGap = Math.max(0, proteinRatio - proteinPer100);
  const carbShare = (f.carbs * 4) / Math.max(f.kcal, 1);
  const trainingBonus = training ? Math.min(carbShare, 0.6) * 0.6 : 0;
  const fav = favorites.has(recipe.id) ? 0.35 : 0;
  // One serving is what the recipe was written for; big multiples look odd.
  const oddPortion = Math.abs(portions - 1) * 0.35;
  return fit * 3 + proteinGap * 7 + oddPortion + costWeight * f.cost * portions * 0.2 - trainingBonus - fav - random() * 0.45;
}

function pick(candidates, ctx, avoid) {
  let best = null;
  let bestScore = Infinity;
  for (const r of candidates) {
    if (avoid.has(r.id)) continue;
    const s = score(r, ctx);
    if (s < bestScore) {
      best = r;
      bestScore = s;
    }
  }
  return best ?? candidates[0] ?? null;
}

/**
 * Fills the empty slots of a week (or every slot with replace).
 *   days        the 7 days, in order
 *   targets     day -> { kcal, protein } (from model/body.js), or null
 *   training    day -> workouts
 *   recipes     allowed recipes
 *   plan        current plan: day -> { slots }
 *   profile     style ("daily" | "prep"), prepDay
 *   costWeight  how hard to lean on cheap recipes (raised to fit a budget)
 * Returns new day -> { slots } for the 7 days.
 */
export function fillWeek({ days, targets, training, recipes, plan = {}, profile, people = 1, favorites = [], seed = 1, costWeight = 0.2, replace = false, defaultKcal = 2000 }) {
  const random = seeded(seed);
  const fav = new Set(favorites);
  const bySlot = Object.fromEntries(SLOTS.map(s => [s.id, recipes.filter(r => s.meals.some(m => r.meals.includes(m)))]));
  // Lunch can always borrow a dinner.
  bySlot.lunch = [...new Set([...bySlot.lunch, ...bySlot.dinner])];
  const out = {};
  const recent = Object.fromEntries(SLOTS.map(s => [s.id, []]));
  // A batch of breakfast or snacks (a loaf, a tray of bites) lasts a few days.
  const batches = {};

  const goalFor = (day, slot) => {
    const t = targets?.[day];
    const kcal = t?.kcal ?? defaultKcal;
    return { slotId: slot.id, goal: kcal * slot.share, proteinRatio: t ? (t.protein * 4) / t.kcal : 0.25, training: Boolean(training?.[day]?.length) };
  };

  // Batch cooking: a few recipes each, cooked on the prep day and midweek.
  const rotation = {};
  if (profile?.style === "prep") {
    for (const slot of SLOTS) {
      const pool = bySlot[slot.id].filter(r => slot.id === "snack" || slot.id === "breakfast" || PREP_FRIENDLY(r));
      const usable = pool.length >= 2 ? pool : bySlot[slot.id];
      const ctx = { ...goalFor(days[0], slot), costWeight, favorites: fav, random };
      const first = pick(usable, ctx, new Set());
      const second = pick(usable, ctx, new Set(first ? [first.id] : []));
      rotation[slot.id] = [first, second].filter(Boolean);
    }
  }

  days.forEach((day, i) => {
    const existing = plan[day]?.slots ?? {};
    const slots = {};
    for (const slot of SLOTS) {
      const keep = existing[slot.id];
      if (keep && !replace) {
        slots[slot.id] = keep;
        if (keep.recipeId) recent[slot.id].push(keep.recipeId);
        continue;
      }
      const ctx = { ...goalFor(day, slot), costWeight, favorites: fav, random };
      let recipe = null;
      let leftover = false;

      if (profile?.style === "prep" && rotation[slot.id]?.length) {
        // First half of the week is batch one, the rest is batch two.
        const batch = rotation[slot.id][i < 3 ? 0 : 1] ?? rotation[slot.id][0];
        recipe = batch;
        leftover = i !== 0 && i !== 3;
      } else if ((slot.id === "breakfast" || slot.id === "snack") && batches[slot.id]) {
        const b = batches[slot.id];
        const portions = portionsFor(recipeFacts(b.recipe).kcal, ctx.goal, maxPortions(slot.id));
        if (b.days < 3 && b.keeps && b.used + portions * people <= b.recipe.servings + 0.01) {
          recipe = b.recipe;
          leftover = true;
        }
      } else if (slot.id === "lunch" && i > 0) {
        // Cook dinner, take the leftovers for lunch the next day.
        const lastDinner = out[days[i - 1]]?.slots?.dinner;
        const r = lastDinner && !lastDinner.leftover && !lastDinner.off ? recipes.find(x => x.id === lastDinner.recipeId) : null;
        if (r && (r.tags ?? []).includes("leftover-friendly")) {
          recipe = r;
          leftover = true;
        }
      }
      if (!recipe) {
        const today = Object.values(slots).map(e => e.recipeId);
        const avoid = new Set([...recent[slot.id].slice(slot.id === "breakfast" || slot.id === "snack" ? -1 : -4), ...today]);
        recipe = pick(bySlot[slot.id], ctx, avoid);
      }
      if (!recipe) continue;
      const portions = portionsFor(recipeFacts(recipe).kcal, ctx.goal, maxPortions(slot.id));
      slots[slot.id] = { recipeId: recipe.id, portions, ...(leftover ? { leftover: true } : {}) };
      recent[slot.id].push(recipe.id);
      if (slot.id === "breakfast" || slot.id === "snack") {
        const b = leftover ? batches[slot.id] : (batches[slot.id] = { recipe, used: 0, days: 0, keeps: PREP_FRIENDLY(recipe) || recipe.servings >= 6 });
        b.used += portions * people;
        b.days += 1;
      }
    }
    out[day] = { slots };
  });
  return out;
}

// --- Cooking and shopping ----------------------------------------------------

/**
 * What to cook and when: each cooked slot starts a batch, and leftovers that
 * follow it add to the batch. Servings are rounded up to whole servings for
 * the people eating. [{ day, recipeId, servings, eats: [{ day, slot }] }]
 */
export function cookSchedule(plan, days, people = 1) {
  const cooks = [];
  const open = new Map();
  for (const day of days) {
    for (const slot of SLOTS) {
      const e = plan[day]?.slots?.[slot.id];
      if (!e?.recipeId) continue;
      let batch = e.leftover ? open.get(e.recipeId) : null;
      if (!batch) {
        batch = { day, recipeId: e.recipeId, exact: 0, eats: [] };
        cooks.push(batch);
        open.set(e.recipeId, batch);
      }
      // An eaten-elsewhere meal still came out of the batch if it was cooked.
      batch.exact += e.portions * people;
      batch.eats.push({ day, slot: slot.id, off: Boolean(e.off) });
    }
  }
  return cooks.map(({ exact, ...c }) => ({ ...c, servings: Math.max(1, Math.ceil(exact - 0.01)) }));
}

// Things most kitchens already have. They're listed apart from the main
// shopping so a first jar of cumin doesn't blow the week's budget.
const STAPLE_IDS = new Set(["salt", "black-pepper", "olive-oil", "neutral-oil", "sesame-oil", "soy-sauce", "honey", "maple-syrup", "vanilla", "rice-vinegar", "dijon", "tamari", "coconut-aminos", "tomato-paste", "cornstarch", "peanut-butter", "tahini", "gochujang", "nutritional-yeast"]);
export const isStaple = item => item.aisle === "spices" || item.aisle === "baking" || STAPLE_IDS.has(item.id);

/**
 * The grocery list for a cooking schedule, minus what's in the CookFox
 * pantry, with what to buy and an estimated price.
 *   { items: [{ id, ing, item, amount, buy, cost, aisle, staple }], total, staples, stapleCount, eatCost }
 * total is the shopping bill for everything but staples (whole packages),
 * staples is what the staples would add, and eatCost is the food you eat.
 */
export function groceries(cooks, getRecipe, pantry = []) {
  let list = [];
  const servings = new Map();
  for (const c of cooks) servings.set(c.recipeId, (servings.get(c.recipeId) ?? 0) + c.servings);
  let eatCost = 0;
  for (const [id, n] of servings) {
    const recipe = getRecipe(id);
    if (!recipe) continue;
    list = addRecipeToList(list, recipe, n, { pantry, onlyMissing: true });
    eatCost += servingCost(recipe) * n;
  }
  const items = list
    .map(i => {
      const item = ingredientsById.get(i.ing);
      const amount = shoppingAmount(i);
      const buy = buyFor(item, amount);
      const each = pricePerUnit(item);
      const bought = buy?.packs?.length ? buy.packs.reduce((n, p) => n + p.count * p.amount, 0) : buy?.named ? buy.total : amount;
      return { id: i.id, ing: i.ing, item, amount, buy, cost: cents(each * bought), aisle: item.aisle, staple: isStaple(item), recipes: i.sources.map(s => s.recipeId) };
    })
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.item.name.localeCompare(b.item.name));
  const sum = list => cents(list.reduce((n, i) => n + i.cost, 0));
  const staples = items.filter(i => i.staple);
  return { items, total: sum(items.filter(i => !i.staple)), staples: sum(staples), stapleCount: staples.length, eatCost: cents(eatCost) };
}

/** The CookFox link that puts a whole schedule on its shopping list. */
export function cookShopHref(cooks) {
  const servings = new Map();
  for (const c of cooks) servings.set(c.recipeId, (servings.get(c.recipeId) ?? 0) + c.servings);
  return `/cook?shop=${encodeURIComponent([...servings].map(([id, n]) => `${id}:${n}`).join(","))}`;
}

/**
 * Fills a week and, with a budget, leans harder on cheaper recipes until the
 * bill fits (or there's nothing cheaper). Returns { week, bill, fits }.
 */
export function fillWithinBudget(args, { budget, people = 1, getRecipe, pantry = [] }) {
  const weights = budget ? [0.2, 0.8, 2, 4, 8, 16] : [0.2];
  let best = null;
  for (const costWeight of weights) {
    const week = fillWeek({ ...args, people, costWeight });
    const merged = { ...args.plan, ...week };
    const bill = groceries(cookSchedule(merged, args.days, people), getRecipe, pantry).total;
    if (!best || bill < best.bill) best = { week, bill };
    if (!budget || bill <= budget) return { week, bill, fits: true };
  }
  return { ...best, fits: false };
}

/** Calorie and protein goals for one slot of a day. */
export function slotGoal(target, slotId, defaultKcal = 2000) {
  const share = slotsById.get(slotId)?.share ?? 0.25;
  const kcal = target?.kcal ?? defaultKcal;
  return { goal: kcal * share, proteinRatio: target ? (target.protein * 4) / target.kcal : 0.25 };
}

/** Recipes for a slot, best fit first: [{ recipe, portions, score }]. */
export function rankForSlot(recipes, slotId, { goal, proteinRatio = 0.25, training = false, costWeight = 0.2, favorites = [] }) {
  const slot = slotsById.get(slotId);
  const pool = recipes.filter(r => slot.meals.some(m => r.meals.includes(m)) || (slotId === "lunch" && r.meals.includes("dinner")));
  const ctx = { slotId, goal, proteinRatio, training, costWeight, favorites: new Set(favorites), random: () => 0.5 };
  return pool
    .map(recipe => ({ recipe, score: score(recipe, ctx), portions: portionsFor(recipeFacts(recipe).kcal, goal, maxPortions(slotId)) }))
    .sort((a, b) => a.score - b.score);
}
