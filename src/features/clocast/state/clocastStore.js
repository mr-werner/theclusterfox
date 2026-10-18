// Everything CloCast remembers lives in one document. It is kept in this
// browser for everyone, and mirrored to the account when signed in.

export const STORAGE_KEY = "clocast-data-v1";
export const MAX_SAVED_PLACES = 8;

export function emptyData() {
  return {
    version: 1,
    units: "us",
    place: null,
    savedPlaces: [],
    activityId: "errands",
    hours: 2,
    profile: { heightCm: null, weightKg: null, ageYears: null, sex: null },
    tolerance: "normal",
    shaded: false,
    // Planned sessions: { id, activityId, title, day, startHour, hours, updatedAt }
    plans: [],
    deletedPlanIds: [],
    // Training goals: { id, activityId, perWeek, minutes, timeOfDay, updatedAt }
    goals: [],
    deletedGoalIds: [],
    updatedAt: null,
    // Which account this browser last synced with (null = signed out data).
    syncedUserId: null,
  };
}

function isPlace(value) {
  return Boolean(
    value && typeof value === "object" && typeof value.name === "string" &&
      Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
  );
}

function cleanPlace(place) {
  return {
    id: String(place.id ?? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`),
    name: place.name.slice(0, 80),
    region: typeof place.region === "string" ? place.region.slice(0, 80) : "",
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

const positive = value => (Number(value) > 0 ? Number(value) : null);
const MAX_TOMBSTONES = 200;

function cleanPlan(plan) {
  if (!plan || typeof plan !== "object" || !plan.id || typeof plan.activityId !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.day ?? "")) return null;
  const startHour = Math.round(Number(plan.startHour));
  if (!(startHour >= 0 && startHour <= 23)) return null;
  return {
    id: String(plan.id),
    activityId: plan.activityId,
    title: typeof plan.title === "string" ? plan.title.slice(0, 60) : "",
    day: plan.day,
    startHour,
    hours: [1, 2, 3, 4].includes(plan.hours) ? plan.hours : 1,
    updatedAt: plan.updatedAt ?? null,
  };
}

function cleanGoal(goal) {
  if (!goal || typeof goal !== "object" || !goal.id || typeof goal.activityId !== "string") return null;
  return {
    id: String(goal.id),
    activityId: goal.activityId,
    perWeek: Math.min(7, Math.max(1, Math.round(Number(goal.perWeek) || 3))),
    minutes: [30, 45, 60, 90, 120].includes(goal.minutes) ? goal.minutes : 60,
    timeOfDay: ["any", "morning", "midday", "evening"].includes(goal.timeOfDay) ? goal.timeOfDay : "any",
    updatedAt: goal.updatedAt ?? null,
  };
}

const cleanList = (list, clean) => (Array.isArray(list) ? list.map(clean).filter(Boolean) : []);
const cleanTombstones = list =>
  Array.isArray(list) ? list.filter(t => t && t.id).slice(-MAX_TOMBSTONES) : [];

export function normalizeData(value) {
  const base = emptyData();
  if (!value || typeof value !== "object") return base;
  const profile = value.profile && typeof value.profile === "object" ? value.profile : {};
  return {
    ...base,
    units: value.units === "metric" ? "metric" : "us",
    place: isPlace(value.place) ? cleanPlace(value.place) : null,
    savedPlaces: Array.isArray(value.savedPlaces)
      ? value.savedPlaces.filter(isPlace).map(cleanPlace).slice(0, MAX_SAVED_PLACES)
      : [],
    activityId: typeof value.activityId === "string" ? value.activityId : base.activityId,
    hours: [1, 2, 4, 8, 12].includes(value.hours) ? value.hours : base.hours,
    profile: {
      heightCm: positive(profile.heightCm),
      weightKg: positive(profile.weightKg),
      ageYears: positive(profile.ageYears),
      sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : null,
    },
    tolerance: ["cold", "warm"].includes(value.tolerance) ? value.tolerance : "normal",
    shaded: value.shaded === true,
    plans: cleanList(value.plans, cleanPlan),
    deletedPlanIds: cleanTombstones(value.deletedPlanIds),
    goals: cleanList(value.goals, cleanGoal),
    deletedGoalIds: cleanTombstones(value.deletedGoalIds),
    updatedAt: value.updatedAt ?? null,
    syncedUserId: value.syncedUserId ?? null,
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
    /* storage unavailable (private mode, quota) */
  }
}

const time = value => (value ? Date.parse(value) || 0 : 0);

// Plans and goals merge item by item (newest edit wins, deletions stick).
function mergeItems(listA, listB, tombA, tombB) {
  const deleted = new Map();
  for (const entry of [...tombA, ...tombB]) {
    if (time(entry.at) >= time(deleted.get(entry.id)?.at)) deleted.set(entry.id, entry);
  }
  const items = new Map();
  for (const item of [...listA, ...listB]) {
    const current = items.get(item.id);
    if (!current || time(item.updatedAt) > time(current.updatedAt)) items.set(item.id, item);
  }
  for (const [id, entry] of deleted) {
    if (items.has(id) && time(items.get(id).updatedAt) <= time(entry.at)) items.delete(id);
  }
  return { items: [...items.values()], tombstones: [...deleted.values()].slice(-MAX_TOMBSTONES) };
}

// Settings follow the newer document. When signed-out data meets an account
// for the first time (combine), saved places are pooled and blank body
// details are filled from the other copy so nothing typed in is lost.
export function mergeData(local, remote, { combine = false } = {}) {
  const a = normalizeData(local);
  const b = normalizeData(remote);
  const newer = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  const older = newer === a ? b : a;

  const plans = mergeItems(a.plans, b.plans, a.deletedPlanIds, b.deletedPlanIds);
  const goals = mergeItems(a.goals, b.goals, a.deletedGoalIds, b.deletedGoalIds);
  const merged = {
    ...newer,
    plans: plans.items.sort((x, y) => x.day.localeCompare(y.day) || x.startHour - y.startHour),
    deletedPlanIds: plans.tombstones,
    goals: goals.items,
    deletedGoalIds: goals.tombstones,
    updatedAt: [a.updatedAt, b.updatedAt].sort((x, y) => time(y) - time(x))[0] ?? null,
    syncedUserId: a.syncedUserId,
  };
  if (!combine) return merged;

  const places = [];
  for (const place of [...newer.savedPlaces, ...older.savedPlaces]) {
    if (!places.some(p => p.id === place.id)) places.push(place);
  }
  const profile = { ...newer.profile };
  for (const key of Object.keys(profile)) profile[key] = profile[key] ?? older.profile[key];

  return {
    ...merged,
    place: newer.place ?? older.place,
    savedPlaces: places.slice(0, MAX_SAVED_PLACES),
    profile,
  };
}

// The account copy leaves out fields that only make sense in this browser.
export function toRemote(data) {
  // eslint-disable-next-line no-unused-vars
  const { syncedUserId, ...rest } = data;
  return rest;
}
