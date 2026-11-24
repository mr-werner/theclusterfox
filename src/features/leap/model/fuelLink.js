// What the diet planner needs from LeapFox: each plan session, how long it
// is and how hard (as METs), shaped like the planner's other training sources.

import { normalizeData } from "../state/leapStore.js";
import { allSessions, buildPlan } from "./program.js";


// Plyometrics with lifting run around 6–8 METs (Compendium: jumping drills,
// circuit training); a test day is mostly rest between efforts.
const MET = { power: 6, speed: 7, elastic: 6.5, sport: 5, test: 4 };

export function leapWorkouts(raw, from, to) {
  if (!raw) return [];
  const data = normalizeData(raw);
  if (!data.plan) return [];
  const plan = buildPlan(data.plan.options);
  return allSessions(plan)
    .filter(s => s.day >= from && s.day <= to)
    .map(s => ({
      id: `leap:${data.plan.id}:${s.id}`,
      day: s.day,
      source: "leapfox",
      title: `Jump training: ${s.name}`,
      minutes: s.minutes,
      met: MET[s.type] ?? 6,
      kind: "strength",
      href: `/leap?tab=train&session=${encodeURIComponent(s.id)}`,
      done: Boolean(data.plan.done[s.id]),
    }));
}
