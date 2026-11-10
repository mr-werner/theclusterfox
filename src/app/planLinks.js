// How the other ClusterFox apps show up in PlanFox.
//
// Each app that has something to do on a given day lists it here. PlanFox
// reads the app's own saved data from this browser, asks its planLink module
// for the days it is showing, and puts what comes back on the calendar.
//
// A planLink module exports:
//   planItems(raw, fromDay, toDay) -> [{ id, day, time?, title, detail?, href, action?, done? }]
//   launchTargets(raw) -> [{ id, title, href }]   (optional)
// raw is JSON.parse(localStorage[storageKey]), or null when the app has never
// been used. The app's name, icon and color come from src/app/apps.js.
// Modules load on demand so their data stays out of the first page load.

export const PLAN_LINKS = [
  { app: "growfox", storageKey: "growfox-data-v1", load: () => import("../features/grow/model/planLink.js") },
];
