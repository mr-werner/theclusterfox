// What CookFox puts on the PlanFox calendar: a recipe you started and can
// pick up again, pantry food to use up before it goes off, what's left on
// the shopping list, and the meals you cooked.

import { normalizeData } from "../state/cookStore.js";
import { recipes, recipesById } from "../data/recipes.js";
import { ingredientsById } from "../data/ingredients.js";

const pad = n => String(n).padStart(2, "0");
const localDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localTime = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const recipeHref = id => `/cook?r=${encodeURIComponent(id)}`;

export function planItems(raw, from, to, today = localDay(new Date())) {
  const data = normalizeData(raw);
  const out = [];
  const onToday = today >= from && today <= to;

  if (onToday) {
    for (const [recipeId, session] of Object.entries(data.sessions)) {
      const recipe = recipesById.get(recipeId);
      if (!recipe) continue;
      out.push({
        id: `cooking:${recipeId}`,
        day: today,
        time: null,
        title: `Keep cooking: ${recipe.title}`,
        detail: session.phase === "cooking" ? `Step ${session.step + 1} of ${recipe.steps.length}` : "Prep started",
        href: recipeHref(recipeId),
        action: "Resume",
      });
    }
    const left = data.shopping.filter(i => !i.checked).length;
    if (left) {
      out.push({ id: "shopping", day: today, time: null, title: "Shopping list", detail: `${left} thing${left === 1 ? "" : "s"} to get`, href: "/cook?tab=shopping" });
    }
  }

  for (const item of data.pantry) {
    if (!item.expires || item.expires < from || item.expires > to) continue;
    const name = item.ing ? ingredientsById.get(item.ing)?.name : item.name;
    out.push({ id: `use:${item.id}`, day: item.expires, time: null, title: `Use up the ${name}`, detail: "Last good day in your pantry", href: "/cook?tab=pantry" });
  }

  for (const entry of data.history) {
    if (entry.status !== "cooked") continue;
    const when = new Date(entry.date);
    if (Number.isNaN(when.getTime())) continue;
    const day = localDay(when);
    if (day < from || day > to) continue;
    out.push({ id: `h:${entry.id}`, day, time: localTime(when), title: `Cooked ${entry.title}`, detail: entry.servings ? `${entry.servings} servings` : "", href: recipeHref(entry.recipeId), done: true });
  }
  return out;
}

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const favorites = data.favorites.map(id => recipesById.get(id)).filter(Boolean);
  const rest = recipes.filter(r => !data.favorites.includes(r.id));
  return [
    { id: "discover", title: "Find something to cook", href: "/cook" },
    { id: "shopping", title: "Shopping list", href: "/cook?tab=shopping" },
    { id: "pantry", title: "Pantry", href: "/cook?tab=pantry" },
    ...[...favorites, ...rest].map(r => ({ id: r.id, title: `${data.favorites.includes(r.id) ? "★ " : ""}${r.title}`, href: recipeHref(r.id) })),
  ];
}
