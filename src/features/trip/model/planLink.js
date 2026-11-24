// What TripFox puts on the TaskFox calendar: each trip with dates shows on
// every day of the trip with what's planned that day, opening that day in
// TripFox. TaskFox loads this module on demand (see src/app/planLinks.js).
import { normalizeData, tripTitle } from "../state/tripStore.js";
import { fmtTime, tripDays } from "./days.js";

export const tripHref = (id, tab) => `/trip?trip=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ""}`;

/** [{ id, day, time, title, detail, href, action }] for trip days in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const out = [];
  for (const t of data.trips) {
    const days = tripDays(t);
    days.forEach((day, i) => {
      if (day < fromDay || day > toDay) return;
      const planned = t.plan.filter(p => p.day === day).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
      const first = i === 0;
      const last = i === days.length - 1 && days.length > 1;
      const label = first ? "leave" : last ? "head home" : `day ${i + 1}`;
      const list = planned.slice(0, 3).map(p => (p.time ? `${fmtTime(p.time)} ${p.title}` : p.title));
      out.push({
        id: `${t.id}:${day}`,
        day,
        time: null,
        title: `${tripTitle(t)}: ${label}`,
        detail: list.length ? `${list.join(" · ")}${planned.length > 3 ? " …" : ""}` : t.stay ? `Staying at ${t.stay.name}.` : "Nothing planned yet.",
        href: `${tripHref(t.id, "days")}&day=${day}`,
        action: "Open",
      });
    });
  }
  return out;
}

/** Things in TripFox a planner item can open. */
export function launchTargets(raw) {
  const base = [{ id: "new", title: "Plan a new trip", href: "/trip?new=1" }];
  if (!raw) return base;
  return [...base, ...normalizeData(raw).trips.map(t => ({ id: t.id, title: tripTitle(t), href: tripHref(t.id) }))];
}
