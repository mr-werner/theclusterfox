// What SkyFox puts on the PlanFox calendar: the outdoor sessions you planned
// in its Planner, at the hour you picked.

import { normalizeData } from "../state/clocastStore.js";
import { activitiesById } from "../data/activities.js";

const pad = n => String(n).padStart(2, "0");

export function planItems(raw, from, to) {
  const data = normalizeData(raw);
  return data.plans
    .filter(plan => plan.day >= from && plan.day <= to)
    .map(plan => {
      const activity = activitiesById.get(plan.activityId);
      return {
        id: `plan:${plan.id}`,
        day: plan.day,
        time: `${pad(plan.startHour)}:00`,
        title: plan.title || activity?.name || "Outside",
        detail: `${plan.hours} hour${plan.hours === 1 ? "" : "s"} outside · forecast and what to wear`,
        href: "/clocast?tab=plan",
      };
    });
}

export function launchTargets() {
  return [
    { id: "today", title: "Today's forecast and what to wear", href: "/clocast" },
    { id: "plan", title: "Plan time outside", href: "/clocast?tab=plan" },
    { id: "coach", title: "Training coach", href: "/clocast?tab=coach" },
  ];
}
