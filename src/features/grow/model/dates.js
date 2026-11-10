// Day math on "YYYY-MM-DD" keys. Days are counted in UTC so daylight
// saving never shifts a date.

const DAY = 86400000;
const pad = n => String(n).padStart(2, "0");

export const dayNum = key => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY);
export function dayKey(num) {
  const d = new Date(num * DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const isDayKey = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayKey(dayNum(v)) === v;
export const addDays = (key, n) => dayKey(dayNum(key) + n);
export const todayKey = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const weekday = num => new Date(num * DAY).getUTCDay();
export const yearOf = num => new Date(num * DAY).getUTCFullYear();
export const monthOf = num => new Date(num * DAY).getUTCMonth();
export const dateOfMonth = num => new Date(num * DAY).getUTCDate();
// Day number of the given day of year (1 = Jan 1) in a year.
export const fromDoy = (year, doy) => Math.round(Date.UTC(year, 0, 1) / DAY) + doy - 1;
export const doyOf = num => num - Math.round(Date.UTC(yearOf(num), 0, 1) / DAY) + 1;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = MONTHS;
export const shortDate = num => `${MONTHS[monthOf(num)]} ${dateOfMonth(num)}`;
export const doyLabel = doy => shortDate(fromDoy(2025, doy));
export function niceDate(key) {
  const d = new Date(dayNum(key) * DAY);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
export function weekdayShort(key) {
  return new Date(dayNum(key) * DAY).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
