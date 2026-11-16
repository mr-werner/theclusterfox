// Everything MedicFox remembers: your level, how each skill station has
// gone at each pace, and your practice question record. Saved in this
// browser and, when signed in, to the ClusterFox account.
import { LEVEL_IDS } from "../data/levels.js";
import { skillById } from "../data/skills.js";
import { questionById } from "../data/questions.js";
import { MODE_IDS } from "../model/sim.js";

export const STORAGE_KEY = "medicfox-data-v1";
export const MAX_HISTORY = 400;

export function emptyData() {
  return {
    version: 1,
    level: "emt",
    skills: {}, // skillId -> { crawl, walk, run }: { tries, passes, best (secs or null), bestShare }
    quiz: {}, // questionId -> { right, wrong, last (ISO) }
    history: [], // { id, day, skillId, mode, pass, points, possible, secs }
    updatedAt: null,
  };
}

const isObject = v => Boolean(v && typeof v === "object" && !Array.isArray(v));
const int = (v, max = 1e6) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function cleanRecord(r) {
  if (!isObject(r)) return { tries: 0, passes: 0, best: null, bestShare: 0 };
  return {
    tries: int(r.tries),
    passes: int(r.passes),
    best: Number.isFinite(r.best) && r.best > 0 ? Math.round(r.best) : null,
    bestShare: Number.isFinite(r.bestShare) ? Math.min(1, Math.max(0, r.bestShare)) : 0,
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObject(raw)) return base;
  const skills = {};
  if (isObject(raw.skills)) {
    for (const [id, modes] of Object.entries(raw.skills)) {
      if (!skillById.has(id) || !isObject(modes)) continue;
      skills[id] = Object.fromEntries(MODE_IDS.map(m => [m, cleanRecord(modes[m])]));
    }
  }
  const quiz = {};
  if (isObject(raw.quiz)) {
    for (const [id, r] of Object.entries(raw.quiz)) {
      if (!questionById.has(id) || !isObject(r)) continue;
      quiz[id] = { right: int(r.right), wrong: int(r.wrong), last: typeof r.last === "string" ? r.last.slice(0, 40) : null };
    }
  }
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter(h => isObject(h) && isDay(h.day) && skillById.has(h.skillId) && MODE_IDS.includes(h.mode))
        .slice(-MAX_HISTORY)
        .map(h => ({ id: String(h.id ?? `${h.day}-${h.skillId}`).slice(0, 40), day: h.day, skillId: h.skillId, mode: h.mode, pass: Boolean(h.pass), points: int(h.points, 1000), possible: int(h.possible, 1000), secs: int(h.secs, 1e5) }))
    : [];
  return {
    ...base,
    level: LEVEL_IDS.includes(raw.level) ? raw.level : base.level,
    skills,
    quiz,
    history,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

/** The record for a station at one pace. */
export function recordFor(data, skillId, mode) {
  return data.skills[skillId]?.[mode] ?? { tries: 0, passes: 0, best: null, bestShare: 0 };
}

/** Add a finished run to the data. */
export function addResult(data, { skillId, mode, pass, points, possible, secs, day, id }) {
  const modes = data.skills[skillId] ?? Object.fromEntries(MODE_IDS.map(m => [m, cleanRecord(null)]));
  const r = modes[mode] ?? cleanRecord(null);
  const share = possible ? points / possible : 0;
  const next = {
    tries: r.tries + 1,
    passes: r.passes + (pass ? 1 : 0),
    best: pass ? (r.best ? Math.min(r.best, secs) : secs) : r.best,
    bestShare: Math.max(r.bestShare, share),
  };
  const history = [...data.history, { id, day, skillId, mode, pass, points, possible, secs }].slice(-MAX_HISTORY);
  return { ...data, skills: { ...data.skills, [skillId]: { ...modes, [mode]: next } }, history };
}

/** Record a practice question answer. */
export function addAnswer(data, questionId, right, when = new Date().toISOString()) {
  const r = data.quiz[questionId] ?? { right: 0, wrong: 0, last: null };
  return { ...data, quiz: { ...data.quiz, [questionId]: { right: r.right + (right ? 1 : 0), wrong: r.wrong + (right ? 0 : 1), last: when } } };
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
    // Storage blocked or full: the app still works for this visit.
  }
}
