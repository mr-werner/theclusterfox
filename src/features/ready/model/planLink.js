// What ReadyFox puts on the PlanFox calendar: each training day of your
// plan and your test day. Tapping one opens that day in ReadyFox.

import { normalizeData } from "../state/readyStore.js";
import { jobById } from "../data/jobs.js";
import { AFT_TABLES } from "../data/aftTables.js";
import { allSessions, buildPlan, nextSession } from "./plan.js";
import { toIsoDay } from "./units.js";

export const sessionHref = id => `/ready?tab=plan&session=${encodeURIComponent(id)}`;

export function planItems(raw, from, to, today = toIsoDay(new Date())) {
  const data = normalizeData(raw);
  const plan = data.plan;
  const job = plan && jobById.get(plan.jobId);
  if (!job) return [];
  return allSessions(buildPlan(plan, job, AFT_TABLES))
    .filter(s => s.day >= from && s.day <= to)
    .map(s => {
      const done = Boolean(plan.completed[s.id]);
      return {
        id: `r:${plan.id}:${s.id}`,
        day: s.day,
        time: null,
        title: s.kind === "test" ? s.title : `${job.name}: ${s.title}`,
        detail: s.minutes ? `about ${s.minutes} min` : undefined,
        href: sessionHref(s.id),
        action: s.day <= today && !done ? "Start" : "Open",
        done,
      };
    });
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const targets = [];
  const plan = data.plan;
  const job = plan && jobById.get(plan.jobId);
  if (job) {
    const next = nextSession(buildPlan(plan, job, AFT_TABLES), plan);
    if (next) targets.push({ id: "next", title: `Next training day (${next.title})`, href: sessionHref(next.id) });
    targets.push({ id: "plan", title: "My training plan", href: "/ready?tab=plan" });
  }
  targets.push({ id: "test", title: "Log a test", href: "/ready?tab=test" });
  targets.push({ id: "jobs", title: "Pick a job", href: "/ready" });
  return targets;
}
