// Recipe math: scaling, nutrition estimates, allergens and diets.
import { ingredientsById } from "../data/ingredients.js";
import { toGrams } from "./units.js";

// A recipe line is identified by its key (when an ingredient appears twice,
// like pasta-water salt and sauce salt) or else its ingredient id.
export const lineKey = line => line.key ?? line.ing;

export function linesByKey(recipe) {
  return new Map(recipe.ingredients.map(l => [lineKey(l), l]));
}

export const scaleFactor = (recipe, servings) => servings / recipe.servings;

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 48;
export const clampServings = n => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(Number(n) || 1)));

// Ingredient lines with scaled amounts.
export function scaledLines(recipe, servings) {
  const f = scaleFactor(recipe, servings);
  return recipe.ingredients.map(l => ({ ...l, key: lineKey(l), item: ingredientsById.get(l.ing), amount: l.amount * f }));
}

// What one step uses, scaled.
export function scaledUses(recipe, stepIndex, servings) {
  const f = scaleFactor(recipe, servings);
  const lines = linesByKey(recipe);
  return (recipe.steps[stepIndex]?.uses ?? []).map(u => {
    const l = lines.get(u.ing);
    return { key: u.ing, ing: l.ing, item: ingredientsById.get(l.ing), amount: u.amount * f, prep: l.prep };
  });
}

export const NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodium"];

// Nutrition for the whole recipe as written, from ingredient-level values.
// `retained` covers ingredients that mostly don't end up in the food, like
// the salt in pasta water.
export function recipeNutrition(recipe) {
  const total = Object.fromEntries(NUTRIENTS.map(k => [k, 0]));
  for (const l of recipe.ingredients) {
    const item = ingredientsById.get(l.ing);
    const grams = toGrams(item, l.amount) * (l.retained ?? 1);
    NUTRIENTS.forEach((k, i) => {
      total[k] += (item.n[i] * grams) / 100;
    });
  }
  const perServing = Object.fromEntries(NUTRIENTS.map(k => [k, total[k] / recipe.servings]));
  return { total, perServing };
}

// Display rounding that avoids false precision.
export function roundNutrient(key, value) {
  if (key === "kcal") return value < 100 ? Math.round(value / 5) * 5 : Math.round(value / 10) * 10;
  if (key === "sodium") return Math.round(value / 10) * 10;
  return value < 1 ? Math.round(value * 2) / 2 : Math.round(value);
}

export function allergensOf(recipe) {
  const set = new Set();
  for (const l of recipe.ingredients) for (const a of ingredientsById.get(l.ing).allergens ?? []) set.add(a);
  return [...set];
}

export function dietsOf(recipe) {
  const animals = new Set(recipe.ingredients.map(l => ingredientsById.get(l.ing).animal).filter(Boolean));
  const allergens = allergensOf(recipe);
  const vegetarian = !animals.has("meat") && !animals.has("fish");
  return {
    vegetarian,
    vegan: vegetarian && !animals.has("dairy") && !animals.has("egg") && !animals.has("honey"),
    pescatarian: !animals.has("meat"),
    "gluten-free": !allergens.includes("gluten"),
    "dairy-free": !allergens.includes("milk"),
    "egg-free": !allergens.includes("egg"),
  };
}

export const DIETS = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "egg-free": "Egg-free",
};

// Notes worth showing when the batch changes size. Cooking time and
// temperature don't scale with quantity, so we say so instead of pretending.
export function scaleNotes(recipe, servings) {
  const f = scaleFactor(recipe, servings);
  const notes = [];
  if (recipe.scaleNote && f !== 1) notes.push(recipe.scaleNote);
  if (f >= 1.5) {
    notes.push("Cooking times don't scale with the batch. Use a bigger pan or work in batches so food isn't crowded, and judge doneness by look and temperature rather than the clock.");
  } else if (f <= 0.6) {
    notes.push("Smaller batches can cook faster, especially in a big pan. Start checking early.");
  }
  const lines = scaledLines(recipe, servings);
  if (lines.some(l => l.item.whole && Math.abs(Math.round(l.amount) - l.amount) > 0.05)) {
    notes.push("Eggs are rounded to whole eggs. For half an egg, beat one and use about half.");
  }
  return notes;
}

// Every distinct ingredient id a recipe uses.
export const ingredientIds = recipe => [...new Set(recipe.ingredients.map(l => l.ing))];

export function servingWord(recipe, n) {
  const [one, many] = recipe.servingName ?? ["serving", "servings"];
  return n === 1 ? one : many;
}
