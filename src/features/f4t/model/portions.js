// Portions you can see without a scale: your own hand. A palm (thickness and
// size) of protein, a cupped handful of carbs, a fist of vegetables, a thumb
// of fats. Hands scale with the body, so the guide scales too. Figures are
// typical values for one hand portion, close enough to keep a rough count.

import { scaledLines } from "../../cook/model/recipe.js";
import { toGrams } from "../../cook/model/units.js";

export const HANDS = {
  palms: { name: "palm", plural: "palms", what: "protein", hint: "meat, fish, eggs, tofu, Greek yogurt", kcal: 120, protein: 24, carbs: 2, fat: 2.5 },
  handfuls: { name: "cupped hand", plural: "cupped hands", what: "carbs", hint: "rice, pasta, bread, potatoes, fruit", kcal: 110, protein: 3, carbs: 24, fat: 0.5 },
  fists: { name: "fist", plural: "fists", what: "vegetables", hint: "salad, broccoli, peppers, greens", kcal: 25, protein: 1.5, carbs: 5, fat: 0 },
  thumbs: { name: "thumb", plural: "thumbs", what: "fats", hint: "oil, butter, cheese, nuts, dressing", kcal: 90, protein: 1, carbs: 1, fat: 9.5 },
};
export const HAND_KEYS = Object.keys(HANDS);

const half = n => Math.round(n * 2) / 2;

// Fruit and starchy produce count as carbs, not as a fist of vegetables.
const NOT_VEG = new Set(["banana", "apple", "mango", "orange", "pineapple", "berries", "lemon", "lime", "avocado", "baby-potatoes", "sweet-potatoes", "garlic", "ginger", "firm-tofu", "frozen-corn"]);
const vegCache = new WeakMap();

/** Grams of vegetables in one serving of a recipe. */
export function vegGrams(recipe) {
  if (!vegCache.has(recipe)) {
    let grams = 0;
    for (const l of scaledLines(recipe, recipe.servings)) {
      if (!["produce", "frozen"].includes(l.item.aisle) || NOT_VEG.has(l.item.id)) continue;
      grams += toGrams(l.item, l.amount);
    }
    vegCache.set(recipe, grams / recipe.servings);
  }
  return vegCache.get(recipe);
}

/** Hand portions for a meal's nutrition. veg is fists of vegetables if known. */
export function handsFor({ protein = 0, carbs = 0, fat = 0 }, veg = 0) {
  const fists = half(veg);
  // Vegetables and protein foods bring some carbs and fat of their own.
  const restCarbs = Math.max(0, carbs - fists * 5 - (protein / 24) * 2);
  return {
    palms: half(protein / 24),
    handfuls: half(restCarbs / 24),
    fists,
    thumbs: half(Math.max(0, fat - (protein / 24) * 2.5) / 9.5),
  };
}

/** Hand portions in one serving of a recipe. */
export function recipeHands(recipe, facts) {
  return handsFor(facts, vegGrams(recipe) / 80);
}

/** Nutrition of a meal counted in hand portions. */
export function fromHands(hands) {
  const out = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const k of HAND_KEYS) {
    const n = Number(hands[k]) || 0;
    for (const key of Object.keys(out)) out[key] += HANDS[k][key] * n;
  }
  return out;
}

/** A day's targets as hand portions to aim for. */
export function dailyHands(target) {
  if (!target) return null;
  const fists = 5;
  const palms = half(target.protein / 24);
  const handfuls = half(Math.max(0, target.carbs - fists * 5 - palms * 2) / 24);
  const thumbs = half(Math.max(0, target.fat - palms * 2.5) / 9.5);
  return { palms, handfuls, fists, thumbs };
}

const num = n => (n % 1 ? `${Math.floor(n) || ""}½`.replace(/^½/, "½") : String(n));

/** "1½ palms protein · 2 cupped hands carbs · 1 fist veg · 1 thumb fat" */
export function handsText(hands, { short = false } = {}) {
  return HAND_KEYS.filter(k => hands[k] > 0)
    .map(k => {
      const h = HANDS[k];
      const word = hands[k] > 1 ? h.plural : h.name;
      return short ? `${num(hands[k])} ${word}` : `${num(hands[k])} ${word} ${h.what === "vegetables" ? "veg" : h.what}`;
    })
    .join(" · ");
}

