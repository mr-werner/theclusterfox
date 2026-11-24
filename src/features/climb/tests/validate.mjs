// ClimbFox checks: node src/features/climb/tests/validate.mjs
import assert from "node:assert/strict";

import { band, equivalents, mainGrade, pyramidBucket, vScore, ydsScore } from "../model/grades.js";
import { dailyConditions, isSandstone, scoreHour } from "../model/conditions.js";
import { gearList } from "../model/gear.js";
import { addRouteToTrip, emptyData, normalizeData, tickSummary, upcomingTripAt } from "../state/climbStore.js";
import { launchTargets, planItems, tripHref } from "../model/planLink.js";
import { cleanArea, cleanClimb, prettyName } from "../api.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("YDS grades sort the way climbers expect", () => {
  const order = ["5.6", "5.9-", "5.9", "5.9+", "5.10a", "5.10a/b", "5.10b", "5.10", "5.10c", "5.10d", "5.11a", "5.11-", "5.11+", "5.12a", "5.14d", "5.15a"];
  const scores = order.map(ydsScore);
  for (let i = 1; i < scores.length; i++) assert(scores[i] >= scores[i - 1], `${order[i - 1]} <= ${order[i]}`);
  assert.equal(ydsScore("V4"), null);
  assert.equal(ydsScore("5.25"), null);
});

test("V grades read ranges and pluses", () => {
  assert.equal(vScore("VB"), -1);
  assert.equal(vScore("V0"), 0);
  assert.equal(vScore("V4-5"), 4.5);
  assert(vScore("V3+") > vScore("V3"));
  assert.equal(vScore("5.10a"), null);
});

test("the main grade picks the right system", () => {
  assert.equal(mainGrade({ grades: { yds: "5.10c", french: "6a+" }, types: ["sport"] }).text, "5.10c");
  assert.equal(mainGrade({ grades: { vscale: "V5", font: "6C" }, types: ["bouldering"] }).kind, "boulder");
  assert.equal(mainGrade({ grades: { french: "7a" }, types: ["sport"] }).text, "7a");
  assert.equal(mainGrade({ grades: {}, types: [] }).text, "?");
});

test("conversions and bands line up", () => {
  const eq = equivalents({ grades: { yds: "5.12a" }, types: ["sport"] });
  assert.deepEqual(eq.find(e => e.system === "French"), { system: "French", grade: "7a+" });
  assert.equal(equivalents({ grades: { vscale: "V6" }, types: ["bouldering"] })[1].grade, "7A");
  assert.equal(band({ grades: { yds: "5.8" }, types: ["trad"] }), "beginner");
  assert.equal(band({ grades: { yds: "5.11c" }, types: ["sport"] }), "intermediate");
  assert.equal(band({ grades: { yds: "5.13a" }, types: ["sport"] }), "advanced");
  assert.equal(band({ grades: { vscale: "V11" }, types: ["bouldering"] }), "expert");
  assert.equal(pyramidBucket({ grades: { yds: "5.11d" }, types: ["sport"] }), "5.11");
});

const hour = (day, h, o = {}) => ({ time: new Date(`${day}T${String(h).padStart(2, "0")}:00:00Z`), localDay: day, localHour: h, temp: 12, rh: 45, dewPoint: 0, wind: 2, gust: 4, precip: 0, precipProb: 0, cloud: 20, ...o });
const dayHours = (day, o) => Array.from({ length: 24 }, (_, h) => hour(day, h, typeof o === "function" ? o(h) : o));

test("cool, dry, calm hours score prime; hot, wet or windy ones don't", () => {
  assert(scoreHour(hour("2026-11-20", 10)).score >= 90);
  assert(scoreHour(hour("2026-11-20", 10, { temp: 33, rh: 70 })).score < 40);
  assert(scoreHour(hour("2026-11-20", 10, { precip: 3, precipProb: 90 })).score < 30);
  assert(scoreHour(hour("2026-11-20", 10, { gust: 22 })).score < 70);
  assert(scoreHour(hour("2026-11-20", 10, { temp: 8, dewPoint: 7 })).reasons.some(r => r.includes("sweat")));
});

test("rain yesterday makes today wet, worse on sandstone", () => {
  const hours = [...dayHours("2026-11-19", { precip: 1 }), ...dayHours("2026-11-20", {})];
  const granite = dailyConditions(hours, { sandstone: false, today: "2026-11-20" });
  const sand = dailyConditions(hours, { sandstone: true, today: "2026-11-20" });
  assert.equal(granite.length, 1, "past days are left out");
  assert(granite[0].wetRock && sand[0].wetRock);
  assert(sand[0].score <= 25);
  assert(sand[0].reasons[0].startsWith("Wet sandstone"));
  const dry = dailyConditions(dayHours("2026-11-21", h => ({ temp: h < 12 ? 6 : 20 })), {});
  assert.equal(dry[0].wetRock, false);
  assert(dry[0].best.from >= 7 && dry[0].best.to <= 20);
  assert(isSandstone(["USA", "Kentucky", "Red River Gorge"]));
  assert(!isSandstone(["USA", "California", "Yosemite National Park"]));
});

