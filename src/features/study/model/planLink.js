// What StudyFox puts on the PlanFox calendar: the review due each day, at
// the study time you picked, so PlanFox can remind you when it's time.
// Days you studied show as done. PlanFox loads this on demand (see
// src/app/planLinks.js) and passes in StudyFox's saved data as stored.
import { normalizeData } from "../state/studyStore.js";
import { addDays } from "./dates.js";

export const REVIEW_HREF = "/study?review=1";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** [{ id, day, time, title, detail, href, action, done }] in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay, today = undefined) {
  if (!raw) return [];
  const data = normalizeData(raw);
  if (!data.decks.length && !data.log.length) return [];
  const now = today ?? localToday();
  const decksOn = new Set(data.decks.map(d => `${d.app}:${d.id}`));
  const onShelf = key => decksOn.has(key.split(":").slice(0, 2).join(":"));

  // How many scheduled things come due on each day (anything overdue counts today).
  const dueOn = new Map();
  for (const [key, s] of Object.entries(data.items)) {
    if (!s.due || !onShelf(key)) continue;
    const day = s.due < now ? now : s.due;
    dueOn.set(day, (dueOn.get(day) ?? 0) + 1);
  }

  const out = [];
  const logged = new Map(data.log.map(e => [e.day, e]));
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const done = logged.get(day);
    const due = day >= now ? dueOn.get(day) ?? 0 : 0;
    if (done && done.n > 0 && (day < now || due === 0)) {
      out.push({ id: `done:${day}`, day, time: null, title: `Studied ${plural(done.n, "card")}`, detail: `${Math.round((done.right / done.n) * 100)}% right`, href: REVIEW_HREF, action: "Review", done: true });
      continue;
    }
    if (day < now || !data.settings.remind) continue;
    if (due > 0) {
      out.push({ id: `review:${day}`, day, time: data.settings.time, title: `Review ${plural(due, "card")}`, detail: "Spaced review in StudyFox", href: REVIEW_HREF, action: "Study" });
    } else if (day === now && data.decks.length) {
      out.push({ id: `review:${day}`, day, time: data.settings.time, title: "Learn something new", detail: `${plural(data.decks.length, "deck")} on your StudyFox shelf`, href: REVIEW_HREF, action: "Study" });
    }
  }
  return out;
}

/** Things in StudyFox a planner item can open: today's review and each deck. */
export function launchTargets(raw) {
  const data = normalizeData(raw);
  return [
    { id: "review", title: "Today's review", href: REVIEW_HREF },
    ...data.decks.map(d => ({ id: `${d.app}:${d.id}`, title: `Study: ${d.title}`, href: `/study?deck=${encodeURIComponent(`${d.app}:${d.id}`)}` })),
  ];
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
