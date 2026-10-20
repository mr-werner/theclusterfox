// Calendar dates as "YYYY-MM-DD" keys in the viewer's local time. Plain
// functions, testable in Node.

const pad = n => String(n).padStart(2, "0");

export const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const isDayKey = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDay(value).getTime());

export function addDays(key, count) {
  const date = parseDay(key);
  date.setDate(date.getDate() + count);
  return dayKey(date);
}

export const daysBetween = (from, to) => Math.round((parseDay(to) - parseDay(from)) / 86400000);

export const todayKey = (now = new Date()) => dayKey(now);

// Every day key from `from` to `to`, inclusive.
export function dayRange(from, to) {
  const out = [];
  for (let key = from; key <= to; key = addDays(key, 1)) out.push(key);
  return out;
}

/**
 * The weeks shown for a month, Sunday first: six rows of seven day keys
 * covering the whole month. month is 0-based.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = dayKey(new Date(year, month, 1 - first.getDay()));
  const weeks = [];
  for (let w = 0; w < 6; w++) weeks.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  // Drop a trailing week that is entirely next month.
  if (parseDay(weeks[5][0]).getMonth() !== month) weeks.pop();
  return weeks;
}

export function weekOf(key) {
  const start = addDays(key, -parseDay(key).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const monthName = (year, month, style = "long") =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: style, year: style === "long" ? "numeric" : undefined });

export const longDate = key => parseDay(key).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const shortDate = key => parseDay(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// "HH:MM" → "7:30 PM"
export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

// Relative label for a day: Today, Tomorrow, Friday, or Oct 31.
export function relativeDay(key, today) {
  const diff = daysBetween(today, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return parseDay(key).toLocaleDateString("en-US", { weekday: "long" });
  return parseDay(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const lastDayOfMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Days in [from, to] on which a repeating item falls. repeat: none, daily,
 * weekly, biweekly, monthly, yearly. Monthly items on the 31st fall on the
 * last day of shorter months. `until` (a day key) stops the series.
 */
export function occurrences(item, from, to) {
  const start = item.day;
  if (!isDayKey(start)) return [];
  const end = item.until && item.until < to ? item.until : to;
  if (start > end) return [];
  const repeat = item.repeat ?? "none";
  if (repeat === "none") return start >= from && start <= end ? [start] : [];

  const out = [];
  const startDate = parseDay(start);
  if (repeat === "daily" || repeat === "weekly" || repeat === "biweekly") {
    const step = repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 14;
    const skip = start < from ? Math.ceil(daysBetween(start, from) / step) : 0;
    for (let key = addDays(start, skip * step); key <= end; key = addDays(key, step)) out.push(key);
    return out;
  }
  if (repeat === "monthly" || repeat === "yearly") {
    const day = startDate.getDate();
    const fromDate = parseDay(from);
    let year = Math.max(startDate.getFullYear(), fromDate.getFullYear() - 1);
    let month = repeat === "monthly" ? (year === startDate.getFullYear() ? startDate.getMonth() : 0) : startDate.getMonth();
    for (let guard = 0; guard < 400; guard++) {
      const key = dayKey(new Date(year, month, Math.min(day, lastDayOfMonth(year, month))));
      if (key > end) break;
      if (key >= from && key >= start) out.push(key);
      if (repeat === "monthly") {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      } else {
        year += 1;
      }
    }
  }
  return out;
}
