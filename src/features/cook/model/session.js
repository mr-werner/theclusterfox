// Cooking sessions: everything needed to pick up exactly where you left off.
// Sessions are plain JSON, saved to the browser after every change.
//
// Three separate ingredient states, never mixed up:
//   have    you have it in the kitchen (prep checklist)
//   prepped it's measured, chopped and ready (prep checklist)
//   used    it went into the food, tracked per step, so butter used in step 2
//           and step 5 is two separate checkmarks
//
// Timers store a deadline (endsAt), not a countdown, so a refresh or a closed
// tab doesn't restart them. Paused timers store the seconds left.
import { linesByKey, lineKey, scaleFactor, clampServings } from "./recipe.js";

export const usedKey = (step, key) => `${step}:${key}`;
export const taskKey = (step, task) => `${step}:${task}`;

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));

// `have` can pre-check ingredients (e.g. from the pantry).
export function newSession(recipe, servings, now = Date.now(), have = []) {
  return {
    recipeId: recipe.id,
    servings: clampServings(servings),
    startedAt: new Date(now).toISOString(),
    updatedAt: now,
    phase: "prep", // prep | cooking
    step: 0,
    doneSteps: [],
    have: Object.fromEntries(have.map(k => [k, true])),
    prepped: {},
    used: {},
    tasks: {},
    timers: [],
  };
}

const touch = (s, now = Date.now()) => ({ ...s, updatedAt: now });

function toggleIn(s, field, key, value) {
  const next = { ...s[field] };
  const on = value ?? !next[key];
  if (on) next[key] = true;
  else delete next[key];
  return touch({ ...s, [field]: next });
}

export const toggleHave = (s, key, value) => toggleIn(s, "have", key, value);
export const togglePrepped = (s, key, value) => {
  // Something you've prepped is something you have.
  const next = toggleIn(s, "prepped", key, value);
  return next.prepped[key] ? toggleIn(next, "have", key, true) : next;
};
export const toggleUsed = (s, step, key, value) => toggleIn(s, "used", usedKey(step, key), value);
export const toggleTask = (s, step, task, value) => toggleIn(s, "tasks", taskKey(step, task), value);

export function setAllHave(s, recipe, value) {
  const have = value ? Object.fromEntries(recipe.ingredients.map(l => [lineKey(l), true])) : {};
  return touch({ ...s, have, prepped: value ? s.prepped : {} });
}

export const setServings = (s, n) => touch({ ...s, servings: clampServings(n) });
export const startCooking = s => touch({ ...s, phase: "cooking" });

export function goToStep(s, recipe, step) {
  return touch({ ...s, step: Math.max(0, Math.min(recipe.steps.length - 1, step)) });
}

export function toggleStepDone(s, step, value) {
  const done = new Set(s.doneSteps);
  const on = value ?? !done.has(step);
  if (on) done.add(step);
  else done.delete(step);
  return touch({ ...s, doneSteps: [...done].sort((a, b) => a - b) });
}

// Finishing a step checks it off and moves on, but leaves its individual
// checkboxes alone, so you can always see what you actually ticked.
export function completeStep(s, recipe, step) {
  return goToStep(toggleStepDone(s, step, true), recipe, step + 1);
}

// --- Timers ---------------------------------------------------------------

export function timerFor(s, step) {
  return s.timers.find(t => t.step === step) ?? null;
}

export function startTimer(s, step, label, seconds, now = Date.now()) {
  const existing = timerFor(s, step);
  if (existing?.endsAt) return s; // already running
  const remaining = existing && existing.remaining > 0 ? existing.remaining : seconds;
  const timer = { step, label, seconds, endsAt: now + remaining * 1000, remaining: null, rung: false };
  return touch({ ...s, timers: [...s.timers.filter(t => t.step !== step), timer] }, now);
}

export function pauseTimer(s, step, now = Date.now()) {
  return touch(
    {
      ...s,
      timers: s.timers.map(t =>
        t.step === step && t.endsAt ? { ...t, endsAt: null, remaining: Math.max(0, Math.ceil((t.endsAt - now) / 1000)) } : t
      ),
    },
    now
  );
}

export function addTime(s, step, seconds, now = Date.now()) {
  return touch(
    {
      ...s,
      timers: s.timers.map(t => {
        if (t.step !== step) return t;
        if (t.endsAt) return { ...t, endsAt: Math.max(t.endsAt, now) + seconds * 1000, rung: false };
        return { ...t, remaining: (t.remaining ?? 0) + seconds, rung: false };
      }),
    },
    now
  );
}

