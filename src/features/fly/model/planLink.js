// What PilotFox puts on the TaskFox calendar: each saved flight on its
// departure day, opening that flight in the planner. TaskFox loads this
// module on demand (see src/app/planLinks.js) with PilotFox's saved data.
import { normalizeData } from "../state/flyStore.js";

const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localTime = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export const flightHref = id => `/pilot?flight=${encodeURIComponent(id)}`;

/** [{ id, day, time, title, detail, href, action }] for flights departing in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const out = [];
  for (const f of data.flights) {
    if (!f.departAt) continue;
    const d = new Date(f.departAt);
    if (Number.isNaN(+d)) continue;
    const day = localDay(d);
    if (day < fromDay || day > toDay) continue;
    const via = f.route.length > 2 ? ` via ${f.route.slice(1, -1).map(p => p.id).join(", ")}` : "";
    out.push({
      id: f.id,
      day,
      time: localTime(d),
      title: `Fly ${f.route[0].id} → ${f.route[f.route.length - 1].id}`,
      detail: `${f.route[0].name} to ${f.route[f.route.length - 1].name}${via}${f.minutes ? `, about ${Math.round(f.minutes)} min` : ""}. Check weather and NOTAMs before you go.`,
      href: flightHref(f.id),
      action: "Brief",
    });
  }
  return out;
}

/** Things in PilotFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "plan", title: "Plan a flight", href: "/pilot" },
    { id: "winds", title: "Winds aloft", href: "/pilot?tab=winds" },
    { id: "study", title: "Study for a pilot test", href: "/pilot?tab=study" },
  ];
  if (!raw) return base;
  const data = normalizeData(raw);
  return [...base, ...data.flights.map(f => ({ id: f.id, title: f.title || f.route.map(p => p.id).join(" → "), href: flightHref(f.id) }))];
}
