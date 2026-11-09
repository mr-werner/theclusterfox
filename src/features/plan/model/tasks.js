// Tasks for the Today view: quick-add parsing, what's due, and moving things.
import { addDays, occurrences, parseDay } from "./dates.js";

export const PRIORITIES = [
  { id: "high", name: "High", rank: 0 },
  { id: "normal", name: "Normal", rank: 1 },
  { id: "low", name: "Low", rank: 2 },
];
const rank = id => PRIORITIES.find(p => p.id === id)?.rank ?? 1;

// Kinds that get a checkbox.
export const CHECKABLE = ["task", "bill", "deadline"];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Next date (after today) that falls on this weekday. */
function nextWeekday(today, index) {
  const current = parseDay(today).getDay();
  const ahead = (index - current + 7) % 7 || 7;
  return addDays(today, ahead);
}

/**
 * "Call the dentist tomorrow !" → { title: "Call the dentist", day, priority: "high" }.
 * Understands today, tomorrow, weekday names (mon or monday, optionally
 * after "on" or "next"), and ! for high priority or ~ for low. Anything it
 * doesn't recognize stays in the title.
 */
export function parseQuickAdd(input, today) {
  let text = ` ${String(input ?? "").trim()} `;
  let day = today;
  let priority = "normal";

  if (/\s!+(?=\s)/.test(text)) {
    priority = "high";
    text = text.replace(/\s!+(?=\s)/g, " ");
  } else if (/\s~(?=\s)/.test(text)) {
    priority = "low";
    text = text.replace(/\s~(?=\s)/g, " ");
  }

  const words = [
    [/\s(?:on\s)?today(?=\s)/i, () => today],
    [/\s(?:on\s)?tomorrow(?=\s)/i, () => addDays(today, 1)],
    [/\s(?:on\s)?tmrw(?=\s)/i, () => addDays(today, 1)],
  ];
  let found = false;
  for (const [pattern, toDay] of words) {
    if (pattern.test(text)) {
      day = toDay();
      text = text.replace(pattern, " ");
      found = true;
      break;
    }
  }
  if (!found) {
    const weekday = /\s(?:(?:on|next|this)\s)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?(?=\s)/i;
    const match = text.match(weekday);
    if (match) {
      const index = WEEKDAYS.findIndex(name => name.startsWith(match[1].toLowerCase().slice(0, 3)));
      if (index >= 0) {
        day = nextWeekday(today, index);
        text = text.replace(weekday, " ");
      }
    }
  }

  return { title: text.replace(/\s+/g, " ").trim(), day, priority };
}

/**
 * Open checkable items for the Today list: anything due today, plus
 * one-off items left undone from the last month. Sorted overdue first, then
 * by priority, then by time.
 */
export function dueToday(items, today) {
  const out = [];
  for (const item of items) {
    if (!CHECKABLE.includes(item.kind)) continue;
    const days = occurrences(item, addDays(today, -30), today);
    for (const day of days) {
      const done = item.done.includes(day);
      const overdue = day < today;
      // Missed repeats roll forward on their own; only one-offs linger.
      if (overdue && (done || item.repeat !== "none")) continue;
      out.push({ ...item, itemId: item.id, id: `${item.id}@${day}`, day, done, overdue });
    }
  }
  return out.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      Number(b.overdue) - Number(a.overdue) ||
      rank(a.priority) - rank(b.priority) ||
      (a.time ?? "99").localeCompare(b.time ?? "99") ||
      a.title.localeCompare(b.title)
  );
}

/** Only one-off items can be dragged to a new day; repeats keep their pattern. */
export const canMove = item => Boolean(item) && (item.repeat ?? "none") === "none";

export function moveItem(item, day) {
  if (!canMove(item) || item.day === day) return item;
  return { ...item, day, done: item.done.filter(d => d !== item.day) };
}
