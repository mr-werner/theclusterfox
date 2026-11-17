// Distances, paces and times the way runners, riders and rowers say them.

export const M_PER_MI = 1609.344;
export const unitMeters = unit => (unit === "km" ? 1000 : M_PER_MI);

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function fmtClock(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "–";
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Minutes as words: 45 -> "45 min", 95 -> "1 h 35 min". */
export function fmtMinutes(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function fmtDistance(m, unit = "mi", digits = 2) {
  if (!Number.isFinite(m)) return "–";
  if (unit === "m") return `${Math.round(m).toLocaleString()} m`;
  return `${(m / unitMeters(unit)).toFixed(digits)} ${unit}`;
}

/** Seconds per mile or km from meters per second. */
export const paceFromSpeed = (mps, unit = "mi") => (mps > 0.3 ? unitMeters(unit) / mps : null);
/** Seconds per 500 m, the rower's split. */
export const splitFromSpeed = mps => (mps > 0.3 ? 500 / mps : null);
/** mph or km/h. */
export const speedIn = (mps, unit = "mi") => (unit === "km" ? mps * 3.6 : mps * 2.236936);

export function fmtPace(secPerUnit, unit = "mi") {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 3600) return "–";
  return `${fmtClock(Math.round(secPerUnit))} /${unit}`;
}
export const fmtSplit = sec => (Number.isFinite(sec) && sec > 0 && sec < 600 ? `${fmtClock(Math.round(sec))} /500m` : "–");
export const fmtSpeed = (mps, unit = "mi") => (Number.isFinite(mps) ? `${speedIn(mps, unit).toFixed(1)} ${unit === "km" ? "km/h" : "mph"}` : "–");

/** The headline speed figure each sport uses. */
export function fmtRate(sport, mps, unit) {
  if (sport === "row") return fmtSplit(splitFromSpeed(mps));
  if (sport === "ride") return fmtSpeed(mps, unit);
  return fmtPace(paceFromSpeed(mps, unit), unit);
}

/** "1:23:45" or "23:45" or "45" -> seconds, or null. */
export function parseClock(text) {
  if (typeof text !== "string") return null;
  const parts = text.trim().split(":");
  if (!parts.length || parts.length > 3 || parts.some(p => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  const sec = nums.reduce((acc, n) => acc * 60 + n, 0);
  return sec > 0 ? sec : null;
}

/** "YYYY-MM-DD" for a Date in local time. */
export function toIsoDay(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local Date at midnight from "YYYY-MM-DD". */
export function fromIsoDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(day, n) {
  const d = fromIsoDay(day);
  d.setDate(d.getDate() + n);
  return toIsoDay(d);
}
/** Monday of the week holding day. */
export function mondayOf(day) {
  const d = fromIsoDay(day);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toIsoDay(d);
}
/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = day => (fromIsoDay(day).getDay() + 6) % 7;
export const daysBetween = (a, b) => Math.round((fromIsoDay(b) - fromIsoDay(a)) / 86400000);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function fmtDay(day, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return fromIsoDay(day).toLocaleDateString(undefined, opts);
}
