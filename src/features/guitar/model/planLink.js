// What FretFox puts on the TaskFox calendar: the songs you practiced each
// day, and songs a planned practice block can open. TaskFox loads this
// module on demand (see src/app/planLinks.js) and passes in FretFox's
// saved data exactly as stored.
import { SONGS, EXERCISES } from "../data/songs.js";
import { normalizeData } from "../state/guitarStore.js";

export const songHref = (id, part, level) => {
  const q = new URLSearchParams({ song: id });
  if (part) q.set("part", part);
  if (level) q.set("level", level);
  return `/guitar?${q}`;
};
const PART_NAME = { lead: "melody", rhythm: "chords", both: "fingerstyle" };

/** [{ id, day, title, detail, href, action, done }] for practice in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  return data.history
    .filter(h => h.day >= fromDay && h.day <= toDay)
    .map(h => ({
      id: `p:${h.id}`,
      day: h.day,
      time: null,
      title: h.title || "Guitar practice",
      detail: [`${PART_NAME[h.part]}, ${h.level}`, h.minutes >= 1 ? `${Math.round(h.minutes)} min` : null, h.accuracy != null ? `${h.accuracy}%` : null].filter(Boolean).join(" · "),
      href: songHref(h.songId, h.part, h.level),
      action: "Practice",
      done: true,
    }));
}

/** Things in FretFox a planner item can open. */
export function launchTargets(raw) {
  const data = raw ? normalizeData(raw) : null;
  return [
    { id: "tuner", title: "Tune your guitar", href: "/guitar?tab=tuner" },
    { id: "chords", title: "Chord library", href: "/guitar?tab=chords" },
    ...[...SONGS, ...EXERCISES].map(s => ({ id: s.id, title: `Practice: ${s.title}`, href: songHref(s.id) })),
    ...(data?.songs ?? []).map(s => ({ id: s.id, title: `Practice: ${s.title}`, href: songHref(s.id) })),
  ];
}
