// F4T in PlanFox: a planner item can open F4T, or one of your saved meals.

import { normalizeData } from "../state/f4tStore.js";

export const planItems = () => [];

export function launchTargets(raw) {
  const data = normalizeData(raw);
  return [
    { id: "open", title: "Build a meal and see what it takes to burn it", href: "/f4t" },
    ...data.meals.filter(m => m.name).map(m => ({ id: m.id, title: `Meal: ${m.name}`, href: `/f4t?meal=${encodeURIComponent(m.id)}` })),
  ];
}