test("the gear list fits the routes and the forecast", () => {
  const sport = { types: ["sport"], length: 30, bolts: 11 };
  const g = gearList([sport], { conditions: { high: 30, low: 18, rainMm: 0 } });
  const all = g.flatMap(x => x.items).join("\n");
  assert(all.includes("13 quickdraws"));
  assert(all.includes("60 m rope"));
  assert(all.includes("Extra water"));
  assert(!g.some(x => x.title === "Trad"));
  const long = gearList([{ types: ["sport"], length: 38 }]).flatMap(x => x.items).join("\n");
  assert(long.includes("80 m rope"));
  const boulder = gearList([{ types: ["bouldering"] }]);
  assert(boulder.some(x => x.title === "Bouldering") && !boulder.some(x => x.title === "Roped climbing"));
  assert(gearList([{ types: ["trad"] }]).some(x => x.title === "Trad"));
});

test("saved data survives junk", () => {
  assert.deepEqual(normalizeData(null), emptyData());
  assert.deepEqual(normalizeData("x"), emptyData());
  const d = normalizeData({
    units: "metric",
    todo: [{ uuid: "a", name: "Route A", grades: { yds: "5.10a", evil: 3 }, types: ["sport", 5] }, { uuid: "a" }, { nope: 1 }],
    ticks: [{ id: "t1", uuid: "a", name: "Route A", date: "2026-11-01", style: "flash" }, { id: "t2", uuid: "b", date: "bad" }],
    trips: [{ id: "x", day: "2026-11-21", area: { uuid: "z", name: "Wall" }, routes: [{ uuid: "a", name: "A" }] }, { id: "y", day: "2026-11-21" }],
  });
  assert.equal(d.units, "metric");
  assert.equal(d.todo.length, 1);
  assert.deepEqual(d.todo[0].grades, { yds: "5.10a" });
  assert.deepEqual(d.todo[0].types, ["sport"]);
  assert.equal(d.ticks.length, 1);
  assert.equal(d.trips.length, 1);
  assert.equal(d.trips[0].title, "Climb at Wall");
  assert.equal(tickSummary(d.ticks).a.sent, true);
});

test("adding a route joins the upcoming plan at that area, or starts one", () => {
  const area = { uuid: "area1", name: "Tectonic Wall", path: ["USA"], lat: 37, lng: -83 };
  const r1 = { uuid: "r1", name: "One", types: ["sport"], grades: { yds: "5.9" } };
  const r2 = { uuid: "r2", name: "Two", types: ["sport"], grades: { yds: "5.10a" } };
  let { trips, trip } = addRouteToTrip([], r1, area, "2026-11-17", "2026-11-20");
  assert.equal(trips.length, 1);
  assert.equal(trip.day, "2026-11-20");
  ({ trips, trip } = addRouteToTrip(trips, r2, area, "2026-11-17", "2026-11-25"));
  assert.equal(trips.length, 1, "joined the existing plan");
  assert.deepEqual(trip.routes.map(r => r.uuid), ["r1", "r2"]);
  ({ trips } = addRouteToTrip(trips, r2, area, "2026-11-17", "2026-11-25"));
  assert.equal(trips[0].routes.length, 2, "no duplicates");
  assert.equal(upcomingTripAt(trips, "area1", "2026-11-21"), null, "a past plan doesn't count");
});

test("planned days show on TaskFox and link back", () => {
  const raw = {
    trips: [
      { id: "t1", title: "Muir day", day: "2026-11-21", time: "08:00", area: { uuid: "z", name: "Muir Valley" }, routes: [{ uuid: "a", name: "Serpentine" }] },
      { id: "t2", day: "2026-12-21", area: { uuid: "z", name: "Muir Valley" }, routes: [] },
    ],
    ticks: [{ id: "k", uuid: "a", name: "Serpentine", date: "2026-11-21", style: "redpoint" }],
  };
  const items = planItems(raw, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1);
  assert.equal(items[0].href, tripHref("t1"));
  assert.equal(items[0].time, "08:00");
  assert.equal(items[0].done, true);
  assert(items[0].detail.includes("Serpentine"));
  assert.deepEqual(planItems(null, "2026-11-01", "2026-11-30"), []);
  assert(launchTargets(raw).some(t => t.href === tripHref("t2")));
});

test("OpenBeta records are cleaned up", () => {
  assert.equal(prettyName("Gorilla, The"), "The Gorilla");
  assert.equal(prettyName("Muir Valley"), "Muir Valley");
  const a = cleanArea({ uuid: "u", area_name: "Chimpanzee Wall, The", totalClimbs: 2, metadata: { lat: 1, lng: 2, leaf: true, leftRightIndex: -1 }, pathTokens: ["USA", "Congo, The"] });
  assert.equal(a.name, "The Chimpanzee Wall");
  assert.equal(a.lrIndex, null);
  assert.deepEqual(a.path, ["USA", "The Congo"]);
  const c = cleanClimb({ uuid: "c", name: " Serpentine ", length: -1, boltsCount: -1, safety: "UNSPECIFIED", type: { sport: true, trad: null }, metadata: { leftRightIndex: 2 } }, { uuid: "p", area_name: "Wall", metadata: { lat: 3, lng: 4 } });
  assert.equal(c.name, "Serpentine");
  assert.equal(c.length, null);
  assert.equal(c.safety, null);
  assert.deepEqual(c.types, ["sport"]);
  assert.equal(c.lat, 3);
});

console.log(`ClimbFox: ${passed} checks passed.`);
