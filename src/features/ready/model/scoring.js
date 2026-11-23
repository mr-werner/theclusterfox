// Checks a set of scores against a job's test: which events pass, which
// meet the higher "aim" score, and (for the Army Fitness Test) the points.

import { EVENTS } from "../data/jobs.js";
import { fmtTime } from "./units.js";

export const AGE_GROUPS = ["17-21", "22-26", "27-31", "32-36", "37-41", "42-46", "47-51", "52-56", "57-61", "62+"];

export function ageGroup(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a < 22) return "17-21";
  if (a >= 62) return "62+";
  const i = Math.floor((a - 17) / 5);
  return AGE_GROUPS[Math.min(i, AGE_GROUPS.length - 1)];
}

/** More is better for reps, holds and weight; less is better for times. */
export const lowerIsBetter = eventId => EVENTS[eventId]?.kind === "time";

export const better = (eventId, a, b) => (lowerIsBetter(eventId) ? a <= b : a >= b);

/** How a result reads: "12:30", "50 reps", "1:40", "250 lb", "Pass". */
export function fmtResult(eventId, value, option) {
  const ev = EVENTS[eventId];
  if (value == null || value === "") return "–";
  if (ev?.kind === "pass") return value ? "Pass" : "Not yet";
  if (ev?.kind === "time" || ev?.kind === "hold") return fmtTime(value);
  if (ev?.kind === "lbs") return `${value} lb`;
  if (ev?.options && option) return `${value} ${ev.options.find(o => o.id === option)?.name.toLowerCase().replace(/ \(.*\)/, "") ?? "reps"}`;
  return `${value}`;
}

/** Points for one AFT event: the most points whose listed result you met. */
export function aftPoints(tables, aftEvent, value, group, column) {
  const t = tables?.[aftEvent];
  if (!t || value == null) return null;
  const rows = t.ages[group]?.[column] ?? [];
  const lower = t.kind === "time";
  for (const [pts, need] of rows) {
    if (lower ? value <= need : value >= need) return pts;
  }
  return 0;
}

/** The result needed for a number of AFT points (or the nearest above it). */
export function aftNeeded(tables, aftEvent, points, group, column) {
  const rows = tables?.[aftEvent]?.ages[group]?.[column] ?? [];
  let best = null;
  for (const [pts, need] of rows) if (pts >= points) best = need;
  return best;
}

const aftColumn = (test, profile) => (test.standard === "combat" ? "m" : profile?.sex === "f" ? "f" : "m");

export const AFT_AIM_POINTS = 80;

/**
 * The minimum and aim for each event of a test, for this person.
 * Returns [{ id, event, min, aim, option? }] in test order.
 * For the Marine IST "either/or" event, min and aim are per option.
 */
export function standardsFor(job, profile, tables) {
  const test = job.test;
  const sex = profile?.sex === "f" ? "f" : "m";
  return test.events.map(e => {
    const event = EVENTS[e.id];
    if (test.scoring === "aft") {
      const group = ageGroup(profile?.age);
      const col = aftColumn(test, profile);
      return {
        id: e.id,
        event,
        min: aftNeeded(tables, event.aft, test.passEvent, group, col),
        aim: aftNeeded(tables, event.aft, AFT_AIM_POINTS, group, col),
        max: aftNeeded(tables, event.aft, 100, group, col),
      };
    }
    const pick = v => (test.bySex && v && typeof v === "object" ? v[sex] : v);
    return { id: e.id, event, min: pick(e.min), aim: pick(e.aim) ?? null };
  });
}

export const aimLabel = job =>
  job.test.scoring === "aft" ? `${AFT_AIM_POINTS} points` : job.id === "navy-seal" ? "Elevated" : job.test.events.some(e => e.aim) ? "Recommended" : null;

/**
 * Checks scores ({ eventId: value, "istUpper:option": "pullups" }) against the test.
 * Returns { rows: [{ id, value, status, points? }], pass, complete, total? }.
 * status is "none" (not entered), "below", "min" (passes) or "aim" (meets the higher score).
 */
export function checkScores(job, scores = {}, profile, tables) {
  const test = job.test;
  const std = standardsFor(job, profile, tables);
  const rows = std.map(s => {
    const value = scores[s.id];
    if (value == null || value === "") return { ...s, value: null, status: "none" };
    if (s.event.kind === "pass") return { ...s, value, status: value ? "min" : "below" };
    if (test.scoring === "aft") {
      const pts = aftPoints(tables, s.event.aft, value, ageGroup(profile?.age), aftColumn(test, profile));
      return { ...s, value, points: pts, status: pts >= AFT_AIM_POINTS ? "aim" : pts >= test.passEvent ? "min" : "below" };
    }
    if (s.event.options) {
      const option = scores[`${s.id}:option`] ?? s.event.options[0].id;
      const need = s.min?.[option];
      return { ...s, value, option, status: need != null && value >= need ? "min" : "below" };
    }
    const status = s.aim != null && better(s.id, value, s.aim) ? "aim" : s.min == null || better(s.id, value, s.min) ? "min" : "below";
    return { ...s, value, status };
  });
  const complete = rows.every(r => r.status !== "none");
  let pass = complete && rows.every(r => r.status !== "below");
  let total = null;
  let combined = null;
  if (test.scoring === "aft") {
    total = rows.reduce((n, r) => n + (r.points ?? 0), 0);
    pass = pass && total >= test.passTotal;
  }
  if (test.combined) {
    const vals = test.combined.events.map(id => scores[id]);
    if (vals.every(v => v != null)) {
      combined = vals.reduce((a, b) => a + b, 0);
      pass = pass && combined <= test.combined.max;
    }
  }
  return { rows, complete, pass, total, combined };
}

/** "50" for reps, "12:30" for times; per option for the IST pull-up/push-up event. */
export function fmtStandard(id, value, option) {
  if (value == null) return null;
  if (typeof value === "object") {
    const ev = EVENTS[id];
    return ev.options.map(o => `${value[o.id]} ${o.name.toLowerCase().replace(/ \(.*\)/, "")}`).join(" or ");
  }
  return fmtResult(id, value, option);
}
