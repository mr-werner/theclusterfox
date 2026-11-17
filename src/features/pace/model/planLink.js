// What PaceFox puts on the PlanFox calendar: the sessions of your active
// plan on their days (at your usual training time, if you set one), your
// race, and workouts you logged. Tapping one opens PaceFox ready to go.

import { normalizeData } from "../state/paceStore.js";
import { allSessions, nextSession } from "./plan.js";
import { sessionName, raceZoneFor } from "./sessions.js";
import { eventById } from "../data/events.js";
import { fmtDistance, fmtMinutes, toIsoDay } from "./units.js";
import { ZONES } from "./zones.js";

export const sessionHref = (planId, sessionId) => `/pace?plan=${encodeURIComponent(planId)}&session=${encodeURIComponent(sessionId)}`;

const activePlan = data => data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0] ?? null;

export function sessionTitle(plan, s) {
  const event = eventById.get(plan.eventId);
  if (s.type === "race") return `Race day: ${event?.name ?? "race"}`;
  if (s.type === "test") return event?.testName ?? "Test";
  return sessionName(s.type, plan.sport);
}

export function planItems(raw, from, to, today = toIsoDay(new Date())) {
  const data = normalizeData(raw);
  const plan = activePlan(data);
  const out = [];
  const time = data.prefs.trainTime;
  if (plan) {
    for (const s of allSessions(plan)) {
      if (s.day < from || s.day > to || plan.skipped?.[s.id]) continue;
      const done = Boolean(plan.completed[s.id]);
      const zone = s.type === "race" || s.type === "test" ? raceZoneFor(plan.eventId) : null;
      out.push({
        id: `s:${plan.id}:${s.id}`,
        day: s.day,
        time,
        title: sessionTitle(plan, s),
        detail: [s.minutes ? fmtMinutes(s.minutes) : zone ? `race effort (${ZONES[zone].short})` : null, `week ${s.week.index + 1}`].filter(Boolean).join(" · "),
        href: sessionHref(plan.id, s.id),
        action: s.day <= today && !done ? "Start" : "Open",
        done,
      });
    }
  }
  const planned = new Set(Object.values(plan?.completed ?? {}));
  for (const a of data.activities) {
    if (a.day < from || a.day > to || planned.has(a.id)) continue;
    out.push({
      id: `a:${a.id}`,
      day: a.day,
      time: null,
      title: a.title,
      detail: [a.meters ? fmtDistance(a.meters, a.sport === "row" ? "m" : data.prefs.unit) : null, a.sec ? fmtMinutes(a.sec / 60) : null].filter(Boolean).join(" · "),
      href: `/pace?tab=log&a=${encodeURIComponent(a.id)}`,
      done: true,
    });
  }
  return out;
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const plan = activePlan(data);
  const targets = [];
  if (plan) {
    const next = nextSession(plan);
    if (next) targets.push({ id: "next", title: `Next session (${sessionTitle(plan, next)})`, href: "/pace?next=1" });
    targets.push({ id: "plan", title: "My training plan", href: "/pace" });
  }
  targets.push({ id: "run", title: "Start a run", href: "/pace?go=run" });
  targets.push({ id: "ride", title: "Start a ride", href: "/pace?go=ride" });
  targets.push({ id: "row", title: "Start a row", href: "/pace?go=row" });
  targets.push({ id: "log", title: "Training log", href: "/pace?tab=log" });
  return targets;
}
