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

const normalize = s =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/(ies)$/, "y")
    .replace(/(oes|ses|shes|ches)$/, m => m.slice(0, -2))
    .replace(/([^s])s$/, "$1");

// Splits "spinach, chickpeas" into normalized terms.
export function parseTerms(text) {
  return String(text ?? "")
    .split(/[,;\n]/)
    .map(normalize)
    .filter(t => t.length > 1);
}

// Does an ingredient match a term? Matches the name, its words and aliases,
// so "chicken" catches chicken thighs and chicken broth alike.
export function ingredientMatches(item, term) {
  const t = normalize(term);
  if (!t) return false;
  const names = [item.name, item.plural, item.id.replace(/-/g, " "), ...(item.aliases ?? [])].filter(Boolean).map(s => s.toLowerCase());
  return names.some(n => n.includes(t) || n.split(/[\s,]+/).map(normalize).includes(t));
}

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
export function passesFilters(recipe, profile, filters) {
  const facts = factsOf(recipe);
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
function criteria(recipe, profile, filters) {
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
    ingredients: {
      score: have.length ? haveHits.length / have.length : 0,
      reason: haveHits.length ? `Uses your ${haveHits.slice(0, 3).join(", ")}` : null,
    },
    easy: {
      score: DIFFICULTY_RANK[recipe.difficulty] <= skill ? 1 : 0.3,
      reason: recipe.difficulty === "beginner" ? "Beginner-friendly" : null,
    },
  };
}

export const DEFAULT_PRIORITIES = ["taste", "time", "protein", "ingredients"];

// Ranks recipes by the cook's priorities. The first priority weighs most.
export function discover(recipes, profile = {}, filters = emptyFilters()) {
  const priorities = (profile.priorities?.length ? profile.priorities : DEFAULT_PRIORITIES).filter(p => PRIORITIES[p]);
  const hidden = { allergy: 0, diet: 0, excluded: 0 };
  const results = [];
  for (const recipe of recipes) {
    const block = hardBlock(recipe, profile, filters);
    if (block) {
      hidden[block] += 1;
      continue;
    }
    if (!passesFilters(recipe, profile, filters)) continue;
    const c = criteria(recipe, profile, filters);
    let score = 0;
    priorities.forEach((p, i) => {
      score += c[p].score * (priorities.length - i);
    });
    const reasons = priorities.map(p => c[p]).filter(x => x.reason && x.score >= 0.5).map(x => x.reason).slice(0, 3);
    results.push({ recipe, score, reasons });
  }
  results.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return { results, hidden };
}
