// What RoadTripFox puts on the PlanFox calendar: each saved trip with a start
// date shows on every day of the drive, opening that trip. PlanFox loads
// this module on demand (see src/app/planLinks.js) with RoadTripFox's data.
import { addDays, normalizeData } from "../state/roadStore.js";
import { fmtMinutes } from "./geo.js";

export const tripHref = id => `/roadtrip?trip=${encodeURIComponent(id)}`;

/** [{ id, day, title, detail, href, action }] for trip days in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const out = [];
  for (const t of data.trips) {
    if (!t.departDate) continue;
    const days = t.days.length ? t.days : [{ driveMinutes: t.minutes, stopMinutes: 0, endName: "", stopNames: [] }];
    days.forEach((d, i) => {
      const day = addDays(t.departDate, i);
      if (day < fromDay || day > toDay) return;
      const last = i === days.length - 1;
      const to = last ? t.to.name : d.endName || `night ${i + 1}`;
      const stops = d.stopNames.length ? ` Stops: ${d.stopNames.slice(0, 3).join(", ")}${d.stopNames.length > 3 ? "…" : ""}.` : "";
      out.push({
        id: `${t.id}:${i}`,
        day,
        time: null,
        title: days.length > 1 ? `Road trip day ${i + 1}: to ${to}` : `Road trip: ${t.from.name} to ${t.to.name}`,
        detail: `About ${fmtMinutes(d.driveMinutes)} of driving.${stops}`,
        href: `${tripHref(t.id)}${days.length > 1 ? `&day=${i + 1}` : ""}`,
        action: i === 0 ? "Go" : "Open",
      });
    });
  }
  return out;
}

/** Things in RoadTripFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "plan", title: "Plan a road trip", href: "/roadtrip" },
    { id: "pack", title: "Packing list for the weather", href: "/roadtrip?tab=pack" },
    { id: "fuel", title: "Gas and charging stops", href: "/roadtrip?tab=fuel" },
    { id: "games", title: "Car games", href: "/roadtrip?tab=games" },
  ];
  if (!raw) return base;
  return [...base, ...normalizeData(raw).trips.map(t => ({ id: t.id, title: t.title, href: tripHref(t.id) }))];
}
