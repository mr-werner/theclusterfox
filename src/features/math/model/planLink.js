// MathFox in PlanFox: a planner item (homework, say) can open MathFox, or a
// problem you solved recently.

import { cleanHistory } from "../state/history.js";

export const planItems = () => [];

export function launchTargets(raw) {
  return [
    { id: "open", title: "Solve a problem", href: "/math" },
    ...cleanHistory(raw).map(q => ({ id: q, title: q, href: `/math?q=${encodeURIComponent(q)}` })),
  ];
}
