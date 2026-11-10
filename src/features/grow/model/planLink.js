// What GrowFox puts on the PlanFox calendar: the garden jobs due each day,
// each one opening straight to that job in GrowFox. PlanFox loads this
// module on demand (see src/app/planLinks.js) and passes in GrowFox's
// saved data exactly as stored.
import { plantsById } from "../data/plants.js";
import { normalizeData } from "../state/growStore.js";
import { effectiveClimate } from "./climate.js";
import { dayTasks, KINDS } from "./care.js";
import { dayNum, dayKey } from "./dates.js";

const MAX_DAYS = 120;

export const taskHref = (id, day) => `/grow?task=${encodeURIComponent(id)}&day=${day}`;

/** [{ id, day, time, title, detail, href, action, done }] for every day in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const climate = effectiveClimate(data);
  if (!climate || !data.garden.length) return [];
  const from = dayNum(fromDay);
  const to = Math.min(dayNum(toDay), from + MAX_DAYS);
  const out = [];
  for (let d = from; d <= to; d++) {
    const day = dayKey(d);
    for (const t of dayTasks(data.garden, plantsById, climate, day, data.prefs)) {
      out.push({ id: t.id, day, time: null, title: t.title, detail: t.note.slice(0, 120), href: taskHref(t.id, day), action: t.kind === "plant" ? "Plant" : KINDS[t.kind]?.name ?? "Open", done: Boolean(data.done[t.id]) });
    }
  }
  return out;
}

/** Things in GrowFox a planner item can open: each plant in your garden. */
export function launchTargets(raw) {
  if (!raw) return [{ id: "today", title: "Today's garden jobs", href: "/grow" }];
  const data = normalizeData(raw);
  return [
    { id: "today", title: "Today's garden jobs", href: "/grow" },
    ...data.garden.map(e => ({ id: e.id, title: e.name || plantsById.get(e.plantId).name, href: `/grow?entry=${encodeURIComponent(e.id)}` })),
  ];
}
