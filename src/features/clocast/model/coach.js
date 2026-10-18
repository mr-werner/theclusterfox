import { rankStarts } from "./score.js";

// Windows (local start hours) for a preferred time of day.
export const TIMES_OF_DAY = {
  any: { name: "Any time", earliest: 6, latest: 21 },
  morning: { name: "Mornings", earliest: 5, latest: 11 },
  midday: { name: "Midday", earliest: 10, latest: 15 },
  evening: { name: "Evenings", earliest: 16, latest: 21 },
};

/**
 * Best sessions for a goal over the coming days.
 *
 * goal: { activityId, perWeek, minutes, timeOfDay }
 * days: forecast days (YYYY-MM-DD), today first; only the first seven are used.
 * plans: planned sessions; ones already planned for this activity in the
 *        next seven days count toward the goal.
 * Returns { needed, planned, sessions: [{ day, startHour, score, ... }] }.
 */
export function suggestSessions(hours, days, place, goal, activity, plans, { notBefore = 0, options = {} } = {}) {
  const week = days.slice(0, 7);
  const planned = plans.filter(p => p.activityId === goal.activityId && week.includes(p.day));
  const needed = Math.max(0, goal.perWeek - planned.length);
  if (!needed) return { needed, planned: planned.length, sessions: [] };

  const range = TIMES_OF_DAY[goal.timeOfDay] ?? TIMES_OF_DAY.any;
  const duration = Math.max(1, Math.round(goal.minutes / 60));
  const busy = new Set(planned.map(p => p.day));

  const candidates = week
    .filter(day => !busy.has(day))
    .map(day => rankStarts(hours, place, activity, { day, duration, ...range, notBefore, options })[0])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // Spread sessions out: avoid back-to-back days unless the goal needs it.
  const spacing = goal.perWeek <= 3 ? 2 : goal.perWeek <= 4 ? 1 : 0;
  const index = day => week.indexOf(day);
  const taken = [...busy];
  const sessions = [];
  for (const pass of spacing ? [spacing, 0] : [0]) {
    for (const c of candidates) {
      if (sessions.length >= needed) break;
      const day = c.window[0].localDay;
      if (sessions.some(s => s.day === day)) continue;
      if (pass && taken.some(t => Math.abs(index(t) - index(day)) < pass)) continue;
      sessions.push({ ...c, day });
      taken.push(day);
    }
  }
  sessions.sort((a, b) => index(a.day) - index(b.day));
  return { needed, planned: planned.length, sessions, duration };
}
