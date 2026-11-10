// What LiftFox puts on the PlanFox calendar: the sessions of your active
// plan on the days they fall, workouts you finished, and a workout still
// in progress. Tapping one opens LiftFox ready to train.

import { normalizeData } from "../state/liftStore.js";
import { nextSession, sessionDate, toIsoDay } from "./program.js";

const inRange = (day, from, to) => Boolean(day) && day >= from && day <= to;

export const sessionHref = (planId, sessionId) => `/lift?plan=${encodeURIComponent(planId)}&session=${encodeURIComponent(sessionId)}`;

export function planItems(raw, from, to, today = toIsoDay(new Date())) {
  const data = normalizeData(raw);
  const out = [];
  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
  const shownSessions = new Set();
  const shownToday = new Set();

  if (plan?.program.startDate) {
    const { program, completed } = plan;
    for (const week of program.schedule) {
      for (const session of week.sessions) {
        const day = sessionDate(program, week.index, session.weekday);
        if (!inRange(day, from, to)) continue;
        shownSessions.add(session.id);
        if (day === today) shownToday.add(session.id);
        out.push({
          id: `s:${plan.id}:${session.id}`,
          day,
          time: null,
          title: `Week ${week.index + 1}: ${session.name}`,
          detail: [`${program.minutes} min`, week.deload ? "easy week" : null].filter(Boolean).join(" · "),
          href: sessionHref(plan.id, session.id),
          action: "Start",
          done: Boolean(completed[session.id]),
        });
      }
    }
    // Fell behind? The next session waits for you today.
    const next = nextSession(program, completed);
    const due = next && sessionDate(program, next.week.index, next.session.weekday);
    if (next && due && due < today && inRange(today, from, to)) {
      shownToday.add(next.session.id);
      out.push({
        id: `catchup:${plan.id}:${next.session.id}`,
        day: today,
        time: null,
        title: `Week ${next.week.index + 1}: ${next.session.name}`,
        detail: "Next in your plan, pick it up today",
        href: sessionHref(plan.id, next.session.id),
        action: "Start",
        done: false,
      });
    }
  }

  const current = data.current;
  // A plan session already on today's list covers the workout in progress.
  if (current && inRange(today, from, to) && !(current.sessionId && shownToday.has(current.sessionId))) {
    out.push({
      id: `current:${current.id}`,
      day: today,
      time: null,
      title: `Finish: ${current.title}`,
      detail: "Workout in progress",
      href: "/lift",
      action: "Resume",
      done: false,
    });
  }

  for (const entry of data.history) {
    const day = entry.date.slice(0, 10);
    if (!inRange(day, from, to)) continue;
    if (entry.sessionId && entry.planId === plan?.id && shownSessions.has(entry.sessionId)) continue;
    out.push({
      id: `h:${entry.id}`,
      day,
      time: null,
      title: entry.title,
      detail: [entry.minutes ? `${Math.round(entry.minutes)} min` : null, entry.setsTotal ? `${entry.setsDone}/${entry.setsTotal} sets` : null].filter(Boolean).join(" · "),
      href: "/lift?tab=history",
      done: true,
    });
  }
  return out;
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const targets = [{ id: "new", title: "Build a workout", href: "/lift" }];
  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
  if (plan) {
    const next = nextSession(plan.program, plan.completed);
    if (next) targets.push({ id: "next", title: `Next plan session (${next.session.name})`, href: "/lift?next=1" });
    targets.push({ id: "plans", title: "My plan", href: "/lift?tab=plans" });
  }
  targets.push({ id: "history", title: "Progress", href: "/lift?tab=history" });
  return targets;
}
