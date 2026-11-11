// Small schedule helpers shared by the ScoreFox views (and the tests).

import { canWatchNetwork } from "../../../services/watch/parse.js";

export const dateKey = date =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

const clock = iso => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// What goes in the time box: live clock, final, start time or "Time TBA".
export function eventTime(event) {
  if (event.state === "in") return { text: event.detail || "Live", live: true };
  if (event.state === "post") return { text: event.detail || "Final" };
  if (!event.start || event.timeKnown === false) return { text: event.detail || "Time TBA" };
  return { text: clock(event.start) };
}

export const canWatch = (event, networkKeys) => (event.networks ?? []).some(n => canWatchNetwork(n.name, networkKeys));

// Tennis answers cover a few days around the one asked for; keep the
// matches that fall on the picked day where the viewer is.
export function onDay(event, day) {
  if (event.kind !== "tennis") return event;
  const matches = event.matches.filter(m => m.start && dateKey(new Date(m.start)) === day);
  return matches.length ? { ...event, matches } : null;
}
