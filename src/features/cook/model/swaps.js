// Ingredient swaps: which ones fit a recipe and a cook, what they change, and
// a recipe rebuilt with them applied. A swapped recipe keeps each line's key,
// so prep checklists, step tracking and saved sessions keep working.
import { ALLERGENS, ingredientsById } from "../data/ingredients.js";
import { recipes, recipesById } from "../data/recipes.js";
import { swaps, swapsById } from "../data/swaps.js";
import { DIETS, NUTRIENTS, allergensOf, dietsOf, lineKey, recipeNutrition } from "./recipe.js";
import { ML_PER_CUP } from "./units.js";

// Cups per canonical unit, for "same volume" swaps.
function cupsPer(item) {
  if (item.unit === "g" && item.gPerCup) return 1 / item.gPerCup;
  if (item.unit === "ml") return 1 / ML_PER_CUP;
  return null;
}

export function swapRatio(swap) {
  if (swap.ratio === "volume") {
    const a = cupsPer(ingredientsById.get(swap.from));
    const b = swap.to && cupsPer(ingredientsById.get(swap.to));
    return a && b ? a / b : 1;
  }
  return swap.ratio ?? 1;
}

export function swapApplies(swap, recipe) {
  if (swap.only && !swap.only.includes(recipe.id)) return false;
  if (swap.notIn?.includes(recipe.id)) return false;
  return recipe.ingredients.some(l => l.ing === swap.from);
}

// Why an ingredient doesn't fit the cook's allergies and diets, if it doesn't.
export function itemConflicts(item, profile = {}) {
  const out = [];
  for (const a of profile.allergies ?? []) if (item.allergens?.includes(a)) out.push({ kind: "allergy", key: a, label: ALLERGENS[a] });
  const animal = item.animal;
  const diet = {
    vegetarian: animal === "meat" || animal === "fish",
    vegan: Boolean(animal),
    pescatarian: animal === "meat",
    "gluten-free": item.allergens?.includes("gluten"),
    "dairy-free": item.allergens?.includes("milk"),
    "egg-free": item.allergens?.includes("egg"),
  };
  for (const d of profile.diets ?? []) if (diet[d]) out.push({ kind: "diet", key: d, label: DIETS[d] });
  return out;
}

// Only keep choices that still make sense for this recipe.
export function cleanChoices(base, choices) {
  const out = {};
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) return out;
  for (const l of base.ingredients) {
    const k = lineKey(l);
    const swap = swapsById.get(choices[k]);
    if (swap && swap.from === l.ing && swapApplies(swap, base)) out[k] = swap.id;
  }
  return out;
}

const cache = new Map();
const MAX_CACHE = 300;

// The recipe rebuilt with swaps applied: { lineKey: swapId }. Results are
// cached, so the same choices always give the same object.
export function applySwaps(base, choices) {
  const valid = cleanChoices(base, choices);
  const keys = Object.keys(valid);
  if (!keys.length) return base;
  const sig = `${base.id}|${keys.sort().map(k => `${k}=${valid[k]}`).join(",")}`;
  if (cache.has(sig)) return cache.get(sig);

  const chosen = new Map(keys.map(k => [k, { swap: swapsById.get(valid[k]), ratio: swapRatio(swapsById.get(valid[k])) }]));
  const ingredients = base.ingredients.flatMap(l => {
    const k = lineKey(l);
    const c = chosen.get(k);
    if (!c) return [l];
    if (!c.swap.to) return [];
    const next = { ...l, key: k, ing: c.swap.to, amount: l.amount * c.ratio, swap: c.swap.id, from: l.ing };
    if (c.swap.prep !== undefined) {
      if (c.swap.prep) next.prep = c.swap.prep;
      else delete next.prep;
    }
    if (c.ratio !== 1) delete next.hint;
    return [next];
  });

  const temps = Object.assign({}, ...[...chosen.values()].map(c => c.swap.temps ?? {}));
  const noted = new Set();
  let extraMinutes = 0;
  const steps = base.steps.map(step => {
    const notes = [];
    let timer = step.timer;
    const uses = step.uses.flatMap(u => {
      const c = chosen.get(u.ing);
      if (!c) return [u];
      const from = ingredientsById.get(c.swap.from);
      const to = c.swap.to && ingredientsById.get(c.swap.to);
      const first = !noted.has(u.ing);
      noted.add(u.ing);
      if (!to) {
        notes.push(`Leave out the ${from.name}.`);
        return [];
      }
      notes.push(`Use ${to.name} in place of the ${from.name}.${first && c.swap.cooking ? ` ${c.swap.cooking}` : ""}`);
      if (c.swap.timer && timer) {
        extraMinutes += Math.max(0, c.swap.timer - timer.minutes);
        timer = { ...timer, minutes: c.swap.timer };
      }
      return [{ ...u, amount: u.amount * c.ratio }];
    });
    const text = step.text.replace(/\{temp:(\d+(?:\.\d+)?)\}/g, (m, t) => (temps[t] ? `{temp:${temps[t]}}` : m));
    const next = { ...step, text, uses };
    if (timer) next.timer = timer;
    if (notes.length) next.swapNotes = notes;
    return next;
  });

  const safetyMap = Object.assign({}, ...[...chosen.values()].map(c => c.swap.safety ?? {}));
  const safety = [...new Set(base.safety.map(k => safetyMap[k] ?? k))];
  const time = extraMinutes ? { ...base.time, cook: base.time.cook + extraMinutes, total: base.time.total + extraMinutes } : base.time;

  const recipe = { ...base, ingredients, steps, safety, time, swaps: valid, customized: true };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(sig, recipe);
  return recipe;
}

