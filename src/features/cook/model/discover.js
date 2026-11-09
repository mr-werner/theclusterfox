// Discovery: hard filters first, then a transparent, deterministic ranking
// with plain-language reasons. Allergies, disliked ingredients, exclusions and
// required diets are hard limits. They hide recipes; they're never traded
// off against taste or speed.
import { ingredientsById } from "../data/ingredients.js";
import { allergensOf, dietsOf, ingredientIds, recipeNutrition } from "./recipe.js";

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

export const PRIORITIES = {
  taste: "Flavors I love",
  protein: "More protein",
  time: "Quick to make",
  calories: "Lighter meals",
  ingredients: "Uses what I have",
  easy: "Easy to cook",
};

import { ingredientMatches, parseTerms } from "./match.js";
import { recipePantry } from "./pantry.js";

export { ingredientMatches, parseTerms };

export const recipeHasTerm = (recipe, term) => ingredientIds(recipe).some(id => ingredientMatches(ingredientsById.get(id), term));

// Precomputed facts per recipe, so filtering stays cheap.
const factsCache = new Map();
export function factsOf(recipe) {
  if (!factsCache.has(recipe.id)) {
    factsCache.set(recipe.id, {
      allergens: allergensOf(recipe),
      diets: dietsOf(recipe),
      nutrition: recipeNutrition(recipe).perServing,
    });
  }
  return factsCache.get(recipe.id);
}

export function emptyFilters() {
  return {
    q: "",
    maxTime: 0,
    meal: "",
    diets: [],
    tastes: [],
    tags: [],
    maxDifficulty: "",
    minProtein: 0,
    maxCalories: 0,
    have: "",
    exclude: "",
    maxMissing: -1, // -1 any; 0 "have everything"; 2 "missing 2 or fewer" (needs a pantry)
    useSoon: false, // only recipes that use pantry items close to their use-by date
  };
}

// Why a recipe is hidden, or null if it passes the hard limits.
export function hardBlock(recipe, profile, filters) {
  const facts = factsOf(recipe);
  const allergy = (profile.allergies ?? []).find(a => facts.allergens.includes(a));
  if (allergy) return "allergy";
  const diets = new Set([...(profile.diets ?? []), ...(filters.diets ?? [])]);
  for (const d of diets) if (!facts.diets[d]) return "diet";
  const avoid = [...parseTerms(profile.dislikes), ...parseTerms(filters.exclude)];
  if (avoid.some(t => recipeHasTerm(recipe, t))) return "excluded";
  return null;
}

// Softer filters the cook picked on the Discover screen.
export function passesFilters(recipe, profile, filters, pantryInfo) {
  const facts = factsOf(recipe);
  if (pantryInfo && filters.maxMissing >= 0 && pantryInfo.missing.length > filters.maxMissing) return false;
  if (filters.useSoon && !pantryInfo?.useSoon.length) return false;
  if (filters.q) {
    const q = filters.q.toLowerCase().trim();
    const hay = [recipe.title, recipe.description, recipe.cuisine, ...recipe.tastes].join(" ").toLowerCase();
    if (!hay.includes(q) && !recipeHasTerm(recipe, q)) return false;
  }
  if (filters.maxTime && recipe.time.total > filters.maxTime) return false;
  if (filters.meal && !recipe.meals.includes(filters.meal)) return false;
  if (filters.tastes?.length && !filters.tastes.some(t => recipe.tastes.includes(t))) return false;
  if (filters.tags?.length && !filters.tags.every(t => recipe.tags.includes(t))) return false;
  if (filters.maxDifficulty && DIFFICULTY_RANK[recipe.difficulty] > DIFFICULTY_RANK[filters.maxDifficulty]) return false;
  if (filters.minProtein && facts.nutrition.protein < filters.minProtein) return false;
  if (filters.maxCalories && facts.nutrition.kcal > filters.maxCalories) return false;
  const owned = profile.equipment;
  if (Array.isArray(owned) && recipe.equipment.some(e => !owned.includes(e))) return false;
  return true;
}

