// Spaced repetition. Each thing you study has a schedule: how many days
// until you see it again (ivl) and how quickly that gap grows (ease). Get
// it right and the gap stretches (1 day, then 3, then a week, a month...);
// miss it and it comes back today and starts over. This is the SM-2 idea
// that Anki and SuperMemo use, kept small.
import { addDays } from "./dates.js";

export const RATINGS = [
  { id: "again", name: "Again", hint: "Missed it" },
  { id: "hard", name: "Hard", hint: "Got it, barely" },
  { id: "good", name: "Good", hint: "Got it" },
  { id: "easy", name: "Easy", hint: "Too easy" },
];

const MIN_EASE = 1.3;
const MAX_IVL = 365;

/** A fresh schedule for something never studied. */
export const newState = () => ({ ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: null, last: null, first: null });

/** The schedule after answering on `today` with rating again | hard | good | easy. */
export function grade(state, rating, today) {
  const s = { ...newState(), ...(state ?? {}) };
  const first = s.first ?? today;
  let { ivl, ease, reps, lapses } = s;
  if (rating === "again") {
    // Back today, and the gap starts over tomorrow.
    return { ivl: 0, ease: Math.max(MIN_EASE, ease - 0.2), reps: 0, lapses: reps > 0 ? lapses + 1 : lapses, due: today, last: today, first };
  }
  if (reps === 0) ivl = rating === "easy" ? 4 : rating === "good" ? 1 : 1;
  else if (reps === 1 && ivl <= 1) ivl = rating === "easy" ? 6 : rating === "good" ? 3 : 2;
  else if (rating === "hard") ivl = Math.max(ivl + 1, ivl * 1.2);
  else if (rating === "good") ivl = Math.max(ivl + 1, ivl * ease);
  else ivl = Math.max(ivl + 2, ivl * ease * 1.3);
  if (rating === "hard") ease = Math.max(MIN_EASE, ease - 0.15);
  if (rating === "easy") ease += 0.15;
  ivl = Math.min(MAX_IVL, Math.round(ivl));
  return { ivl, ease: Math.round(ease * 100) / 100, reps: reps + 1, lapses, due: addDays(today, ivl), last: today, first };
}

/** When each rating would bring it back, for the buttons ("1d", "3d"). */
export function preview(state, today) {
  return Object.fromEntries(RATINGS.map(r => [r.id, grade(state, r.id, today).ivl]));
}

export const gapLabel = days => (days <= 0 ? "now" : days < 30 ? `${days}d` : days < 365 ? `${Math.round(days / 30)}mo` : `${Math.round(days / 365)}y`);

/** True once the gap is three weeks or more: you know it. */
export const isMastered = state => Boolean(state && state.ivl >= 21);
