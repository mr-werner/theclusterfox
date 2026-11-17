// JumpFox checks: node src/features/jump/tests/validate.mjs
import assert from "node:assert/strict";

import { DROPZONES, dzById, PROGRAMS } from "../data/dropzones.js";
import { TUNNELS } from "../data/tunnels.js";
import { EVENTS } from "../data/events.js";
import { LICENSES } from "../data/license.js";
import { SKILLS } from "../data/skills.js";
import { freefallSeconds, jumpCall, milesBetween, spot, windows } from "../model/jumpcheck.js";
import { estimateFreefall, fromBackup, fromCsv, licenseProgress, mergeJumps, nextNumber, toBackup, toCsv, totals } from "../model/logbook.js";
import { normalizeData } from "../state/jumpStore.js";
import { launchTargets, planItems } from "../model/planLink.js";
import { DIAGRAM_IDS } from "../components/diagramIds.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

test("drop zones and tunnels are well formed and in the US", () => {
  const ids = new Set();
  for (const d of [...DROPZONES, ...TUNNELS]) {
    assert(!ids.has(d.id), `unique id ${d.id}`);
    ids.add(d.id);
    assert(d.lat > 18 && d.lat < 50 && d.lon > -160 && d.lon < -66, `${d.id} location`);
    assert(/^https:\/\//.test(d.website), `${d.id} website`);
  }
  for (const d of DROPZONES) for (const p of d.programs) assert(PROGRAMS[p], `${d.id} program ${p}`);
  for (const e of EVENTS) assert(!e.dzId || dzById[e.dzId], `${e.id} host`);
});

test("every skill has a diagram and steps", () => {
  for (const s of SKILLS) {
    assert(DIAGRAM_IDS.includes(s.diagram), `${s.id} diagram ${s.diagram}`);
    assert(s.steps.length >= 3);
  }
});

// A synthetic forecast hour: wind veering and building with height.
const level = (altitudeFt, dir, speedKt, tempC) => ({ hPa: 0, altitudeFt, dir, speedKt, tempC, belowGround: false });
const hour = (over = {}) => ({
  time: new Date("2026-11-20T18:00:00Z"),
  surface: { speedKt: 6, gustKt: 9, dir: 250, tempC: 20 },
  cloud: { low: 10, mid: 10, high: 0 },
  visibilityM: 20000,
  cape: 0,
  isDay: true,
  weatherCode: 1,
  precipChance: 0,
  levels: [level(1500, 260, 12, 15), level(5000, 270, 20, 8), level(10000, 280, 30, -2), level(15000, 290, 40, -12), level(20000, 290, 55, -22)],
  ...over,
});

test("jump call: a nice day is jumpable", () => {
  const c = jumpCall(hour(), { limitMph: 20, exitFt: 13500 });
  assert.equal(c.level, "go");
  near(c.windMph, 6.9, 0.1);
  assert(c.uppers && c.uppers.speedKt > 30 && c.uppers.speedKt < 40, "uppers interpolated at 13.5k");
});

test("jump call: wind limits, gusts, clouds, rain and dark", () => {
  assert.equal(jumpCall(hour({ surface: { speedKt: 14, gustKt: 16, dir: 250 } }), { limitMph: 14 }).level, "no", "16 mph over a student's 14");
  assert.equal(jumpCall(hour({ surface: { speedKt: 14, gustKt: 16, dir: 250 } }), { limitMph: 25 }).level, "go");
  assert.equal(jumpCall(hour({ surface: { speedKt: 5, gustKt: 15, dir: 250 } }), { limitMph: 25 }).level, "maybe", "gust spread");
  assert.equal(jumpCall(hour({ cloud: { low: 95, mid: 0 } })).level, "no");
  assert.equal(jumpCall(hour({ cloud: { low: 60, mid: 0 } })).level, "maybe");
  assert.equal(jumpCall(hour({ weatherCode: 63 })).level, "no");
  assert.equal(jumpCall(hour({ weatherCode: 95 })).reasons[0].text, "Thunderstorms");
  assert.equal(jumpCall(hour({ visibilityM: 3000 })).level, "no");
  assert.equal(jumpCall(hour({ isDay: false })).level, "dark");
  const calls = [hour(), hour(), hour({ weatherCode: 63 }), hour()].map(h => jumpCall(h));
  assert.deepEqual(windows([0, 1, 2, 3], calls).map(w => [w.from, w.to, w.level]), [[0, 1, "go"], [2, 2, "no"], [3, 3, "go"]]);
});

test("freefall time: about a minute from 13,500 to 3,500", () => {
  near(freefallSeconds(10000), 61, 2);
  assert(freefallSeconds(10000, "freefly") < 50);
  assert.equal(freefallSeconds(0), 0);
  assert.equal(estimateFreefall(13500, 3500, "sl"), 0);
});

test("spot goes upwind and jump run heads into the uppers", () => {
  const s = spot(hour(), { exitFt: 13500, pullFt: 3500 });
  near(s.exit.bearing, 280, 15, "exit is upwind (west)");
  assert(s.exit.distFt > s.open.distFt, "exit further upwind than opening");
  near(s.freefall.driftFt, 61 * 30 * 1.6878, 900, "about a minute at ~30 kt");
  near(s.jumpRun.heading, 285, 10);
  assert(s.jumpRun.groundspeedKt < 100 && s.jumpRun.secondsBetweenGroups >= 8);
  const calm = spot(hour({ surface: { speedKt: 0, dir: 0 }, levels: [level(2000, 0, 0, 10), level(20000, 0, 0, -20)] }));
  assert(calm.exit.distFt < 1, "no wind, no spot offset");
});

test("distance between DZs", () => {
  near(milesBetween(dzById.perris, dzById.elsinore), 10, 2);
});

const raw = {
  homeDz: "perris",
  prior: { jumps: 20, freefallMin: 10 },
  jumps: [
    { id: "a", number: 21, date: "2026-11-02", dzId: "perris", dzName: "Skydive Perris", exitFt: 13500, pullFt: 4000, freefallSec: 58, type: "solo", notes: 'Said "hi", then, =SUM(1)' },
    { id: "b", number: 22, date: "2026-11-02", dzId: "perris", dzName: "Skydive Perris", exitFt: 13500, pullFt: 4000, freefallSec: 58, type: "rw" },
    { id: "c", number: 23, date: "2026-11-05", dzName: "Skydive Elsinore", freefallSec: 60, type: "freefly" },
    { id: "bad", number: 2, date: "not a date" },
  ],
  plans: [{ id: "p1", day: "2026-11-14", dzId: "perris", note: "Coach jump" }],
  events: [{ id: "e1", day: "2026-11-26", name: "Thanksgiving Boogie", where: "Z-Hills" }],
  reserveRepackedOn: "2026-06-01",
};

test("store cleans junk and sorts the logbook newest first", () => {
  const d = normalizeData(raw);
  assert.deepEqual(d.jumps.map(j => j.number), [23, 22, 21]);
  assert.equal(d.jumps[0].type, "freefly");
  assert.equal(nextNumber(d), 24);
  assert.equal(normalizeData(null).jumps.length, 0);
  assert.equal(normalizeData({ jumps: "x", plans: [1, null] }).plans.length, 0);
});

test("totals and license progress count earlier jumps", () => {
  const t = totals(normalizeData(raw));
  assert.equal(t.jumps, 23);
  assert.equal(t.freefallSec, 600 + 176);
  assert.equal(t.lastDate, "2026-11-05");
  const p = licenseProgress(t);
  assert.equal(p[0].id, "A");
  assert.equal(p[0].met, false);
  near(p[1].freefallPct, 776 / 1800, 0.001);
  assert.equal(LICENSES.length, 4);
});

test("CSV export and import round-trip, with formulas defused", () => {
  const d = normalizeData(raw);
  const csv = toCsv(d.jumps);
  assert(csv.startsWith("Jump,Date,Drop zone"));
  assert(csv.includes("'=SUM(1)") || csv.includes('""hi""'), "quotes escaped");
  const back = fromCsv(csv);
  assert.deepEqual(back.map(j => j.number), [21, 22, 23]);
  assert.equal(back[0].notes, 'Said "hi", then, =SUM(1)');
  assert.equal(back[2].type, "freefly");
  const merged = mergeJumps(d.jumps, back);
  assert.equal(merged.added, 0);
  assert.equal(merged.skipped, 3);
  assert.throws(() => fromCsv("a,b\n1,2"), /Jump and Date/);
});

test("JSON backup round-trip", () => {
  const d = normalizeData(raw);
  const back = fromBackup(toBackup(d));
  assert.deepEqual(back.jumps, d.jumps);
  assert.throws(() => fromBackup("nope"), /backup/);
});

test("PlanFox: jump days, events, logged jumps and reserve repack", () => {
  const items = planItems(raw, "2026-11-01", "2026-11-30");
  const plan = items.find(i => i.id === "plan:p1");
  assert.equal(plan.title, "Jump at Skydive Perris");
  assert.equal(plan.href, "/jump?dz=perris");
  assert(items.some(i => i.id === "event:e1" && i.day === "2026-11-26"));
  const log = items.find(i => i.id === "log:2026-11-02");
  assert.equal(log.title, "2 jumps (#21–22)");
  assert.equal(log.done, true);
  assert.equal(planItems(raw, "2026-11-28", "2026-11-28").find(i => i.id.startsWith("repack:")).day, "2026-11-28");
  assert.equal(planItems(null, "2026-11-01", "2026-11-30").length, 0);
  assert(launchTargets(raw).some(t => t.href === "/jump?dz=perris"));
});

console.log(`\nJumpFox: ${passed} checks passed`);
