// WatchFox in PlanFox: a planner item (movie night) can open a title on
// your watchlist, with where it's streaming.

import { normalizeData } from "../state/watchStore.js";

export const planItems = () => [];

export function launchTargets(raw) {
  const data = normalizeData(raw);
  const seen = new Set();
  const titles = [...data.watchlist, ...data.favorites].filter(t => {
    const key = `${t.type}-${t.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    { id: "open", title: "Find something to watch", href: "/watch" },
    ...titles.map(t => ({ id: `${t.type}-${t.id}`, title: `${t.title}${t.year ? ` (${t.year})` : ""}`, href: `/watch?t=${t.type}-${t.id}` })),
  ];
}
