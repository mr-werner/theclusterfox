// Pantry and shopping list. Both are optional: nothing else in CookFox needs them.
//
// Pantry items are either catalog ingredients (matched exactly by id) or
// custom names (matched against the catalog by name and aliases). We track
// what you have, an optional use-by date and a "running low" flag; exact
// quantities are left out on purpose, since nobody weighs their flour bin.
//
// Shopping items for catalog ingredients keep their amount in the
// ingredient's canonical unit, one per ingredient, so combining two recipes'
// onions is plain addition, never a guess across units. Each item remembers
// which recipe contributed what, so re-adding a recipe replaces its share
// instead of doubling it.
import { ingredients, ingredientsById } from "../data/ingredients.js";
import { ingredientMatches, normalize } from "./match.js";
import { scaledLines } from "./recipe.js";

export const SOON_DAYS = 3;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function toIsoDay(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayNumber = iso => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

// Finds the catalog ingredient a typed name refers to, if any.
export function findIngredient(name) {
  const t = String(name ?? "").trim().toLowerCase();
  if (!t) return null;
  const exact = ingredients.find(i => i.name.toLowerCase() === t || i.plural?.toLowerCase() === t || i.id === t.replace(/\s+/g, "-"));
  if (exact) return exact;
  const matches = ingredients.filter(i => ingredientMatches(i, t));
  // A full alias match beats a partial one ("eggs" is the egg, not the flax egg).
  const nt = normalize(t);
  const whole = matches.filter(i => [i.name, i.plural, ...(i.aliases ?? [])].some(n => n && normalize(n) === nt));
  if (whole.length === 1) return whole[0];
  // Only accept a fuzzy match when it's unambiguous ("oil" matches three oils).
  return matches.length === 1 ? matches[0] : null;
}

export function pantryItemName(item) {
  return item.ing ? ingredientsById.get(item.ing).name : item.name;
}

export function makePantryItem(name, { expires = null, today = toIsoDay(Date.now()) } = {}) {
  const ing = findIngredient(name);
  return {
    id: newId(),
    ing: ing?.id ?? null,
    name: ing ? null : String(name).trim().slice(0, 60),
    expires: expires || null,
    low: false,
    added: today,
  };
}

// Adds an item unless it's already there (then updates its date if given).
export function addToPantry(pantry, item) {
  const same = pantry.find(p => (item.ing ? p.ing === item.ing : !p.ing && p.name.toLowerCase() === item.name.toLowerCase()));
  if (same) return pantry.map(p => (p === same ? { ...p, expires: item.expires ?? p.expires, low: false } : p));
  return [item, ...pantry];
}

// The pantry item that covers an ingredient, if any.
export function pantryMatch(pantry, ingId) {
  const ing = ingredientsById.get(ingId);
  return pantry.find(p => (p.ing ? p.ing === ingId : ingredientMatches(ing, p.name))) ?? null;
}

export function expiryState(item, today) {
  if (!item.expires) return null;
  const days = dayNumber(item.expires) - dayNumber(today);
  if (days < 0) return { state: "expired", days };
  if (days <= SOON_DAYS) return { state: "soon", days };
  return { state: "ok", days };
}

export function expiryText(item, today) {
  const e = expiryState(item, today);
  if (!e) return null;
  if (e.state === "expired") return e.days === -1 ? "Expired yesterday" : `Expired ${-e.days} days ago`;
  if (e.days === 0) return "Use today";
  if (e.days === 1) return "Use by tomorrow";
  return e.state === "soon" ? `Use within ${e.days} days` : `Good until ${new Date(`${item.expires}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// How a recipe lines up with the pantry: what's covered, what's missing, and
// which soon-to-expire items it would use up.
export function recipePantry(recipe, pantry, today) {
  const have = [];
  const missing = [];
  const useSoon = [];
  const seen = new Set();
  for (const l of recipe.ingredients) {
    const key = l.key ?? l.ing;
    const item = pantryMatch(pantry, l.ing);
    if (item) {
      have.push(key);
      const e = expiryState(item, today);
      if (e && e.state !== "ok" && !seen.has(l.ing)) {
        seen.add(l.ing);
        useSoon.push(ingredientsById.get(l.ing).name);
      }
    } else if (!missing.some(k => k.ing === l.ing)) {
      missing.push({ key, ing: l.ing });
    }
  }
  return { have, missing, useSoon, total: new Set(recipe.ingredients.map(l => l.ing)).size };
}

// --- Shopping list ---------------------------------------------------------

export function shoppingAmount(item) {
  return (item.sources ?? []).reduce((sum, s) => sum + s.amount, 0) + (item.extra ?? 0);
}

// Adds a recipe's ingredients (at the given servings) to the list. With
// `skip`, ingredients already in the pantry are left off.
export function addRecipeToList(list, recipe, servings, { pantry = [], onlyMissing = true } = {}) {
  let next = list.map(i => ({ ...i, sources: (i.sources ?? []).filter(s => s.recipeId !== recipe.id) }));
  const totals = new Map();
  for (const l of scaledLines(recipe, servings)) {
    if (onlyMissing && pantryMatch(pantry, l.ing)) continue;
    totals.set(l.ing, (totals.get(l.ing) ?? 0) + l.amount);
  }
  for (const [ing, amount] of totals) {
    const existing = next.find(i => i.ing === ing);
    const source = { recipeId: recipe.id, amount };
    if (existing) {
      next = next.map(i => (i === existing ? { ...i, sources: [...i.sources, source], checked: false } : i));
    } else {
      next.push({ id: newId(), ing, name: null, sources: [source], extra: 0, checked: false });
    }
  }
  return pruneList(next);
}

// Adds one ingredient line of a recipe to the list, for "I don't have this".
// The amount counts as that recipe's share, so adding the whole recipe later
// replaces it instead of doubling it.
export function addLineToList(list, recipe, servings, key) {
  const line = scaledLines(recipe, servings).find(l => l.key === key);
  if (!line) return list;
  const existing = list.find(i => i.ing === line.ing);
  if (existing) {
    const others = existing.sources.filter(s => s.recipeId !== recipe.id);
    const mine = existing.sources.find(s => s.recipeId === recipe.id);
    const source = { recipeId: recipe.id, amount: Math.max(mine?.amount ?? 0, line.amount) };
    return list.map(i => (i === existing ? { ...i, sources: [...others, source], checked: false } : i));
  }
  return [...list, { id: newId(), ing: line.ing, name: null, sources: [{ recipeId: recipe.id, amount: line.amount }], extra: 0, checked: false }];
}

// Drops catalog items no recipe or manual amount needs anymore.
function pruneList(list) {
  return list.filter(i => !i.ing || i.manual || shoppingAmount(i) > 1e-9);
}

export function removeRecipeFromList(list, recipeId) {
  return pruneList(list.map(i => ({ ...i, sources: (i.sources ?? []).filter(s => s.recipeId !== recipeId) })));
}

export function listRecipes(list) {
  return [...new Set(list.flatMap(i => (i.sources ?? []).map(s => s.recipeId)))];
}

export function addManualItem(list, name) {
  const ing = findIngredient(name);
  if (ing) {
    if (list.some(i => i.ing === ing.id)) return list.map(i => (i.ing === ing.id ? { ...i, checked: false, manual: true } : i));
    return [...list, { id: newId(), ing: ing.id, name: null, sources: [], extra: 0, manual: true, checked: false }];
  }
  const clean = String(name).trim().slice(0, 60);
  if (!clean || list.some(i => !i.ing && i.name.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, { id: newId(), ing: null, name: clean, sources: [], extra: 0, checked: false }];
}

// Changes a catalog item's amount by a factor (e.g. 1.25 or 0.8), applied as
// an extra on top of what the recipes need.
export function adjustItem(list, id, factor) {
  return list.map(i => {
    if (i.id !== id || !i.ing) return i;
    const current = shoppingAmount(i);
    const target = Math.max(0, current * factor);
    return { ...i, extra: (i.extra ?? 0) + (target - current) };
  });
}

export const toggleItem = (list, id) => list.map(i => (i.id === id ? { ...i, checked: !i.checked } : i));
export const removeItem = (list, id) => list.filter(i => i.id !== id);
export const clearChecked = list => list.filter(i => !i.checked);

// Bought it? It's in the pantry now.
export function checkedToPantry(list, pantry, today) {
  let next = pantry;
  for (const i of list.filter(x => x.checked)) {
    next = addToPantry(next, { id: newId(), ing: i.ing, name: i.ing ? null : i.name, expires: null, low: false, added: today });
  }
  return { list: clearChecked(list), pantry: next };
}

export function itemAisle(item) {
  return item.ing ? ingredientsById.get(item.ing).aisle : "other";
}

export function groupByAisle(items, aisleNames) {
  const groups = new Map();
  for (const i of items) {
    const a = itemAisle(i);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(i);
  }
  const order = [...Object.keys(aisleNames), "other"];
  return [...groups].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
}

// A few staples most kitchens have, offered as a one-tap start.
export const STAPLES = ["salt", "black-pepper", "olive-oil", "neutral-oil", "flour", "sugar", "brown-sugar", "baking-powder", "baking-soda", "vanilla", "cumin", "smoked-paprika", "oregano", "chili-powder", "garlic", "onion", "butter", "egg", "milk", "rice"];
