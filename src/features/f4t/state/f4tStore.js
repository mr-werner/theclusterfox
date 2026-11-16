// Everything Fuel 4 Thought remembers lives in one document. It is kept in
// this browser for everyone, and mirrored to the account when signed in.
//
// The diet planner adds: the body profile, weigh-ins, the meal plan (one
// entry per day), and workouts typed into the planner.

import { cleanProfile, emptyProfile } from "../model/body.js";
import { SLOTS } from "../model/planner.js";

export const STORAGE_KEY = "f4t-data-v2";
const DRAFT_KEY = "f4t-current-meal-v1";
const LEGACY_KEYS = {
  favorites: "f4t-favorites-v1",
  selections: "f4t-activity-selections-v2",
  meals: "f4t-saved-meals-v1",
};

export const MAX_RECENT_FOODS = 12;
export const MAX_WEIGHTS = 730;
const MAX_PLAN_DAYS = 120;
const MAX_TOMBSTONES = 200;

export function emptyData() {
  return {
    version: 2,
    weightLbs: null,
    weightUnit: "lbs",
    // null means "never chosen", so the starter favorites are shown.
    favorites: null,
    selections: {},
    meals: [],
    deletedMealIds: [],
    recentFoods: [],
    // Diet planner
    profile: emptyProfile(),
    // { day: "YYYY-MM-DD", lbs, at }
    weights: [],
    deletedWeights: [],
    // day -> { slots: { breakfast|lunch|dinner|snack: Entry }, updatedAt }
    // Entry: { recipeId, portions, leftover?, eaten?, off?: { name, kcal, protein?, items } }
    plan: {},
    // { id, day, preset, minutes, updatedAt }
    workouts: [],
    deletedWorkoutIds: [],
    planSeed: 1,
    updatedAt: null,
    // Which account this browser last synced with (null = signed out data).
    syncedUserId: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, min, max) => (Number.isFinite(v) && v >= min && v <= max ? v : null);

function cleanFood(f) {
  if (!isObject(f)) return null;
  const kcal = num(Number(f.caloriesPerServing), 0, 20000);
  return kcal === null ? null : { ...f, name: String(f.name ?? "").slice(0, 80) };
}

function cleanEntry(e) {
  if (!isObject(e)) return null;
  const off = isObject(e.off) && num(e.off.kcal, 0, 20000) !== null
    ? {
        name: String(e.off.name ?? "Something else").slice(0, 80),
        kcal: e.off.kcal,
        protein: num(e.off.protein, 0, 1000) ?? 0,
        items: Array.isArray(e.off.items) ? e.off.items.map(cleanFood).filter(Boolean).slice(0, 40) : [],
      }
    : null;
  const recipeId = typeof e.recipeId === "string" ? e.recipeId.slice(0, 80) : null;
  if (!recipeId && !off) return null;
  return {
    recipeId,
    portions: num(e.portions, 0.25, 12) ?? 1,
    ...(e.leftover === true && recipeId ? { leftover: true } : {}),
    ...(e.eaten === true ? { eaten: true } : {}),
    ...(off ? { off } : {}),
  };
}

function cleanPlan(plan) {
  const out = {};
  if (!isObject(plan)) return out;
  const days = Object.keys(plan).filter(isDay).sort().slice(-MAX_PLAN_DAYS);
  for (const day of days) {
    const d = plan[day];
    if (!isObject(d)) continue;
    const slots = {};
    for (const slot of SLOTS) {
      const e = cleanEntry(d.slots?.[slot.id]);
      if (e) slots[slot.id] = e;
    }
    out[day] = { slots, updatedAt: d.updatedAt ?? null };
  }
  return out;
}

const cleanWeight = w => (isObject(w) && isDay(w.day) && num(w.lbs, 40, 1000) ? { day: w.day, lbs: w.lbs, at: w.at ?? null } : null);
const cleanWorkout = w =>
  isObject(w) && w.id && isDay(w.day) && num(w.minutes, 1, 600)
    ? { id: String(w.id).slice(0, 40), day: w.day, preset: String(w.preset ?? "lift").slice(0, 20), minutes: Math.round(w.minutes), updatedAt: w.updatedAt ?? null }
    : null;
const tombstones = (list, key) => (Array.isArray(list) ? list.filter(t => isObject(t) && t[key]).slice(-MAX_TOMBSTONES) : []);

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

export function normalizeData(value) {
  const base = emptyData();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    weightLbs: Number(value.weightLbs) > 0 ? Number(value.weightLbs) : null,
    weightUnit: value.weightUnit === "kg" ? "kg" : "lbs",
    favorites: Array.isArray(value.favorites) ? value.favorites.filter(k => typeof k === "string") : null,
    selections: value.selections && typeof value.selections === "object" ? value.selections : {},
    meals: Array.isArray(value.meals) ? value.meals.filter(m => m && m.id && Array.isArray(m.items)) : [],
    deletedMealIds: Array.isArray(value.deletedMealIds) ? value.deletedMealIds : [],
    recentFoods: Array.isArray(value.recentFoods) ? value.recentFoods.slice(0, MAX_RECENT_FOODS) : [],
    profile: cleanProfile(value.profile),
    weights: Array.isArray(value.weights) ? value.weights.map(cleanWeight).filter(Boolean).sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_WEIGHTS) : [],
    deletedWeights: tombstones(value.deletedWeights, "day"),
    plan: cleanPlan(value.plan),
    workouts: Array.isArray(value.workouts) ? value.workouts.map(cleanWorkout).filter(Boolean).slice(-300) : [],
    deletedWorkoutIds: tombstones(value.deletedWorkoutIds, "id"),
    planSeed: Number.isInteger(value.planSeed) && value.planSeed > 0 ? value.planSeed : 1,
    updatedAt: value.updatedAt ?? null,
    syncedUserId: value.syncedUserId ?? null,
  };
}

