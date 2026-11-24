// What TrailFox puts on the TaskFox calendar: each planned hike on its
// day and start time, opening that trail's plan (weather, start times and
// gear) in TrailFox. TaskFox loads this module on demand (see
// src/app/planLinks.js) with TrailFox's saved data.
import { normalizeData } from "../state/hikeStore.js";
import { summarize } from "./profile.js";

const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const trailHref = id => `/hike?trail=${encodeURIComponent(id)}`;

const durationText = min => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/** [{ id, day, time, title, detail, href, action }] for hikes planned in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const out = [];
  for (const t of data.trails) {
    if (!t.plan || t.plan.day < fromDay || t.plan.day > toDay) continue;
    const s = t.profile.length > 1 ? summarize(t.profile, t.shape, data.pace, t.sac) : null;
    const miles = s ? (data.units === "metric" ? `${(s.distanceM / 1000).toFixed(1)} km` : `${(s.distanceM / 1609.344).toFixed(1)} mi`) : null;
    out.push({
      id: `hike-${t.id}`,
      day: t.plan.day,
      time: t.plan.start,
      title: `Hike ${t.name}`,
      detail: [miles, s ? `about ${durationText(s.minutes)}` : null, s ? s.difficulty.name.toLowerCase() : null].filter(Boolean).join(", ") + ". Check the forecast and pack list before you go.",
      href: trailHref(t.id),
      action: "Go",
      done: data.hikes.some(h => h.trailId === t.id && localDay(new Date(h.startedAt * 1000)) === t.plan.day),
    });
  }
  return out;
}

/** Things in TrailFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "find", title: "Find a trail", href: "/hike" },
    { id: "saved", title: "Saved trails and hikes", href: "/hike?tab=saved" },
  ];
  if (!raw) return base;
  const data = normalizeData(raw);
  return [...base, ...data.trails.filter(t => t.saved || t.plan).map(t => ({ id: t.id, title: t.name, href: trailHref(t.id) }))];
}
