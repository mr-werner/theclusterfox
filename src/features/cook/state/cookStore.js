// Everything CookFox remembers lives in this browser: preferences, favorites,
// cooking sessions in progress and cooking history. No account needed.
import { recipesById } from "../data/recipes.js";
import { ALLERGENS, ingredientsById } from "../data/ingredients.js";
import { TASTES, EQUIPMENT, DIFFICULTY } from "../data/recipes.js";
import { DIETS } from "../model/recipe.js";
import { PRIORITIES, DEFAULT_PRIORITIES } from "../model/discover.js";
import { normalizeSession } from "../model/session.js";
import { cleanChoices } from "../model/swaps.js";

export const STORAGE_KEY = "cookfox-data-v1";
export const MAX_HISTORY = 200;

export function emptyData() {
  return {
    version: 1,
    prefs: {
      measure: "volume", // volume | weight
      temp: "F", // F | C
      theme: "light", // light | dark
      textSize: 1, // 0..2, for cooking mode
      keepAwake: true,
    },
    profile: {
      allergies: [],
      diets: [],
      dislikes: "",
      flavors: [],
      cuisines: [],
      skill: "beginner",
      equipment: null, // null means "don't filter by equipment"
      household: 2,
      minProtein: 0,
      maxCalories: 0,
      priorities: [...DEFAULT_PRIORITIES],
    },
    favorites: [],
    // recipeId -> session (see model/session.js)
    sessions: {},
    // { id, recipeId, title, date, servings, minutes, status: "cooked"|"stopped", rating, again, timing, note }
    history: [],
    // { id, ing | null, name | null, expires (YYYY-MM-DD) | null, low, added }
    pantry: [],
    // { id, ing | null, name | null, sources: [{ recipeId, amount }], extra, manual?, checked }
    shopping: [],
    // recipeId -> { lineKey: swapId }, the cook's saved version of a recipe
    custom: {},
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const pick = (list, valid) => (Array.isArray(list) ? [...new Set(list.filter(x => valid.includes(x)))] : []);
const num = (v, min, max, fallback) => (Number.isFinite(v) && v >= min && v <= max ? v : fallback);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

function cleanPrefs(p) {
  const base = emptyData().prefs;
  if (!isObject(p)) return base;
  return {
    measure: p.measure === "weight" ? "weight" : "volume",
    temp: p.temp === "C" ? "C" : "F",
    theme: p.theme === "dark" ? "dark" : "light",
    textSize: num(p.textSize, 0, 2, base.textSize),
    keepAwake: p.keepAwake !== false,
  };
}

function cleanProfile(p) {
  const base = emptyData().profile;
  if (!isObject(p)) return base;
  const priorities = pick(p.priorities, Object.keys(PRIORITIES));
  return {
    allergies: pick(p.allergies, Object.keys(ALLERGENS)),
    diets: pick(p.diets, Object.keys(DIETS)),
    dislikes: str(p.dislikes, 300),
    flavors: pick(p.flavors, Object.keys(TASTES)),
    cuisines: Array.isArray(p.cuisines) ? p.cuisines.filter(c => typeof c === "string").map(c => c.slice(0, 40)).slice(0, 20) : [],
    skill: Object.keys(DIFFICULTY).includes(p.skill) ? p.skill : base.skill,
    equipment: Array.isArray(p.equipment) ? pick(p.equipment, Object.keys(EQUIPMENT)) : null,
    household: num(p.household, 1, 20, base.household),
    minProtein: num(p.minProtein, 0, 150, 0),
    maxCalories: num(p.maxCalories, 0, 3000, 0),
    priorities: priorities.length ? priorities : base.priorities,
  };
}

function cleanHistory(e) {
  if (!isObject(e) || !e.id || !recipesById.has(e.recipeId)) return null;
  return {
    id: String(e.id).slice(0, 40),
    recipeId: e.recipeId,
    title: str(e.title, 80) || recipesById.get(e.recipeId).title,
    date: typeof e.date === "string" ? e.date.slice(0, 30) : new Date().toISOString(),
    servings: num(e.servings, 1, 48, recipesById.get(e.recipeId).servings),
    minutes: num(e.minutes, 0, 2000, 0),
    status: e.status === "stopped" ? "stopped" : "cooked",
    rating: ["loved", "good", "meh"].includes(e.rating) ? e.rating : null,
    again: typeof e.again === "boolean" ? e.again : null,
    timing: ["faster", "right", "slower"].includes(e.timing) ? e.timing : null,
    note: str(e.note, 500),
    swaps: cleanChoices(recipesById.get(e.recipeId), e.swaps),
  };
}

const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function cleanCustom(c) {
  const out = {};
  if (!isObject(c)) return out;
  for (const [id, choices] of Object.entries(c)) {
    if (!recipesById.has(id)) continue;
    const clean = cleanChoices(recipesById.get(id), choices);
    if (Object.keys(clean).length) out[id] = clean;
  }
  return out;
}

function cleanPantryItem(p) {
  if (!isObject(p) || !p.id) return null;
  const ing = ingredientsById.has(p.ing) ? p.ing : null;
  const name = ing ? null : str(p.name, 60).trim();
  if (!ing && !name) return null;
  return { id: String(p.id).slice(0, 40), ing, name, expires: isDay(p.expires) ? p.expires : null, low: p.low === true, added: isDay(p.added) ? p.added : null };
}

function cleanShoppingItem(i) {
  if (!isObject(i) || !i.id) return null;
  const ing = ingredientsById.has(i.ing) ? i.ing : null;
  const name = ing ? null : str(i.name, 60).trim();
  if (!ing && !name) return null;
  const sources = ing && Array.isArray(i.sources)
    ? i.sources.filter(s => isObject(s) && recipesById.has(s.recipeId) && Number.isFinite(s.amount) && s.amount > 0).map(s => ({ recipeId: s.recipeId, amount: s.amount }))
    : [];
  return { id: String(i.id).slice(0, 40), ing, name, sources, extra: ing && Number.isFinite(i.extra) ? i.extra : 0, manual: i.manual === true, checked: i.checked === true };
}

export function normalizeData(value) {
  const base = emptyData();
  if (!isObject(value)) return base;
  const sessions = {};
  if (isObject(value.sessions)) {
    for (const [id, raw] of Object.entries(value.sessions)) {
      const s = normalizeSession(raw, recipesById.get(id));
      if (s) sessions[id] = s;
    }
  }
  return {
    ...base,
    prefs: cleanPrefs(value.prefs),
    profile: cleanProfile(value.profile),
    favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(id => recipesById.has(id)))] : [],
    sessions,
    history: Array.isArray(value.history) ? value.history.map(cleanHistory).filter(Boolean).slice(0, MAX_HISTORY) : [],
    pantry: Array.isArray(value.pantry) ? value.pantry.map(cleanPantryItem).filter(Boolean).slice(0, 500) : [],
    shopping: Array.isArray(value.shopping) ? value.shopping.map(cleanShoppingItem).filter(Boolean).slice(0, 300) : [],
    custom: cleanCustom(value.custom),
  };
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw === null ? null : JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private windows); the app still works without it.
  }
}
