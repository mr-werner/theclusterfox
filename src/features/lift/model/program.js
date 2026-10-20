import { generateWorkout, GOALS } from "./generate.js";
import { musclesById } from "../data/muscles.js";

// Long-term plans: a weekly split, blocks of four weeks that get a little
// harder each week, and an easy (deload) week to finish every block.

export const PLAN_GOALS = {
  strength: { name: "Get stronger", blurb: "Heavier lifts over time.", train: "strength", reps: ["6–8", "4–6", "3–5"] },
  size: { name: "Build muscle", blurb: "More size, steady overload.", train: "size", reps: ["10–12", "8–12", "6–10"] },
  stamina: { name: "Build stamina", blurb: "Go longer before you tire.", train: "stamina", reps: ["15–20", "12–15", "20–25"] },
  general: { name: "Overall fitness", blurb: "A bit of everything.", train: "size", reps: ["12–15", "8–12", "10–12"] },
};

export const PLAN_LENGTHS = [4, 8, 12];
export const DAYS_PER_WEEK = [2, 3, 4, 5, 6];

const DAY = {
  full: { name: "Full body", muscles: ["chest", "lats", "quads", "hamstrings", "glutes", "shoulders", "abs"] },
  upper: { name: "Upper body", muscles: ["chest", "lats", "shoulders", "biceps", "triceps", "traps"] },
  lower: { name: "Lower body", muscles: ["quads", "hamstrings", "glutes", "calves", "abs", "lowerBack"] },
  push: { name: "Push", muscles: ["chest", "shoulders", "triceps"] },
  pull: { name: "Pull", muscles: ["lats", "traps", "biceps", "forearms"] },
  legs: { name: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves", "abs"] },
  core: { name: "Core & conditioning", muscles: ["abs", "obliques", "lowerBack", "glutes"] },
};

const SPLITS = {
  2: ["full", "full"],
  3: ["full", "full", "full"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["push", "pull", "legs", "upper", "lower"],
  6: ["push", "pull", "legs", "push", "pull", "legs"],
};

// Which weekdays to train on (0 = Monday), spread out for recovery.
export const SCHEDULES = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekNote(weekInBlock, deload) {
  if (deload) return "Easy week: about 60% of your usual weight and one set fewer. Let your body catch up.";
  return [
    "Settle in. Pick weights that leave 2–3 reps in the tank.",
    "Add a little weight or one more rep than last week.",
    "Push it: one extra set. Leave just 1–2 reps in the tank.",
  ][weekInBlock] ?? "";
}

/**
 * Builds the whole plan. Exercises stay the same within a block so progress
 * is easy to track, and change at the start of each new block.
 */
export function buildProgram({ goal = "size", daysPerWeek = 3, minutes = 45, weeks = 8, level = 1, gear = [], focus = [], startDate, seed = 1 }) {
  const planGoal = PLAN_GOALS[goal] ?? PLAN_GOALS.size;
  const train = planGoal.train;
  const split = SPLITS[daysPerWeek] ?? SPLITS[3];
  const focused = focus.filter(m => musclesById.has(m));

  const blocks = Math.ceil(weeks / 4);
  const templates = [];
  for (let block = 0; block < blocks; block++) {
    templates.push(
      split.map((dayId, dayIndex) => {
        const day = DAY[dayId];
        // Focus muscles get extra attention, and join the days that suit them.
        const extra = focused.filter(m => !day.muscles.includes(m) && fits(dayId, m));
        const muscles = [...day.muscles, ...extra];
        const weights = Object.fromEntries(focused.map(m => [m, 1.8]));
        const workout = generateWorkout({
          muscles, goal: train, minutes, gear, level, weights,
          seed: seed * 101 + block * 17 + dayIndex * 7 + 1,
        });
        return { dayId, name: day.name, muscles, workout };
      })
    );
  }

  const list = [];
  for (let w = 0; w < weeks; w++) {
    const block = Math.floor(w / 4);
    const weekInBlock = w % 4;
    const deload = weekInBlock === 3;
    const reps = planGoal.reps[Math.min(block, planGoal.reps.length - 1)];
    list.push({
      index: w,
      block,
      deload,
      note: weekNote(weekInBlock, deload),
      sessions: templates[block].map((t, d) => ({
        id: `w${w + 1}d${d + 1}`,
        name: t.name,
        weekday: (SCHEDULES[daysPerWeek] ?? SCHEDULES[3])[d],
        muscles: t.muscles,
        warmup: t.workout.warmup,
        cooldown: t.workout.cooldown,
        items: t.workout.items.map(item => {
          let sets = item.sets;
          if (weekInBlock === 2) sets += 1;
          if (deload) sets = Math.max(2, sets - 1);
          return {
            exerciseId: item.exerciseId,
            sets,
            reps: item.reps ? (item.reps === GOALS[train].reps ? reps : item.reps) : null,
            seconds: item.seconds ? item.seconds + (deload ? -10 : weekInBlock * 5) : null,
            restSec: item.restSec,
            perSide: item.perSide,
          };
        }),
      })),
    });
  }

  return {
    goal,
    daysPerWeek,
    minutes,
    weeks,
    level,
    gear,
    focus: focused,
    startDate: startDate ?? null,
    seed,
    schedule: list,
  };
}

function fits(dayId, muscle) {
  const region = musclesById.get(muscle)?.region;
  if (dayId === "full") return true;
  if (dayId === "upper" || dayId === "push" || dayId === "pull") return region === "upper" || region === "arms";
  if (dayId === "lower" || dayId === "legs") return region === "lower" || region === "core";
  return region === "core";
}

export function toIsoDay(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Monday of the week that holds this date (local time, YYYY-MM-DD in and out).
export function mondayOf(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIsoDay(date);
}

// The first session falls on the start date; the rest keep the same spacing.
export function sessionDate(program, weekIndex, weekday) {
  if (!program.startDate) return null;
  const first = (SCHEDULES[program.daysPerWeek] ?? SCHEDULES[3])[0];
  const [y, m, d] = program.startDate.split("-").map(Number);
  return toIsoDay(new Date(y, m - 1, d + weekIndex * 7 + weekday - first));
}

// The first session not yet done, in order.
export function nextSession(program, completed = {}) {
  for (const week of program.schedule) {
    for (const session of week.sessions) {
      if (!completed[session.id]) return { week, session };
    }
  }
  return null;
}

export function progress(program, completed = {}) {
  const total = program.schedule.reduce((n, w) => n + w.sessions.length, 0);
  const done = program.schedule.reduce((n, w) => n + w.sessions.filter(s => completed[s.id]).length, 0);
  return { done, total };
}

export function planTitle(program) {
  const goal = PLAN_GOALS[program.goal]?.name ?? "Training";
  return `${goal}: ${program.weeks} weeks, ${program.daysPerWeek} days a week`;
}