// Pulls in favorites, adjustments, and meals saved by the previous version.
function migrateLegacy() {
  const data = emptyData();
  const favorites = readJson(LEGACY_KEYS.favorites, null);
  const selections = readJson(LEGACY_KEYS.selections, null);
  const meals = readJson(LEGACY_KEYS.meals, null);
  if (Array.isArray(favorites)) data.favorites = favorites;
  if (selections && typeof selections === "object") data.selections = selections;
  if (Array.isArray(meals)) data.meals = meals;
  return data;
}

export function loadData() {
  const stored = readJson(STORAGE_KEY, null);
  return normalizeData(stored ?? migrateLegacy());
}

export function saveData(data) {
  writeJson(STORAGE_KEY, data);
}

export function loadDraft() {
  const draft = readJson(DRAFT_KEY, []);
  return Array.isArray(draft) ? draft : [];
}

export function saveDraft(items) {
  writeJson(DRAFT_KEY, items);
}

const time = value => (value ? Date.parse(value) || 0 : 0);

// Combines this browser's data with the account copy. Meals merge one by one
// (newest edit wins, deletions stick); everything else follows the newer
// document. When signed-out data meets an account for the first time, the
// favorites and adjustments are combined instead so nothing is lost.
export function mergeData(local, remote, { combine = false } = {}) {
  const a = normalizeData(local);
  const b = normalizeData(remote);
  const newer = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  const older = newer === a ? b : a;

  const deleted = new Map();
  for (const entry of [...a.deletedMealIds, ...b.deletedMealIds]) {
    if (entry?.id && time(entry.at) >= time(deleted.get(entry.id)?.at)) deleted.set(entry.id, entry);
  }
  const meals = new Map();
  for (const meal of [...a.meals, ...b.meals]) {
    const current = meals.get(meal.id);
    if (!current || time(meal.updatedAt) > time(current.updatedAt)) meals.set(meal.id, meal);
  }
  for (const [id, entry] of deleted) {
    if (meals.has(id) && time(meals.get(id).updatedAt) <= time(entry.at)) meals.delete(id);
  }

  let favorites = newer.favorites ?? older.favorites;
  if (combine && (a.favorites || b.favorites)) {
    favorites = [...new Set([...(b.favorites ?? []), ...(a.favorites ?? [])])];
  }

  const recent = [];
  for (const food of [...newer.recentFoods, ...older.recentFoods]) {
    if (!recent.some(item => item.fdcId === food.fdcId && item.name === food.name)) recent.push(food);
  }

  // Weigh-ins: one per day, newest wins, deletions stick.
  const goneWeights = new Map();
  for (const t of [...a.deletedWeights, ...b.deletedWeights]) {
    if (time(t.at) >= time(goneWeights.get(t.day)?.at)) goneWeights.set(t.day, t);
  }
  const weights = new Map();
  for (const w of [...a.weights, ...b.weights]) {
    const cur = weights.get(w.day);
    if (!cur || time(w.at) > time(cur.at)) weights.set(w.day, w);
  }
  for (const [day, t] of goneWeights) if (weights.has(day) && time(weights.get(day).at) <= time(t.at)) weights.delete(day);

  // The plan merges day by day.
  const plan = { ...a.plan };
  for (const [day, d] of Object.entries(b.plan)) {
    if (!plan[day] || time(d.updatedAt) > time(plan[day].updatedAt)) plan[day] = d;
  }

  const goneWorkouts = new Map();
  for (const t of [...a.deletedWorkoutIds, ...b.deletedWorkoutIds]) {
    if (time(t.at) >= time(goneWorkouts.get(t.id)?.at)) goneWorkouts.set(t.id, t);
  }
  const workouts = new Map();
  for (const w of [...a.workouts, ...b.workouts]) {
    const cur = workouts.get(w.id);
    if (!cur || time(w.updatedAt) > time(cur.updatedAt)) workouts.set(w.id, w);
  }
  for (const [id, t] of goneWorkouts) if (workouts.has(id) && time(workouts.get(id).updatedAt) <= time(t.at)) workouts.delete(id);

  return {
    ...newer,
    weights: [...weights.values()].sort((x, y) => x.day.localeCompare(y.day)).slice(-MAX_WEIGHTS),
    deletedWeights: [...goneWeights.values()].slice(-MAX_TOMBSTONES),
    plan: cleanPlan(plan),
    workouts: [...workouts.values()],
    deletedWorkoutIds: [...goneWorkouts.values()].slice(-MAX_TOMBSTONES),
    weightLbs: newer.weightLbs ?? older.weightLbs,
    weightUnit: newer.weightLbs ? newer.weightUnit : older.weightUnit,
    favorites,
    selections: combine ? { ...older.selections, ...newer.selections } : newer.selections,
    meals: [...meals.values()].sort((x, y) => time(y.updatedAt) - time(x.updatedAt)),
    deletedMealIds: [...deleted.values()].slice(-200),
    recentFoods: recent.slice(0, MAX_RECENT_FOODS),
    updatedAt: [a.updatedAt, b.updatedAt].sort((x, y) => time(y) - time(x))[0] ?? null,
  };
}

// The account copy leaves out fields that only make sense in this browser.
export function toRemote(data) {
  // eslint-disable-next-line no-unused-vars
  const { syncedUserId, ...rest } = data;
  return rest;
}