// Each criterion scores 0 to 1 and can give a reason.
function criteria(recipe, profile, filters, pantryInfo) {
  const facts = factsOf(recipe);
  const n = facts.nutrition;
  const liked = new Set([...(profile.flavors ?? []), ...(filters.tastes ?? [])]);
  const tasteHits = recipe.tastes.filter(t => liked.has(t));
  const cuisineHit = (profile.cuisines ?? []).some(c => recipe.cuisine.toLowerCase().includes(c.toLowerCase()));
  const have = parseTerms(filters.have);
  const haveHits = have.filter(t => recipeHasTerm(recipe, t));
  const minProtein = filters.minProtein || profile.minProtein || 30;
  const maxCalories = filters.maxCalories || profile.maxCalories || 600;
  const skill = DIFFICULTY_RANK[profile.skill] ?? 0;

  return {
    taste: {
      score: liked.size ? Math.min(1, tasteHits.length / Math.min(2, liked.size)) * 0.85 + (cuisineHit ? 0.15 : 0) : cuisineHit ? 0.5 : 0,
      reason: tasteHits.length
        ? `${tasteHits.length > 1 ? "Hits" : "Matches"} your love of ${tasteHits.slice(0, 2).map(t => t.replace("comfort", "comfort food")).join(" and ")}`
        : cuisineHit
          ? `${recipe.cuisine}, a cuisine you like`
          : null,
    },
    protein: {
      score: Math.min(1, n.protein / Math.max(minProtein, 1)),
      reason: n.protein >= 25 || n.protein >= minProtein ? `${Math.round(n.protein)} g protein per serving` : null,
    },
    time: {
      score: Math.max(0, 1 - recipe.time.total / 90),
      reason: recipe.time.total <= 30 ? `Ready in ${recipe.time.total} minutes` : recipe.time.active <= 15 ? `Only ${recipe.time.active} minutes hands-on` : null,
    },
    calories: {
      score: n.kcal <= maxCalories ? 1 - (n.kcal / maxCalories) * 0.5 : Math.max(0, 1 - (n.kcal - maxCalories) / maxCalories),
      reason: n.kcal <= Math.min(maxCalories, 500) ? `About ${Math.round(n.kcal / 10) * 10} calories a serving` : null,
    },
    ingredients: ingredientsCriterion(have, haveHits, pantryInfo),
    easy: {
      score: DIFFICULTY_RANK[recipe.difficulty] <= skill ? 1 : 0.3,
      reason: recipe.difficulty === "beginner" ? "Beginner-friendly" : null,
    },
  };
}

// "Uses what I have": typed ingredients, the pantry, and use-soon items.
function ingredientsCriterion(have, haveHits, p) {
  const typed = have.length ? haveHits.length / have.length : 0;
  if (!p) return { score: typed, reason: haveHits.length ? `Uses your ${haveHits.slice(0, 3).join(", ")}` : null };
  const covered = p.total ? (p.total - p.missing.length) / p.total : 0;
  const score = Math.min(1, Math.max(typed, covered) + (p.useSoon.length ? 0.25 : 0));
  const n = p.missing.length;
  const reason = p.useSoon.length
    ? `Uses your ${p.useSoon.slice(0, 2).join(" and ")} before ${p.useSoon.length > 1 ? "they expire" : "it expires"}`
    : haveHits.length
      ? `Uses your ${haveHits.slice(0, 3).join(", ")}`
      : n === 0
        ? "You have everything"
        : n <= 2
          ? `Only ${n} missing ingredient${n > 1 ? "s" : ""}`
          : null;
  return { score: p.useSoon.length || haveHits.length || n <= 2 ? Math.max(score, 0.5) : score, reason };
}

export const DEFAULT_PRIORITIES = ["taste", "time", "protein", "ingredients"];

// Ranks recipes by the cook's priorities. The first priority weighs most.
// context.pantry (optional) makes ranking and filters pantry-aware.
export function discover(recipes, profile = {}, filters = emptyFilters(), context = {}) {
  const usePantry = Array.isArray(context.pantry) && context.pantry.length > 0;
  const priorities = (profile.priorities?.length ? profile.priorities : DEFAULT_PRIORITIES).filter(p => PRIORITIES[p]);
  const hidden = { allergy: 0, diet: 0, excluded: 0 };
  const results = [];
  for (const recipe of recipes) {
    const block = hardBlock(recipe, profile, filters);
    if (block) {
      hidden[block] += 1;
      continue;
    }
    const pantryInfo = usePantry ? recipePantry(recipe, context.pantry, context.today) : null;
    if (!passesFilters(recipe, profile, filters, pantryInfo)) continue;
    const c = criteria(recipe, profile, filters, pantryInfo);
    let score = 0;
    priorities.forEach((p, i) => {
      score += c[p].score * (priorities.length - i);
    });
    const reasons = priorities.map(p => c[p]).filter(x => x.reason && x.score >= 0.5).map(x => x.reason).slice(0, 3);
    results.push({ recipe, score, reasons, pantry: pantryInfo });
  }
  results.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return { results, hidden };
}
