// Cooking from your garden: which CookFox ingredients the food growing in
// GrowFox stands in for, and which recipes use it. GrowFox works out what's
// growing and what's ready (grow/model/cookLink.js); this file only maps
// plants to ingredients and matches recipes, so it stays testable in Node.
import { ingredientsById } from "../data/ingredients.js";
import { toGrams } from "./units.js";

// GrowFox plant id -> the CookFox ingredients you can pick from it.
export const GARDEN_INGREDIENTS = {
  tomato: ["tomato", "cherry-tomatoes"],
  pepper: ["bell-pepper", "jalapeno"],
  eggplant: ["eggplant"],
  cucumber: ["cucumber"],
  zucchini: ["zucchini"],
  beans: ["green-beans"],
  corn: ["frozen-corn"],
  sweetpotato: ["sweet-potatoes"],
  peas: ["frozen-peas"],
  spinach: ["spinach"],
  kale: ["kale"],
  broccoli: ["broccoli"],
  cabbage: ["cabbage"],
  carrot: ["carrot"],
  onion: ["onion", "red-onion"],
  garlic: ["garlic"],
  potato: ["baby-potatoes"],
  strawberry: ["berries"],
  blueberry: ["berries"],
  raspberry: ["berries"],
  apple: ["apple"],
  citrus: ["lemon", "lime", "orange"],
  avocado: ["avocado"],
  olive: ["olives"],
  basil: ["basil"],
  parsley: ["parsley"],
  cilantro: ["cilantro"],
  dill: ["dill"],
  mint: ["mint"],
  chives: ["green-onion"],
  thyme: ["thyme"],
  oregano: ["oregano"],
};

// GrowFox's harvest rows -> Map of ingredient id -> { plantId, name, ready, readyOn }.
// When two plants give the same ingredient (strawberries and blueberries are
// both "berries"), the one that's ready wins.
export function gardenIndex(harvest = []) {
  const index = new Map();
  for (const row of harvest) {
    for (const ing of GARDEN_INGREDIENTS[row.plantId] ?? []) {
      const prev = index.get(ing);
      if (!prev || (row.ready && !prev.ready)) index.set(ing, row);
    }
  }
  return index;
}

// How much a line leans on the garden, by weight: a pound of tomatoes is the
// point of the dish, a clove of garlic or a pinch of parsley isn't.
function lineWeight(line) {
  const g = toGrams(ingredientsById.get(line.ing), line.amount);
  return g >= 100 ? 1 : g >= 20 ? 0.5 : 0.2;
}

// Food still growing counts for a little, so it ranks but ready food leads.
const GROWING_SHARE = 0.35;
// Less than this and the garden barely features (a clove of garlic and a
// sprinkle of parsley), so the recipe isn't called a garden recipe.
const MIN_WEIGHT = 0.6;

// What a recipe would use from the garden: { ready, growing } as plant names,
// most-used first, plus keys (the lines it covers) and a 0..1 score. Null
// when the garden barely features.
export function recipeGarden(recipe, index) {
  if (!index?.size) return null;
  const byName = new Map();
  const keys = [];
  let total = 0;
  for (const l of recipe.ingredients) {
    const row = index.get(l.ing);
    if (!row) continue;
    const w = lineWeight(l);
    total += w;
    keys.push(l.key ?? l.ing);
    const name = row.name.toLowerCase();
    const prev = byName.get(name) ?? { name, ready: row.ready, w: 0 };
    byName.set(name, { ...prev, w: prev.w + w });
  }
  if (total < MIN_WEIGHT) return null;
  const rows = [...byName.values()].sort((a, b) => b.w - a.w);
  const ready = rows.filter(r => r.ready);
  const growing = rows.filter(r => !r.ready);
  const weight = ready.reduce((n, r) => n + r.w, 0) + growing.reduce((n, r) => n + r.w, 0) * GROWING_SHARE;
  return { ready: ready.map(r => r.name), growing: growing.map(r => r.name), keys, score: Math.min(1, weight / 2) };
}

export const gardenScore = g => g?.score ?? 0;

export function gardenReason(g) {
  if (!g) return null;
  const list = g.ready.length ? g.ready : g.growing;
  const names = list.slice(0, 2).join(" and ") + (list.length > 2 ? ` and ${list.length - 2} more` : "");
  return g.ready.length ? `Uses ${names} from your garden` : `Uses ${names} you're growing`;
}
