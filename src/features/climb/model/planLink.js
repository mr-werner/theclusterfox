// What ClimbFox puts on the TaskFox calendar: each planned climbing day,
// opening that plan with its routes, forecast and gear list. TaskFox loads
// this module on demand (see src/app/planLinks.js) with ClimbFox's data.
import { normalizeData } from "../state/climbStore.js";

export const tripHref = id => `/climb?tab=plan&trip=${encodeURIComponent(id)}`;
export const areaHref = uuid => `/climb?area=${encodeURIComponent(uuid)}`;
export const routeHref = uuid => `/climb?route=${encodeURIComponent(uuid)}`;

/** [{ id, day, time, title, detail, href, action, done }] for planned days in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const tickedOn = new Set(data.ticks.map(t => `${t.date}|${t.uuid}`));
  return data.trips
    .filter(t => t.day >= fromDay && t.day <= toDay)
    .map(t => {
      const names = t.routes.slice(0, 4).map(r => r.name);
      const more = t.routes.length > 4 ? ` and ${t.routes.length - 4} more` : "";
      return {
        id: t.id,
        day: t.day,
        time: t.time,
        title: t.title,
        detail: names.length ? `${t.area.name}: ${names.join(", ")}${more}. Check conditions before you drive.` : `${t.area.name}. Check conditions before you drive.`,
        href: tripHref(t.id),
        action: "Open plan",
        done: t.routes.some(r => tickedOn.has(`${t.day}|${r.uuid}`)),
      };
    });
}

/** Things in ClimbFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "explore", title: "Find a crag", href: "/climb" },
    { id: "plan", title: "Plan a climbing day", href: "/climb?tab=plan" },
    { id: "log", title: "My climbs", href: "/climb?tab=log" },
  ];
  if (!raw) return base;
  const data = normalizeData(raw);
  return [
    ...base,
    ...data.saved.map(a => ({ id: `a:${a.uuid}`, title: a.name, href: areaHref(a.uuid) })),
    ...data.trips.map(t => ({ id: `t:${t.id}`, title: t.title, href: tripHref(t.id) })),
  ];
}
