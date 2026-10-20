// Everything LiftFox remembers lives in one document. It is kept in this
// browser, and mirrored to the account when signed in. Long-term plans are
// only made for signed-in people (see LiftPage).

export const STORAGE_KEY = "liftfox-data-v1";
export const MAX_HISTORY = 120;
const MAX_TOMBSTONES = 200;

export function emptyData() {
  return {
    version: 1,
    prefs: { muscles: [], goal: "size", minutes: 45, gear: [], level: 1 },
    // The workout being followed right now (see model/generate.js).
    current: null,
    // Finished workouts: { id, date, title, goal, minutes, muscles, setsDone, setsTotal, loads, planId, sessionId, updatedAt }
    history: [],
    deletedHistoryIds: [],
    // Long-term plans: { id, createdAt, updatedAt, program, completed: { sessionId: date } }
    plans: [],
    deletedPlanIds: [],
    activePlanId: null,
    updatedAt: null,
    syncedUserId: null,
  };
}

const GOALS = ["strength", "size", "stamina"];
const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === "string") : []);

function cleanPrefs(prefs) {
  const base = emptyData().prefs;
  if (!isObject(prefs)) return base;
  return {
    muscles: strings(prefs.muscles),
    goal: GOALS.includes(prefs.goal) ? prefs.goal : base.goal,
    minutes: Number.isFinite(prefs.minutes) && prefs.minutes >= 10 && prefs.minutes <= 120 ? prefs.minutes : base.minutes,
    gear: strings(prefs.gear),
    level: [1, 2, 3].includes(prefs.level) ? prefs.level : base.level,
  };
}

function cleanItem(item) {
  if (!isObject(item) || typeof item.exerciseId !== "string") return null;
  const sets = Math.min(8, Math.max(1, Math.round(Number(item.sets) || 3)));
  const done = Array.from({ length: sets }, (_, i) => Array.isArray(item.done) && item.done[i] === true);
  return {
    exerciseId: item.exerciseId,
    sets,
    reps: typeof item.reps === "string" ? item.reps.slice(0, 12) : null,
    seconds: Number.isFinite(item.seconds) ? item.seconds : null,
    restSec: Number.isFinite(item.restSec) ? item.restSec : 60,
    perSide: item.perSide === true,
    done,
    load: typeof item.load === "string" ? item.load.slice(0, 24) : "",
  };
}

function cleanCurrent(w) {
  if (!isObject(w) || !Array.isArray(w.items)) return null;
  return {
    ...w,
    id: String(w.id ?? "current"),
    title: typeof w.title === "string" ? w.title.slice(0, 80) : "Workout",
    items: w.items.map(cleanItem).filter(Boolean),
    warmup: strings(w.warmup),
    cooldown: strings(w.cooldown),
    warmupDone: w.warmupDone === true,
    cooldownDone: w.cooldownDone === true,
  };
}

function cleanHistory(entry) {
  if (!isObject(entry) || !entry.id || !/^\d{4}-\d{2}-\d{2}/.test(entry.date ?? "")) return null;
  return {
    id: String(entry.id),
    date: entry.date,
    title: typeof entry.title === "string" ? entry.title.slice(0, 80) : "Workout",
    goal: GOALS.includes(entry.goal) ? entry.goal : "size",
    minutes: Number(entry.minutes) || 0,
    muscles: strings(entry.muscles),
    setsDone: Number(entry.setsDone) || 0,
    setsTotal: Number(entry.setsTotal) || 0,
    loads: isObject(entry.loads) ? entry.loads : {},
    planId: entry.planId ?? null,
    sessionId: entry.sessionId ?? null,
    updatedAt: entry.updatedAt ?? null,
  };
}

function cleanPlan(plan) {
  if (!isObject(plan) || !plan.id || !isObject(plan.program) || !Array.isArray(plan.program.schedule)) return null;
  return {
    id: String(plan.id),
    createdAt: plan.createdAt ?? null,
    updatedAt: plan.updatedAt ?? null,
    program: plan.program,
    completed: isObject(plan.completed) ? plan.completed : {},
  };
}

const cleanList = (list, clean) => (Array.isArray(list) ? list.map(clean).filter(Boolean) : []);
const cleanTombstones = list => (Array.isArray(list) ? list.filter(t => t && t.id).slice(-MAX_TOMBSTONES) : []);

export function normalizeData(value) {
  const base = emptyData();
  if (!isObject(value)) return base;
  return {
    ...base,
    prefs: cleanPrefs(value.prefs),
    current: cleanCurrent(value.current),
    history: cleanList(value.history, cleanHistory).slice(0, MAX_HISTORY),
    deletedHistoryIds: cleanTombstones(value.deletedHistoryIds),
    plans: cleanList(value.plans, cleanPlan),
    deletedPlanIds: cleanTombstones(value.deletedPlanIds),
    activePlanId: typeof value.activePlanId === "string" ? value.activePlanId : null,
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

// Item by item: newest edit wins, deletions stick.
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

// Plans pool their completed sessions so a session ticked on either device counts.
function mergePlans(a, b) {
  const merged = mergeItems(a.plans, b.plans, a.deletedPlanIds, b.deletedPlanIds);
  merged.items = merged.items.map(plan => {
    const other = [...a.plans, ...b.plans].filter(p => p.id === plan.id);
    const completed = Object.assign({}, ...other.map(p => p.completed), plan.completed);
    return { ...plan, completed };
  });
  return merged;
}

export function mergeData(local, remote) {
  const a = normalizeData(local);
  const b = normalizeData(remote);
  const newer = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  const history = mergeItems(a.history, b.history, a.deletedHistoryIds, b.deletedHistoryIds);
  const plans = mergePlans(a, b);
  return {
    ...newer,
    history: history.items.sort((x, y) => y.date.localeCompare(x.date)).slice(0, MAX_HISTORY),
    deletedHistoryIds: history.tombstones,
    plans: plans.items.sort((x, y) => time(y.createdAt) - time(x.createdAt)),
    deletedPlanIds: plans.tombstones,
    activePlanId: plans.items.some(p => p.id === newer.activePlanId) ? newer.activePlanId : plans.items[0]?.id ?? null,
    updatedAt: [a.updatedAt, b.updatedAt].sort((x, y) => time(y) - time(x))[0] ?? null,
    syncedUserId: a.syncedUserId,
  };
}

// The account copy leaves out fields that only make sense in this browser.
export function toRemote(data) {
  // eslint-disable-next-line no-unused-vars
  const { syncedUserId, ...rest } = data;
  return rest;
}