const perServing = r => recipeNutrition(r).perServing;

// Swap options for one line of the original recipe, for this cook. Options
// whose replacement clashes with an allergy or diet aren't offered at all.
export function swapsForLine(base, key, profile = {}, current = {}) {
  const line = base.ingredients.find(l => lineKey(l) === key);
  if (!line) return [];
  const others = Object.fromEntries(Object.entries(current).filter(([k]) => k !== key));
  const before = applySwaps(base, others);
  const beforeN = perServing(before);
  const beforeAllergens = allergensOf(before);
  const beforeDiets = dietsOf(before);
  return swaps
    .filter(s => s.from === line.ing && swapApplies(s, base))
    .filter(s => !s.to || itemConflicts(ingredientsById.get(s.to), profile).length === 0)
    .map(swap => {
      const after = applySwaps(base, { ...others, [key]: swap.id });
      const afterN = perServing(after);
      const afterAllergens = allergensOf(after);
      const afterDiets = dietsOf(after);
      return {
        swap,
        to: swap.to ? ingredientsById.get(swap.to) : null,
        amount: line.amount * swapRatio(swap),
        delta: Object.fromEntries(NUTRIENTS.map(n => [n, afterN[n] - beforeN[n]])),
        removes: beforeAllergens.filter(a => !afterAllergens.includes(a)),
        adds: afterAllergens.filter(a => !beforeAllergens.includes(a)),
        becomes: Object.keys(DIETS).filter(d => afterDiets[d] && !beforeDiets[d]),
        loses: Object.keys(DIETS).filter(d => beforeDiets[d] && !afterDiets[d]),
      };
    });
}

// Lines that have at least one swap, for showing a Swap button.
export function swappableKeys(base) {
  const keys = new Set();
  for (const l of base.ingredients) if (swaps.some(s => s.from === l.ing && swapApplies(s, base))) keys.add(lineKey(l));
  return keys;
}

// Swaps that would make a recipe fit the cook's allergies and diets, on top
// of any swaps already chosen, or null when something can't be swapped. Only
// a suggestion: the cook still chooses to apply them.
export function suggestFixes(base, profile = {}, current = {}) {
  const choices = cleanChoices(base, current);
  const fixes = {};
  for (const l of base.ingredients) {
    const k = lineKey(l);
    const chosen = choices[k] && swapsById.get(choices[k]);
    if (chosen && !chosen.to) continue;
    const item = ingredientsById.get(chosen ? chosen.to : l.ing);
    if (!itemConflicts(item, profile).length) continue;
    const options = swapsForLine(base, k, profile, { ...choices, ...fixes });
    if (!options.length) return null;
    fixes[k] = (options.find(o => o.to) ?? options[0]).swap.id;
  }
  return Object.keys(fixes).length ? fixes : null;
}

// Every recipe with the cook's saved swaps applied.
export function customizedRecipes(custom = {}) {
  return recipes.map(r => applySwaps(r, custom[r.id]));
}

export const baseRecipe = id => recipesById.get(id) ?? null;
