// Weather for planned sessions. Plain functions, testable in Node.

import { activitiesById } from "../data/activities.js";
import { formatTemp } from "../units.js";
import { compareWindows, rankStarts, scoreWindow, sessionAdvice } from "./score.js";

/**
 * Weather for a planned session: its score, a better time that day if
 * there is one, and what to wear and bring. Returns null when the session
 * is outside the forecast.
 */
export function evaluatePlan(plan, hours, place, options, units, now) {
  const activity = activitiesById.get(plan.activityId);
  if (!activity) return null;
  const window = hours.filter(h => h.localDay === plan.day && h.localHour >= plan.startHour && h.localHour < plan.startHour + plan.hours);
  if (window.length < plan.hours) return null;
  const result = scoreWindow(window, place, activity, options);
  const best = rankStarts(hours, place, activity, { day: plan.day, duration: plan.hours, earliest: 5, latest: 22, notBefore: now, options })[0];
  const fmt = (c, opts) => formatTemp(c, units, opts);
  const better =
    best && best.startHour !== plan.startHour && best.score - result.score >= 10
      ? { ...best, reasons: compareWindows(best, result, fmt) }
      : null;
  const advice = sessionAdvice(window, place, activity, { ...options, formatTemp: fmt });
  return { activity, window, result, better, advice };
}

