import { useMemo } from "react";

import { dayTargets, profileReady } from "../model/body.js";
import { workoutsByDay } from "../model/training.js";
import { addDays, cookSchedule, dayLabel, dayTotals, groceries, quickSpend, weekDays } from "../model/planner.js";

/**
 * Everything the planner screens show for one week: the days, workouts and
 * targets for each, the cooking schedule and the grocery list.
 */
export function usePlanner(data, linked, start) {
  const { profile, plan, workouts: own, weightLbs } = data;
  const { getRecipe, readTraining, cook } = linked;

  return useMemo(() => {
    const days = weekDays(start);
    const from = days[0];
    const to = days[6];
    const workouts = workoutsByDay(readTraining, own, from, to);
    const ready = profileReady(profile, weightLbs);
    const targets = Object.fromEntries(days.map(d => [d, ready ? dayTargets(profile, weightLbs, workouts.get(d) ?? []) : null]));
    const training = Object.fromEntries(days.map(d => [d, workouts.get(d) ?? []]));

    // Leftovers can come from a batch cooked before this week started.
    const lookback = Array.from({ length: 4 }, (_, i) => addDays(from, i - 4));
    const cooksAll = cookSchedule(plan, [...lookback, ...days], profile.people);
    const cooks = cooksAll.filter(c => c.day >= from);
    const shop = groceries(cooks, getRecipe, cook.pantry);
    const quick = quickSpend(plan, days, profile.people);
    const spend = Math.round((shop.total + quick.grabCost + quick.outCost) * 100) / 100;

    const totals = days.map(d => dayTotals(plan[d], getRecipe));
    const planned = days.filter(d => Object.keys(plan[d]?.slots ?? {}).length > 0);
    const avg = key => (planned.length ? planned.reduce((n, d) => n + totals[days.indexOf(d)][key], 0) / planned.length : 0);
    const avgTarget = ready ? days.reduce((n, d) => n + targets[d].kcal, 0) / 7 : null;
    const avgProtein = ready ? days.reduce((n, d) => n + targets[d].protein, 0) / 7 : null;

    // "Leftovers from Mon": the day the batch a leftover belongs to was cooked.
    const leftoverSource = (day, slotId, recipeId) => {
      const batch = cooksAll.find(c => c.recipeId === recipeId && c.eats.some(e => e.day === day && e.slot === slotId));
      return batch && batch.day !== day ? dayLabel(batch.day, { weekday: "short" }) : batch ? "earlier today" : null;
    };

    return {
      days,
      targets,
      training,
      ready,
      cooks,
      shop,
      quick,
      spend,
      totals,
      plannedDays: planned.length,
      avgKcal: avg("kcal"),
      avgProteinPlanned: avg("protein"),
      avgTarget,
      avgProtein,
      leftoverSource,
    };
  }, [start, plan, own, profile, weightLbs, getRecipe, readTraining, cook.pantry]);
}
