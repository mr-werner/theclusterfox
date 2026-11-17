// Small numbers StudyFox shows: streaks, how far along a deck is, times.
import { apps } from "../../../app/apps.js";
import { addDays } from "./dates.js";
import { reviewables } from "./exercises.js";
import { isMastered } from "./srs.js";

export const appInfo = id => apps.find(a => a.id === id) ?? { id, subtitle: id, icon: null };

/** Days in a row with some studying, ending today (or yesterday, if today hasn't started). */
export function streakOf(log, today) {
  const days = new Set(log.filter(e => e.n > 0).map(e => e.day));
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function deckStats(data, ref, deck, today) {
  if (!deck) return null;
  const keys = reviewables(deck).map(it => `${ref.app}:${ref.id}:${it.kind}:${it.id}`);
  let due = 0;
  let known = 0;
  let seen = 0;
  for (const k of keys) {
    const s = data.items[k];
    if (!s?.due) continue;
    seen += 1;
    if (s.due <= today) due += 1;
    if (isMastered(s)) known += 1;
  }
  return { total: keys.length, due, known, seen };
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
