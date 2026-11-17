// FuelFox in PlanFox: each planned day's meals, what to cook that day, and a
// reminder to weigh in. A planner item can also open F4T or a saved meal.

import { normalizeData } from "../state/f4tStore.js";
import { recipesById } from "../../cook/data/recipes.js";
import { quickById } from "../data/quickFoods.js";
import { addDays, cookSchedule, entryFacts, SLOTS } from "./planner.js";

const getRecipe = id => recipesById.get(id) ?? null;

export function planItems(raw, from, to) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const out = [];
  const days = [];
  for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);

  for (const day of days) {
    const slots = data.plan[day]?.slots ?? {};
    const names = [];
    let kcal = 0;
    let all = true;
    for (const slot of SLOTS) {
      const e = slots[slot.id];
      if (!e) continue;
      const title = e.off ? e.off.name : e.quickId ? quickById.get(e.quickId)?.name : getRecipe(e.recipeId)?.title;
      if (!title) continue;
      names.push(`${slot.name}: ${title}${e.leftover ? " (leftovers)" : ""}`);
      kcal += entryFacts(e, getRecipe)?.kcal ?? 0;
      if (!e.eaten) all = false;
    }
    if (names.length) {
      out.push({ id: `meals:${day}`, day, time: null, title: "Meal plan", detail: `${names.join(" · ")} · ${Math.round(kcal).toLocaleString()} cal`, href: `/f4t?day=${day}`, done: all });
    }
  }

  // What to cook, so batch-cooking days show up on the calendar.
  const lookback = [1, 2, 3, 4].map(n => addDays(from, -n)).reverse();
  for (const c of cookSchedule(data.plan, [...lookback, ...days], data.profile.people)) {
    if (c.day < from) continue;
    const r = getRecipe(c.recipeId);
    if (!r) continue;
    const later = c.eats.length - 1;
    out.push({
      id: `cook:${c.day}:${c.recipeId}`,
      day: c.day,
      time: null,
      title: `Cook ${r.title}`,
      detail: `${c.servings} serving${c.servings === 1 ? "" : "s"}${later > 0 ? `, covers ${later} more meal${later === 1 ? "" : "s"}` : ""}`,
      href: `/cook?r=${encodeURIComponent(r.id)}&servings=${c.servings}`,
      action: "Cook",
    });
  }
  return out;
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  return [
    { id: "plan", title: "This week's meal plan", href: "/f4t" },
    { id: "shop", title: "Groceries for the week", href: "/f4t?tab=shop" },
    { id: "off", title: "Log an off-plan meal", href: "/f4t?tab=off" },
    { id: "me", title: "Weigh in", href: "/f4t?tab=me" },
    ...data.meals.filter(m => m.name).map(m => ({ id: m.id, title: `Meal: ${m.name}`, href: `/f4t?meal=${encodeURIComponent(m.id)}` })),
  ];
}
