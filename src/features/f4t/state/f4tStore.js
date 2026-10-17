// Everything Fuel 4 Thought remembers lives in one document. It is kept in
// this browser for everyone, and mirrored to the account when signed in.

export const STORAGE_KEY = "f4t-data-v2";
const DRAFT_KEY = "f4t-current-meal-v1";
const LEGACY_KEYS = {
  favorites: "f4t-favorites-v1",
  selections: "f4t-activity-selections-v2",
  meals: "f4t-saved-meals-v1",
};

export const MAX_RECENT_FOODS = 12;

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
    updatedAt: null,
    // Which account this browser last synced with (null = signed out data).
    syncedUserId: null,
  };
}

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

  return {
    ...newer,
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
