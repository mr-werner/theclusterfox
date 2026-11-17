// What KeysFox puts on the PlanFox calendar: the songs you practiced each
// day, and songs a planned practice block can open.
// PlanFox loads this module on demand (see src/app/planLinks.js).
import { SONGS, songById } from "../data/songs.js";
import { normalizeData } from "../state/keysStore.js";

export const songHref = (id, { level, hands } = {}) => {
  const p = new URLSearchParams({ song: id });
  if (level) p.set("level", level);
  if (hands) p.set("hands", hands);
  return `/piano?${p}`;
};

const handName = h => (h === "R" ? "right hand" : h === "L" ? "left hand" : "both hands");

/** [{ id, day, title, detail, href, action, done }] for practice in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const byKey = new Map();
  for (const r of data.history) {
    if (r.day < fromDay || r.day > toDay) continue;
    const key = `${r.day}:${r.songId}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      ...r,
      runs: (prev?.runs ?? 0) + 1,
      seconds: (prev?.seconds ?? 0) + r.seconds,
      stars: Math.max(prev?.stars ?? 0, r.stars),
    });
  }
  return [...byKey.values()].map(r => {
    const title = songById.get(r.songId)?.title ?? (r.title || "Your song");
    const mins = Math.max(1, Math.round(r.seconds / 60));
    return {
      id: `k:${r.day}:${r.songId}`,
      day: r.day,
      time: null,
      title: `Piano: ${title}`,
      detail: `${mins} min, ${r.runs} ${r.runs === 1 ? "run" : "runs"}, ${handName(r.hands)}${r.stars ? `, ${"★".repeat(r.stars)}` : ""}`,
      href: songHref(r.songId, { level: r.level, hands: r.hands }),
      action: "Practice",
      done: true,
    };
  });
}

/** Things in KeysFox a planner item can open. */
export function launchTargets() {
  return [{ id: "library", title: "Piano practice", href: "/piano" }, ...SONGS.map(s => ({ id: s.id, title: `Practice: ${s.title}`, href: songHref(s.id) }))];
}
