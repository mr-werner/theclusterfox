// What SnowFox puts on the TaskFox calendar: each planned ski day, opening
// that mountain's conditions for that day. TaskFox loads this module on
// demand (see src/app/planLinks.js) with SnowFox's saved data.
import { normalizeData } from "../state/snowStore.js";
import { RESORTS } from "../data/resorts.js";
import { BACKCOUNTRY } from "../data/backcountry.js";

export const spotHref = (id, day) => `/snow?spot=${encodeURIComponent(id)}${day ? `&day=${day}` : ""}`;

function nameOf(data, id) {
  return RESORTS.find(r => r.id === id)?.name ?? BACKCOUNTRY.find(b => b.id === id)?.name ?? data.custom.find(c => c.id === id)?.name ?? null;
}

/** [{ id, day, time, title, detail, href, action }] for ski days in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  return data.trips
    .filter(t => t.day >= fromDay && t.day <= toDay)
    .map(t => {
      const name = t.name || nameOf(data, t.spot) || "the mountain";
      const backcountry = BACKCOUNTRY.some(b => b.id === t.spot);
      return {
        id: t.id,
        day: t.day,
        time: t.time,
        title: `${backcountry ? "Tour" : "Ski"} ${name}`,
        detail: t.note || (backcountry ? "Read the avalanche forecast and check snow and wind before you go." : "Check new snow, wind holds and the roads before you go."),
        href: spotHref(t.spot, t.day),
        action: "Conditions",
      };
    });
}

/** Things in SnowFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "mountains", title: "Snow report", href: "/snow" },
    { id: "backcountry", title: "Backcountry & avalanche", href: "/snow?tab=backcountry" },
  ];
  if (!raw) return base;
  const data = normalizeData(raw);
  const favs = data.favorites.filter(id => nameOf(data, id)).map(id => ({ id: `fav-${id}`, title: `${nameOf(data, id)} conditions`, href: spotHref(id) }));
  return [...base, ...favs];
}
