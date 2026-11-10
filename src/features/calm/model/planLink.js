// What CalmFox puts on the PlanFox calendar: the sessions you finished, so
// the day shows the time you took for yourself. Planner items can open any
// session ("Opens in" on an item), say a sleep session every night.

import { normalizeData } from "../state/calmStore.js";
import { goals, sessions, sessionsById } from "../data/sessions.js";

export const sessionHref = id => `/calm?s=${encodeURIComponent(id)}`;

export function planItems(raw, from, to) {
  const data = normalizeData(raw);
  return data.history
    .filter(entry => entry.date >= from && entry.date <= to)
    .map(entry => ({
      id: `h:${entry.id}`,
      day: entry.date,
      time: entry.startedAt ? new Date(entry.startedAt).toTimeString().slice(0, 5) : null,
      title: entry.title,
      detail: entry.minutes ? `${Math.max(1, Math.round(entry.minutes))} min` : "",
      href: sessionsById.has(entry.sessionId) ? sessionHref(entry.sessionId) : "/calm",
      done: true,
    }));
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const favorites = data.favorites.map(id => sessionsById.get(id)).filter(Boolean);
  const rest = sessions.filter(s => !data.favorites.includes(s.id));
  return [
    ...goals.map(g => ({ id: `goal:${g.id}`, title: `${g.name} sessions`, href: `/calm?goal=${encodeURIComponent(g.id)}` })),
    ...[...favorites, ...rest].map(s => ({ id: s.id, title: `${data.favorites.includes(s.id) ? "★ " : ""}${s.title}`, href: sessionHref(s.id) })),
  ];
}
