import { canDo, exercises, exercisesById } from "../data/exercises.js";
import { muscleName, musclesById, REGIONS } from "../data/muscles.js";

// How each goal is trained. Seconds are rough averages used to fit the time.
export const GOALS = {
  strength: {
    name: "Strength", blurb: "Lift heavier. Fewer reps, more rest.",
    sets: [3, 4, 5], reps: "4–6", hold: 30, workSec: 30, restSec: 150,
  },
  size: {
    name: "Size", blurb: "Build muscle. Moderate weight, 8–12 reps.",
    sets: [3, 3, 4], reps: "8–12", hold: 40, workSec: 40, restSec: 75,
  },
  stamina: {
    name: "Stamina", blurb: "Last longer. Light weight, lots of reps, short rests.",
    sets: [2, 3, 3], reps: "15–20", hold: 45, workSec: 50, restSec: 40,
  },
};

export const LEVELS = [
  { id: 1, name: "Beginner" },
  { id: 2, name: "Intermediate" },
  { id: 3, name: "Advanced" },
];

export const DURATIONS = [15, 20, 30, 45, 60, 75, 90];

export const FULL_BODY = ["chest", "lats", "quads", "hamstrings", "glutes", "shoulders", "abs"];

const TRANSITION_SEC = 60;
const MAX_EXERCISES = 10;

// Small seeded random so "shuffle" gives a new mix and plans stay stable.
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function warmupMinutes(minutes) {
  return minutes >= 30 ? 5 : minutes >= 20 ? 4 : 2;
}

export function cooldownMinutes(minutes) {
  return minutes >= 45 ? 4 : minutes >= 20 ? 3 : 1;
}

// Seconds an exercise takes with this many sets.
export function itemSeconds(item, goal) {
  const exercise = exercisesById.get(item.exerciseId);
  const g = GOALS[goal] ?? GOALS.size;
  const work = (exercise?.timed ? item.seconds ?? g.hold : g.workSec) * (exercise?.perSide ? 2 : 1);
  return item.sets * work + (item.sets - 1) * (item.restSec ?? g.restSec) + TRANSITION_SEC;
}

export function estimateMinutes(workout) {
  const seconds = workout.items.reduce((sum, item) => sum + itemSeconds(item, workout.goal), 0);
  return Math.round(seconds / 60 + warmupMinutes(workout.minutes) + cooldownMinutes(workout.minutes));
}

function prescription(exercise, goal, level, sets) {
  const g = GOALS[goal] ?? GOALS.size;
  const timed = exercise.timed;
  // Core work and isolation moves don't need strength-style low reps.
  const reps = goal === "strength" && exercise.kind !== "compound" ? "8–10" : g.reps;
  return {
    exerciseId: exercise.id,
    sets: sets ?? g.sets[level - 1] ?? 3,
    reps: timed ? null : reps,
    seconds: timed ? g.hold + (level - 1) * 10 : null,
    restSec: exercise.kind === "compound" ? g.restSec : Math.round(g.restSec * 0.7),
    perSide: exercise.perSide,
  };
}

const KIND_ORDER = { compound: 0, isolation: 1, core: 2 };

export function availableExercises({ gear = [], level = 1 }) {
  return exercises.filter(e => canDo(e, gear) && e.level <= level);
}

/**
 * Builds one workout that hits the chosen muscles in the time available.
 * weights (optional) gives some muscles more attention than others.
 */
