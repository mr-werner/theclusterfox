import { formatHour } from "./units.js";

// Parts of the day people plan around, in local hours [start, end).
export const PARTS = [
  { id: "now", name: "Now" },
  { id: "morning", name: "Morning", start: 6, end: 10 },
  { id: "midday", name: "Midday", start: 10, end: 14 },
  { id: "afternoon", name: "Afternoon", start: 14, end: 18 },
  { id: "evening", name: "Evening", start: 18, end: 22 },
];

export const DURATIONS = [1, 2, 4, 8];

export function dayName(day, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

// Hours still to come (an hour counts until it has finished).
function upcoming(hours, now) {
  return hours.filter(hour => hour.time.getTime() + 3600000 > now);
}

/**
 * The forecast hours for a choice of day and part of the day.
 * days: forecast days (YYYY-MM-DD), today first. Returns [] when the whole
 * part has already passed.
 */
export function windowHours(hours, days, { day, part, duration }, now = Date.now()) {
  const future = upcoming(hours, now);
  if (part === "now") return future.slice(0, duration);
  const range = PARTS.find(p => p.id === part);
  return future.filter(h => h.localDay === days[day] && h.localHour >= range.start && h.localHour < range.end);
}

// Whether a part of the day still has hours left on a given day.
export function partAvailable(hours, days, day, part, now = Date.now()) {
  if (part === "now") return day === 0;
  return windowHours(hours, days, { day, part, duration: 1 }, now).length > 0;
}

export function describeWindow(window) {
  if (!window.length) return "";
  const first = window[0];
  const last = window[window.length - 1];
  const end = (last.localHour + 1) % 24;
  return `${formatHour(first.localHour)}–${formatHour(end)}`;
}
