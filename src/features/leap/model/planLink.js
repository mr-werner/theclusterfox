// What LeapFox puts on the PlanFox calendar: the sessions of your jump plan
// on their days (at your usual training time, if you set one). Tapping one
// opens that session in LeapFox.

import { normalizeData } from "../state/leapStore.js";
import { allSessions, buildPlan, nextSession, toIsoDay } from "./program.js";

export const sessionHref = id => `/leap?tab=train&session=${encodeURIComponent(id)}`;

export function planItems(raw, from, to, today = toIsoDay(new Date())) {
  const data = normalizeData(raw);
  if (!data.plan) return [];
  const plan = buildPlan(data.plan.options);
  const out = [];
  for (const s of allSessions(plan)) {
    if (s.day < from || s.day > to) continue;
    const done = Boolean(data.plan.done[s.id]);
    out.push({
      id: `s:${data.plan.id}:${s.id}`,
      day: s.day,
      time: data.prefs.trainTime,
      title: `Jump training: ${s.name}`,
      detail: [`about ${s.minutes} min`, `week ${s.week + 1}`].join(" · "),
      href: sessionHref(s.id),
      action: s.day <= today && !done ? "Start" : "Open",
      done,
    });
  }
  return out;
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const targets = [];
  if (data.plan) {
    const plan = buildPlan(data.plan.options);
    const next = nextSession(plan, data.plan.done, toIsoDay(new Date()));
    if (next) targets.push({ id: "next", title: `Next session (${next.name})`, href: "/leap?tab=train" });
    targets.push({ id: "plan", title: "My jump plan", href: "/leap" });
  } else {
    targets.push({ id: "plan", title: "Make a jump plan", href: "/leap" });
  }
  targets.push({ id: "tests", title: "Jump tests", href: "/leap?tab=tests" });
  targets.push({ id: "drills", title: "Jump drills", href: "/leap?tab=drills" });
  return targets;
}
