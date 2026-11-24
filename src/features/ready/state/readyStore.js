// Everything ReadyFox remembers: the job you're training for, your age and
// sex (only used where a test is scored by them), the plan, and every test
// you've logged. Saved in this browser and, when signed in, to the
// ClusterFox account.

import { EVENTS, jobById } from "../data/jobs.js";

export const STORAGE_KEY = "readyfox-data-v1";
export const MAX_ATTEMPTS = 200;

export function emptyData() {
  return {
    version: 1,
    jobId: null,
    profile: { sex: null, age: null },
    plan: null,
    attempts: [],
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

function cleanProfile(p) {
  if (!isObject(p)) return emptyData().profile;
  return { sex: p.sex === "f" || p.sex === "m" ? p.sex : null, age: num(p.age, 14, 80) };
}

/** Keeps only known events with sensible values. */
export function cleanScores(s) {
  if (!isObject(s)) return {};
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k.endsWith(":option")) {
      const id = k.slice(0, -7);
      if (EVENTS[id]?.options?.some(o => o.id === v)) out[k] = v;
      continue;
    }
    const ev = EVENTS[k];
    if (!ev) continue;
    if (ev.kind === "pass") {
      if (typeof v === "boolean") out[k] = v;
    } else {
      const n = num(v, 0, 20000);
      if (n != null) out[k] = n;
    }
  }
  return out;
}

function cleanPlan(p) {
  if (!isObject(p) || !jobById.has(p.jobId) || !isDay(p.start) || !isDay(p.testDay)) return null;
  const days = Array.isArray(p.days) ? [...new Set(p.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  const completed = {};
  if (isObject(p.completed)) for (const [k, v] of Object.entries(p.completed)) if (v === true && k.length < 20) completed[k] = true;
  return {
    id: typeof p.id === "string" ? p.id.slice(0, 40) : `p${Date.now()}`,
    jobId: p.jobId,
    start: p.start,
    testDay: p.testDay,
    days: days.length >= 3 ? days : [1, 2, 4, 5, 6],
    target: p.target === "aim" ? "aim" : "min",
    baseline: cleanScores(p.baseline),
    profile: cleanProfile(p.profile),
    completed,
  };
}

function cleanAttempt(a) {
  if (!isObject(a) || !jobById.has(a.jobId) || !isDay(a.day)) return null;
  const scores = cleanScores(a.scores);
  if (!Object.keys(scores).length) return null;
  return {
    id: typeof a.id === "string" ? a.id.slice(0, 40) : `a${Date.now()}`,
    jobId: a.jobId,
    day: a.day,
    scores,
    note: typeof a.note === "string" ? a.note.slice(0, 300) : "",
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  return {
    ...base,
    jobId: jobById.has(raw.jobId) ? raw.jobId : null,
    profile: cleanProfile(raw.profile),
    plan: cleanPlan(raw.plan),
    attempts: Array.isArray(raw.attempts)
      ? raw.attempts.map(cleanAttempt).filter(Boolean).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, MAX_ATTEMPTS)
      : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function loadData() {
  try {
    return normalizeData(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: keeps working for this visit.
  }
}

/** Your latest logged scores for a job, merged event by event (newest wins). */
export function latestScores(attempts, jobId) {
  const out = {};
  for (const a of [...attempts].filter(x => x.jobId === jobId).sort((x, y) => (x.day < y.day ? -1 : 1))) Object.assign(out, a.scores);
  return out;
}
