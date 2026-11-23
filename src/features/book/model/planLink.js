// What BookFox puts on the PlanFox calendar: the books you read each day
// (how long, and how far you got), and the books a planned reading block
// can open. PlanFox loads this module on demand (see src/app/planLinks.js)
// and passes in BookFox's saved data exactly as stored.
import { normalizeData } from "../state/bookStore.js";

export const readHref = key => `/books?read=${encodeURIComponent(key)}`;
const pct = v => `${Math.round(v * 100)}%`;

/** [{ id, day, title, detail, href, action, done }] for reading in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  return data.sessions
    .filter(s => s.day >= fromDay && s.day <= toDay && s.secs >= 30 && data.books[s.book])
    .map(s => {
      const mins = Math.max(1, Math.round(s.secs / 60));
      const moved = s.to > s.from + 0.001 ? `, ${pct(s.from)} to ${pct(s.to)}` : "";
      return {
        id: `r:${s.day}:${s.book}`,
        day: s.day,
        time: null,
        title: `Read ${data.books[s.book].title}`,
        detail: `${mins} min${moved}`,
        href: readHref(s.book),
        action: "Keep reading",
        done: true,
      };
    });
}

/** Things in BookFox a planner item can open: each book you're reading or want to. */
export function launchTargets(raw) {
  const data = normalizeData(raw);
  const books = Object.entries(data.books)
    .filter(([, b]) => b.shelf !== "done")
    .sort(([, a], [, b]) => (b.opened ?? b.added ?? "").localeCompare(a.opened ?? a.added ?? ""));
  return [{ id: "store", title: "Browse free books", href: "/books" }, ...books.map(([key, b]) => ({ id: key, title: `Read ${b.title}`, href: readHref(key) }))];
}
