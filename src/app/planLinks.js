// How the other ClusterFox apps show up in PlanFox.
//
// Each app that has something to do on a given day (a workout, a planned
// walk, a recipe you started) lists it here. PlanFox reads the app's own
// saved data from this browser, asks its planLink module for the days it
// is showing, and puts what comes back on the calendar. Tapping one opens
// the app right where you need to be.
//
// A planLink module exports:
//   planItems(raw, fromDay, toDay) -> [{ id, day, time?, title, detail?, href, action?, done? }]
//     raw is JSON.parse(localStorage[storageKey]), or null when the app has
//     never been used. Normalize it yourself. Days are "YYYY-MM-DD", time is
//     "HH:MM" or null, href is an in-site path that opens exactly that thing.
//     action is the button's word ("Start", "Resume"; "Open" if left out).
//     done is true when the app has already recorded it as done.
//   launchTargets(raw) -> [{ id, title, href }]   (optional, may be async)
//     Things a planner item can open in the app ("Opens in" on an item).
//
// The app's name, icon and color come from src/app/apps.js by app id.
// Modules load on demand so their data stays out of the first page load.

export const PLAN_LINKS = [
  { app: "liftfox", storageKey: "liftfox-data-v1", load: () => import("../features/lift/model/planLink.js") },
  { app: "clocast", storageKey: "clocast-data-v1", load: () => import("../features/clocast/model/planLink.js") },
  { app: "calmfox", storageKey: "calmfox-data-v1", load: () => import("../features/calm/model/planLink.js") },
  { app: "cookfox", storageKey: "cookfox-data-v1", load: () => import("../features/cook/model/planLink.js") },
  { app: "f4t", storageKey: "f4t-data-v2", load: () => import("../features/f4t/model/planLink.js") },
  { app: "mathfox", storageKey: "mathfox-history-v1", load: () => import("../features/math/model/planLink.js") },
  { app: "watchfox", storageKey: "clusterfox:watch-v1", load: () => import("../features/watch/model/planLink.js") },
  { app: "scorefox", storageKey: "clusterfox:sports-v1", load: () => import("../features/sports/model/planLink.js") },
  { app: "toolfox", storageKey: "toolfox-prefs-v1", load: () => import("../features/tools/model/planLink.js") },
  { app: "growfox", storageKey: "growfox-data-v1", load: () => import("../features/grow/model/planLink.js") },
];

/** True for a link that stays on this site, like "/lift?plan=abc". */
export const isSitePath = href => typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && href.length <= 600;

/** The PlanFox link that adds "open this in <app>" to your planner. */
export function planAddHref({ app, href, title }) {
  const params = new URLSearchParams({ add: app, open: href });
  if (title) params.set("title", title);
  return `/plan?${params}`;
}