export const clearTimer = (s, step) => touch({ ...s, timers: s.timers.filter(t => t.step !== step) });
export const markRung = (s, step) => ({ ...s, timers: s.timers.map(t => (t.step === step ? { ...t, rung: true } : t)) });

// Seconds left and whether the timer is running or done, at time `now`.
export function timerState(t, now = Date.now()) {
  if (!t) return null;
  if (t.endsAt) {
    const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
    return { left, running: left > 0, finished: left === 0, paused: false };
  }
  return { left: t.remaining ?? t.seconds, running: false, finished: (t.remaining ?? 1) <= 0, paused: true };
}

export function dueTimers(s, now = Date.now()) {
  return s.timers.filter(t => t.endsAt && !t.rung && t.endsAt <= now);
}

// --- Summaries --------------------------------------------------------------

// How much of each ingredient has gone in so far, at the session's servings.
export function usageSummary(recipe, s) {
  const f = scaleFactor(recipe, s.servings);
  const totals = new Map(recipe.ingredients.map(l => [lineKey(l), { key: lineKey(l), ing: l.ing, total: l.amount * f, used: 0 }]));
  recipe.steps.forEach((step, i) => {
    for (const u of step.uses) {
      if (s.used[usedKey(i, u.ing)]) totals.get(u.ing).used += u.amount * f;
    }
  });
  return [...totals.values()].map(t => ({ ...t, remaining: Math.max(0, t.total - t.used), done: t.used >= t.total - 1e-9 }));
}

export function stepProgress(recipe, s, i) {
  const step = recipe.steps[i];
  const boxes = step.tasks.length + step.uses.length;
  const ticked = step.tasks.filter(t => s.tasks[taskKey(i, t)]).length + step.uses.filter(u => s.used[usedKey(i, u.ing)]).length;
  return { boxes, ticked, complete: s.doneSteps.includes(i) };
}

export function prepSummary(recipe, s) {
  const keys = recipe.ingredients.map(lineKey);
  return {
    total: keys.length,
    have: keys.filter(k => s.have[k]).length,
    prepped: keys.filter(k => s.prepped[k]).length,
    missing: keys.filter(k => !s.have[k]),
  };
}

export function progressPercent(recipe, s) {
  return Math.round((s.doneSteps.length / recipe.steps.length) * 100);
}

// --- Restoring from storage ----------------------------------------------

const boolMap = (v, valid) =>
  isObject(v) ? Object.fromEntries(Object.keys(v).filter(k => v[k] === true && valid(k)).map(k => [k, true])) : {};

// Cleans a saved session against the current recipe. Anything that no longer
// matches (a step that was removed, an unknown ingredient) is dropped rather
// than breaking the page.
export function normalizeSession(raw, recipe) {
  if (!isObject(raw) || !recipe || raw.recipeId !== recipe.id) return null;
  const lines = linesByKey(recipe);
  const steps = recipe.steps.length;
  const validStep = n => Number.isInteger(n) && n >= 0 && n < steps;
  const validStepKey = k => {
    const [a, ...rest] = k.split(":");
    return validStep(Number(a)) && rest.length > 0;
  };
  const base = newSession(recipe, raw.servings ?? recipe.servings);
  return {
    ...base,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : base.startedAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : base.updatedAt,
    phase: raw.phase === "cooking" ? "cooking" : "prep",
    step: validStep(raw.step) ? raw.step : 0,
    doneSteps: Array.isArray(raw.doneSteps) ? [...new Set(raw.doneSteps.filter(validStep))].sort((a, b) => a - b) : [],
    have: boolMap(raw.have, k => lines.has(k)),
    prepped: boolMap(raw.prepped, k => lines.has(k)),
    used: boolMap(raw.used, k => validStepKey(k) && lines.has(k.slice(k.indexOf(":") + 1))),
    tasks: boolMap(raw.tasks, validStepKey),
    timers: Array.isArray(raw.timers)
      ? raw.timers
          .filter(t => isObject(t) && validStep(t.step) && Number.isFinite(t.seconds) && t.seconds > 0)
          .map(t => ({
            step: t.step,
            label: typeof t.label === "string" ? t.label.slice(0, 40) : "Timer",
            seconds: t.seconds,
            endsAt: Number.isFinite(t.endsAt) ? t.endsAt : null,
            remaining: Number.isFinite(t.remaining) ? Math.max(0, t.remaining) : null,
            rung: t.rung === true,
          }))
          .filter(t => t.endsAt || t.remaining !== null)
      : [],
  };
}
