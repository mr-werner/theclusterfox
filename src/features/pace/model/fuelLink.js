// What the diet planner needs from PaceFox: each training day's sessions,
// how long they are and how hard (as METs), so it can size meals and
// carbs around them. Shaped like the planner's other training sources.

import { normalizeData } from "../state/paceStore.js";
import { allSessions } from "./plan.js";
import { averageMet, buildSteps, estimateRaceSec, metFor, raceZoneFor } from "./sessions.js";
import { sessionTitle } from "./planLink.js";

export function paceWorkouts(raw, from, to) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
  const out = [];
  const covered = new Set();
  if (plan) {
    for (const s of allSessions(plan)) {
      if (s.day < from || s.day > to || plan.skipped?.[s.id]) continue;
      const done = plan.completed[s.id];
      const logged = typeof done === "string" ? data.activities.find(a => a.id === done) : null;
      if (logged) covered.add(logged.id);
      const raceLike = s.type === "race" || s.type === "test";
      const steps = buildSteps(s.type, { sport: plan.sport, minutes: s.minutes, level: plan.level, phase: s.week.phase, weekIndex: s.week.index, eventId: plan.eventId });
      const minutes = logged ? logged.sec / 60 : raceLike ? (estimateRaceSec(plan.eventId, plan.level, s.type === "test") + 25 * 60) / 60 : s.minutes;
      out.push({
        id: `pace:${plan.id}:${s.id}`,
        day: s.day,
        source: "pacefox",
        title: sessionTitle(plan, s),
        minutes: Math.round(minutes),
        met: raceLike ? metFor(plan.sport, raceZoneFor(plan.eventId)) : averageMet(steps, plan.sport),
        kind: "cardio",
        easy: ["easy", "recovery", "shakeout", "runwalk"].includes(s.type),
        href: `/pace?plan=${encodeURIComponent(plan.id)}&session=${encodeURIComponent(s.id)}`,
        done: Boolean(done),
      });
    }
  }
  // Workouts logged outside the plan burned energy too.
  for (const a of data.activities) {
    if (a.day < from || a.day > to || covered.has(a.id) || (a.planId && a.sessionId && plan?.id === a.planId)) continue;
    out.push({
      id: `paceh:${a.id}`,
      day: a.day,
      source: "pacefox",
      title: a.title,
      minutes: Math.max(1, Math.round(a.sec / 60)),
      met: metFor(a.sport, a.rpe ? Math.min(5, Math.max(1, Math.round(a.rpe / 2))) : 2),
      kind: "cardio",
      href: `/pace?tab=log&a=${encodeURIComponent(a.id)}`,
      done: true,
    });
  }
  return out;
}
