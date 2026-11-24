// Everything LeapFox remembers: your plan's options and what you've done,
// your jump tests, and a couple of settings. Saved in this browser and,
// when signed in, to the ClusterFox account. The plan itself is rebuilt
// from its options (see model/program.js), so it stays small.

import { cleanOptions } from "../model/program.js";
import { testById } from "../data/goals.js";

export const STORAGE_KEY = "leapfox-data-v1";
export const MAX_RESULTS = 400;

export function emptyData() {
  return { version: 1, prefs: { unit: "in", trainTime: null }, plan: null, results: [], updatedAt: null };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const SESSION_ID = /^w\d{1,2}d\d$/;

function cleanPlan(p) {
  if (!isObject(p) || !isObject(p.options)) return null;
  const done = {};
  if (isObject(p.done)) for (const [k, v] of Object.entries(p.done)) if (SESSION_ID.test(k) && isDay(v)) done[k] = v;
  const checks = {};
  if (isObject(p.checks)) {
    for (const [k, v] of Object.entries(p.checks)) {
      if (SESSION_ID.test(k) && Array.isArray(v)) checks[k] = v.filter(x => typeof x === "string" && x.length <= 20).slice(0, 40);
    }
  }
  return {
    id: typeof p.id === "string" && p.id ? p.id.slice(0, 40) : `p${Math.random().toString(36).slice(2, 8)}`,
    createdAt: isDay(p.createdAt) ? p.createdAt : null,
    options: cleanOptions(p.options, isDay(p.options.start) ? p.options.start : p.createdAt ?? "2026-01-05"),
    done,
    checks,
  };
}

export function cleanResult(r) {
  if (!isObject(r) || !testById.has(r.test) || !isDay(r.day) || !Number.isFinite(r.cm) || r.cm <= 0 || r.cm > 500) return null;
  const test = testById.get(r.test);
  return {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : `r${Math.random().toString(36).slice(2, 8)}`,
    day: r.day,
    test: r.test,
    side: test.perSide && (r.side === "left" || r.side === "right") ? r.side : null,
    cm: Math.round(r.cm * 10) / 10,
    method: ["reach", "flight", "direct"].includes(r.method) ? r.method : "direct",
    note: typeof r.note === "string" ? r.note.slice(0, 200) : "",
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const prefs = isObject(raw.prefs) ? raw.prefs : {};
  const results = Array.isArray(raw.results)
    ? raw.results.map(cleanResult).filter(Boolean).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, MAX_RESULTS)
    : [];
  return {
    ...base,
    prefs: {
      unit: prefs.unit === "cm" ? "cm" : "in",
      trainTime: typeof prefs.trainTime === "string" && /^\d{2}:\d{2}$/.test(prefs.trainTime) ? prefs.trainTime : null,
    },
    plan: cleanPlan(raw.plan),
    results,
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