export function generateWorkout({ muscles = [], goal = "size", minutes = 45, gear = [], level = 1, seed = 1, weights = {}, exclude = [] }) {
  const targets = muscles.filter(m => musclesById.has(m));
  const focus = targets.length ? targets : FULL_BODY;
  const g = GOALS[goal] ?? GOALS.size;
  const random = seededRandom(seed);
  const pool = availableExercises({ gear, level }).filter(e => !exclude.includes(e.id));

  const need = Object.fromEntries(focus.map(m => [m, weights[m] ?? 1]));
  const budget = (minutes - warmupMinutes(minutes) - cooldownMinutes(minutes)) * 60;
  const picked = [];
  let used = 0;

  while (picked.length < MAX_EXERCISES) {
    let best = null;
    for (const exercise of pool) {
      if (picked.some(p => p.exercise.id === exercise.id)) continue;
      const hits = exercise.primary.filter(m => m in need);
      if (!hits.length) continue;
      let score = hits.reduce((s, m) => s + need[m] * 2, 0);
      score += exercise.secondary.filter(m => m in need).reduce((s, m) => s + need[m] * 0.4, 0);
      score -= (exercise.primary.length - hits.length) * 0.6;
      if (exercise.kind === "compound") score += goal === "strength" ? 0.8 : 0.3;
      if (goal === "stamina" && exercise.kind !== "compound") score += 0.2;
      // Prefer the gear people chose over bodyweight when they have it.
      score += Math.min(exercise.gear.length, 1) * 0.35;
      if (picked.some(p => p.exercise.demo === exercise.demo)) score -= 1.6;
      // Match the challenge to the person.
      score -= Math.abs(level - exercise.level) * 0.35;
      score += random() * 0.9;
      if (!best || score > best.score) best = { exercise, score };
    }
    if (!best) break;

    const item = prescription(best.exercise, goal, level);
    const cost = itemSeconds(item, goal);
    if (used + cost > budget) {
      // Squeeze in a shorter version if a little time is left.
      const short = { ...item, sets: 2 };
      if (picked.length === 0 || used + itemSeconds(short, goal) <= budget) {
        picked.push({ exercise: best.exercise, item: short });
        used += itemSeconds(short, goal);
      }
      break;
    }
    picked.push({ exercise: best.exercise, item });
    used += cost;
    for (const m of best.exercise.primary) if (m in need) need[m] *= 0.45;
    for (const m of best.exercise.secondary) if (m in need) need[m] *= 0.85;
  }

  // Spare time goes into extra sets on the main lifts.
  const maxSets = Math.min(5, (g.sets[level - 1] ?? 3) + 1);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of picked) {
      if (p.item.sets >= maxSets) continue;
      const extra = itemSeconds({ ...p.item, sets: p.item.sets + 1 }, goal) - itemSeconds(p.item, goal);
      if (used + extra <= budget) {
        p.item.sets += 1;
        used += extra;
        grew = true;
      }
    }
  }

  picked.sort((a, b) => KIND_ORDER[a.exercise.kind] - KIND_ORDER[b.exercise.kind]);
  const items = picked.map(p => ({ ...p.item, done: Array(p.item.sets).fill(false), load: "" }));
  const workout = {
    goal,
    minutes,
    muscles: targets,
    gear,
    level,
    seed,
    warmup: warmupFor(focus, items, minutes),
    cooldown: cooldownFor(focus, minutes),
    items,
  };
  return { ...workout, estMinutes: estimateMinutes(workout) };
}

// Other exercises that work the same muscle with the same gear.
export function alternatives(exerciseId, { gear = [], level = 1, skip = [] }) {
  const current = exercisesById.get(exerciseId);
  if (!current) return [];
  return availableExercises({ gear, level: Math.max(level, current.level) })
    .filter(e => e.id !== exerciseId && !skip.includes(e.id) && e.primary.some(m => current.primary.includes(m)))
    .sort((a, b) => b.primary.filter(m => current.primary.includes(m)).length - a.primary.filter(m => current.primary.includes(m)).length);
}

export function swapItem(item, exerciseId, goal, level) {
  const exercise = exercisesById.get(exerciseId);
  const next = prescription(exercise, goal, level, item.sets);
  return { ...next, done: Array(next.sets).fill(false), load: "" };
}

const REGION_WARMUPS = {
  upper: "Arm circles and band or towel pull-aparts, 30 seconds each",
  arms: "Wrist rolls and light arm swings, 30 seconds",
  core: "Cat-cow and slow hip circles, 30 seconds each",
  lower: "Bodyweight squats and leg swings, 10 each side",
};

function warmupFor(focus, items, minutes) {
  const regions = [...new Set(focus.map(m => musclesById.get(m).region))];
  const steps = [`Easy cardio for ${minutes >= 30 ? "2–3 minutes" : "1 minute"}: march, jog in place, jumping jacks or a bike`];
  for (const r of regions) steps.push(REGION_WARMUPS[r]);
  const first = items[0] && exercisesById.get(items[0].exerciseId);
  if (first && first.gear.length) steps.push(`One light set of ${first.name.toLowerCase()} with about half your working weight`);
  return steps;
}

const STRETCHES = {
  chest: "Doorway chest stretch",
  shoulders: "Cross-body shoulder stretch",
  traps: "Gentle neck tilt, ear toward shoulder",
  lats: "Hang or reach overhead and lean to each side",
  biceps: "Wall biceps stretch, palm flat behind you",
  triceps: "Overhead triceps stretch",
  forearms: "Wrist flexor stretch, fingers pulled back",
  abs: "Cobra stretch on the floor",
  obliques: "Standing side bend",
  lowerBack: "Child's pose",
  glutes: "Figure-four glute stretch",
  quads: "Standing quad stretch, heel to glute",
  hamstrings: "Seated toe reach",
  calves: "Wall calf stretch",
};

function cooldownFor(focus, minutes) {
  const hold = minutes >= 45 ? "45 seconds" : "30 seconds";
  return focus.slice(0, 6).map(m => `${STRETCHES[m]} (${muscleName(m).toLowerCase()}), ${hold}`);
}

// "Chest & biceps", or region names when lots are picked.
export function workoutTitle(muscles) {
  if (!muscles.length) return "Full body";
  if (muscles.length <= 3) {
    const names = muscles.map(muscleName);
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names.at(-1).toLowerCase()}`;
  }
  const regions = REGIONS.filter(r => muscles.some(m => musclesById.get(m)?.region === r.id)).map(r => r.name.toLowerCase());
  if (regions.length === REGIONS.length) return "Full body";
  const text = regions.length === 1 ? regions[0] : `${regions.slice(0, -1).join(", ")} & ${regions.at(-1)}`;
  return text[0].toUpperCase() + text.slice(1);
}
