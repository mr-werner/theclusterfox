// Training the diet planner eats for. Workouts come from the training apps
// (LiftFox for strength, PaceFox for running, riding and rowing; each adds its own reader to SOURCES) and
// from workouts typed into the planner. A training day gets more calories,
// more carbs, and a note on when to eat.

import { normalizeData as normalizeLift } from "../../lift/state/liftStore.js";
import { sessionDate } from "../../lift/model/program.js";
import { paceWorkouts } from "../../pace/model/fuelLink.js";

// Intensity of a LiftFox plan session, as METs (Compendium values for
// resistance training: circuit work runs higher, an easy week lower).
const LIFT_MET = { strength: 5, size: 5, general: 5, stamina: 6 };
const DELOAD_MET = 3.5;

export const PRESETS = [
  { id: "walk", label: "Walk", met: 3.5, kind: "cardio" },
  { id: "run", label: "Run", met: 9.8, kind: "cardio" },
  { id: "ride", label: "Bike ride", met: 7.5, kind: "cardio" },
  { id: "swim", label: "Swim", met: 7, kind: "cardio" },
  { id: "lift", label: "Weights", met: 5, kind: "strength" },
  { id: "hiit", label: "HIIT class", met: 8, kind: "cardio" },
  { id: "sport", label: "Sports", met: 7, kind: "cardio" },
  { id: "yoga", label: "Yoga", met: 2.5, kind: "easy" },
];
export const presetsById = new Map(PRESETS.map(p => [p.id, p]));

/**
 * LiftFox plan sessions between two days (inclusive), from its saved data
 * exactly as stored. [{ id, day, source, title, minutes, met, kind, href, done }]
 */
export function liftWorkouts(raw, from, to) {
  if (!raw) return [];
  const data = normalizeLift(raw);
  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
  const out = [];
  if (plan?.program.startDate) {
    const { program, completed } = plan;
    for (const week of program.schedule) {
      for (const session of week.sessions) {
        const day = sessionDate(program, week.index, session.weekday);
        if (!day || day < from || day > to) continue;
        out.push({
          id: `lift:${plan.id}:${session.id}`,
          day,
          source: "liftfox",
          title: session.name,
          minutes: program.minutes,
          met: week.deload ? DELOAD_MET : LIFT_MET[program.goal] ?? 5,
          kind: program.goal === "stamina" ? "cardio" : "strength",
          easy: week.deload,
          href: `/lift?plan=${encodeURIComponent(plan.id)}&session=${encodeURIComponent(session.id)}`,
          done: Boolean(completed[session.id]),
        });
      }
    }
  }
  // Workouts done outside the plan still burned energy.
  for (const h of data.history) {
    const day = h.date.slice(0, 10);
    if (day < from || day > to || (h.planId && h.sessionId)) continue;
    out.push({ id: `lifth:${h.id}`, day, source: "liftfox", title: h.title, minutes: h.minutes || 45, met: LIFT_MET[h.goal] ?? 5, kind: "strength", href: "/lift?tab=history", done: true });
  }
  return out;
}

// Each training app the planner reads: its storage key and a reader.
export const SOURCES = [
  { app: "liftfox", name: "LiftFox", storageKey: "liftfox-data-v1", read: liftWorkouts },
  { app: "pacefox", name: "PaceFox", storageKey: "pacefox-data-v1", read: paceWorkouts },
];

/** Workouts typed into the planner, shaped like the ones from the apps. */
export function ownWorkouts(list, from, to) {
  return list
    .filter(w => w.day >= from && w.day <= to)
    .map(w => {
      const preset = presetsById.get(w.preset);
      return { id: `own:${w.id}`, ownId: w.id, day: w.day, source: "own", title: preset?.label ?? "Workout", minutes: w.minutes, met: preset?.met ?? 5, kind: preset?.kind ?? "cardio" };
    });
}

/** Map of day -> workouts, from every source. readRaw(key) returns stored JSON or null. */
export function workoutsByDay(readRaw, own, from, to) {
  const all = [...SOURCES.flatMap(s => s.read(readRaw(s.storageKey), from, to)), ...ownWorkouts(own, from, to)];
  const map = new Map();
  for (const w of all) map.set(w.day, [...(map.get(w.day) ?? []), w]);
  return map;
}

/** When and what to eat around the day's training. */
export function fuelNote(workouts) {
  if (!workouts?.length) return null;
  const minutes = workouts.reduce((n, w) => n + w.minutes, 0);
  const strength = workouts.some(w => w.kind === "strength");
  const cardio = workouts.some(w => w.kind === "cardio");
  const tips = [];
  if (cardio && minutes >= 75) tips.push("Over an hour of hard work: eat a carb-rich meal 3–4 hours before and bring a snack or sports drink.");
  else if (cardio) tips.push("Carbs are the fuel here. Have a carb-rich meal 2–3 hours before.");
  if (strength) tips.push("Get 25–40 g of protein within a couple of hours after lifting, and some carbs before so the session feels strong.");
  if (workouts.every(w => w.easy || w.kind === "easy")) return "An easy day. Eat as usual, no extra fuel needed.";
  return tips.join(" ");
}
