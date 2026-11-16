// What MedicFox puts on the PlanFox calendar: the skill stations you
// practiced each day, and a station a planned study block can open.
// PlanFox loads this module on demand (see src/app/planLinks.js) and
// passes in MedicFox's saved data exactly as stored.
import { SKILLS, skillById } from "../data/skills.js";
import { normalizeData } from "../state/medicStore.js";
import { MODES } from "./sim.js";

export const skillHref = (id, mode = "crawl") => `/medic?tab=skills&skill=${encodeURIComponent(id)}&mode=${mode}`;
const modeName = id => MODES.find(m => m.id === id)?.name ?? id;

/** [{ id, day, title, detail, href, action, done }] for practice in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  // One line per station, pace and day, however many tries it took.
  const byKey = new Map();
  for (const h of data.history) {
    if (h.day < fromDay || h.day > toDay) continue;
    const key = `${h.day}:${h.skillId}:${h.mode}`;
    const prev = byKey.get(key);
    byKey.set(key, { ...h, tries: (prev?.tries ?? 0) + 1, pass: Boolean(prev?.pass || h.pass) });
  }
  return [...byKey.values()].map(h => ({
    id: `p:${h.day}:${h.skillId}:${h.mode}`,
    day: h.day,
    time: null,
    title: `${skillById.get(h.skillId).short} (${modeName(h.mode)})`,
    detail: `${h.tries} ${h.tries === 1 ? "try" : "tries"}${h.pass ? ", passed" : ""}`,
    href: skillHref(h.skillId, h.mode),
    action: "Practice",
    done: true,
  }));
}

/** Things in MedicFox a planner item can open: each skill station and the question bank. */
export function launchTargets() {
  return [
    { id: "quiz", title: "Practice questions", href: "/medic?tab=quiz" },
    ...SKILLS.map(s => ({ id: s.id, title: `Practice: ${s.short}`, href: skillHref(s.id) })),
  ];
}
