// LeapFox checks: node src/features/leap/tests/validate.mjs
import assert from "node:assert/strict";

import { drills, drillsById, KINDS } from "../data/drills.js";
import { GOALS, TESTS, goalById } from "../data/goals.js";
import { LIFT_IDS, allSessions, buildPlan, cleanOptions, findSession, itemContacts, itemInfo, nextSession, addDays } from "../model/program.js";
import { bestByTest, flightFromFrames, fmtLength, heightFromFlight, heightFromReach } from "../model/vertical.js";
import { emptyData, normalizeData } from "../state/leapStore.js";
import { planItems, launchTargets } from "../model/planLink.js";
import { leapWorkouts } from "../model/fuelLink.js";
import { exercisesById } from "../../lift/data/exercises.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const START = "2026-11-30";

test("every drill is complete and has a known kind", () => {
  const kinds = new Set(KINDS.map(k => k.id));
  assert.equal(new Set(drills.map(d => d.id)).size, drills.length, "drill ids are unique");
  for (const d of drills) {
    assert.ok(kinds.has(d.kind), `${d.id} kind`);
    assert.ok(["two", "one", "split", "either"].includes(d.legs), `${d.id} legs`);
    assert.ok([1, 2, 3].includes(d.level), `${d.id} level`);
    assert.ok(d.steps.length >= 2 && d.tip, `${d.id} has steps and a tip`);
  }
});

test("every goal points at real drills and tests", () => {
  const tests = new Set(TESTS.map(t => t.id));
  for (const g of GOALS) {
    for (const id of g.sport) assert.ok(drillsById.has(id), `${g.id} drill ${id}`);
    for (const id of g.tests) assert.ok(tests.has(id), `${g.id} test ${id}`);
    assert.ok(["two", "one", "both"].includes(g.takeoff));
  }
  for (const id of LIFT_IDS) assert.ok(exercisesById.has(id), `LiftFox has ${id}`);
});

// Every combination a person can pick builds a sane plan.
const combos = [];
for (const goal of GOALS.map(g => g.id))
  for (const takeoff of ["two", "one", "both"])
    for (const level of [1, 2, 3])
      for (const gear of ["none", "home", "gym"])
        for (const days of [2, 3, 4])
          for (const weeks of [6, 8, 12])
            for (const inSeason of [false, true]) combos.push({ goal, takeoff, level, gear, days, weeks, inSeason, start: START });

test(`all ${combos.length} option combinations build a plan`, () => {
  for (const opts of combos) {
    const plan = buildPlan(opts);
    const label = JSON.stringify(opts);
    assert.equal(plan.weeks.length, opts.weeks, label);
    const sessions = allSessions(plan);
    assert.equal(sessions.length, opts.weeks * plan.opts.days, label);
    assert.equal(new Set(sessions.map(s => s.id)).size, sessions.length, `unique ids ${label}`);
    for (const s of sessions) {
      assert.ok(s.blocks[0].id === "warm" && s.blocks.at(-1).id === "cool", `warm-up and cool-down ${label}`);
      for (const item of s.blocks.flatMap(b => b.items)) {
        const info = itemInfo(item);
        assert.ok(info.drill || info.ex, `${item.id} exists ${label}`);
        assert.ok(item.sets >= 1 && item.reps >= 1, `${item.id} dose ${label}`);
        if (info.drill) assert.ok(info.drill.level <= opts.level, `${item.id} too hard for level ${opts.level}`);
        if (info.ex) assert.ok(info.ex.level <= opts.level || !info.ex.gear.length, `${item.id} too hard for level ${opts.level}`);
      }
      const jumpBlock = s.blocks.find(b => b.id === "jump");
      assert.ok(jumpBlock?.items.length >= 1, `jumps in ${s.id} ${label}`);
    }
  }
});

test("jump volume stays within the level's budget", () => {
  const caps = { 1: 60, 2: 85, 3: 110 };
  for (const opts of combos) {
    for (const s of allSessions(buildPlan(opts))) {
      const jumps = s.blocks.filter(b => b.id === "jump").flatMap(b => b.items).reduce((n, i) => n + itemContacts(i), 0);
      assert.ok(jumps <= caps[opts.level] * 1.2, `${s.id} has ${jumps} contacts for level ${opts.level}`);
    }
  }
});

test("the same options always give the same plan", () => {
  const a = buildPlan({ goal: "volleyball", level: 2, gear: "gym", days: 3, weeks: 8, start: START });
  const b = buildPlan({ goal: "volleyball", level: 2, gear: "gym", days: 3, weeks: 8, start: START });
  assert.deepEqual(a, b);
});

test("beginners never get depth jumps; one-foot events get one-foot work", () => {
  for (const opts of combos.filter(o => o.level === 1)) {
    for (const s of allSessions(buildPlan(opts))) assert.ok(!s.blocks.some(b => b.items.some(i => i.id === "depth-jump")));
  }
  const hj = buildPlan({ goal: "high-jump", takeoff: "two", level: 2, gear: "gym", days: 4, weeks: 8, start: START });
  assert.equal(hj.opts.takeoff, "one", "high jump is always one foot");
  const ids = allSessions(hj).flatMap(s => s.blocks.flatMap(b => b.items.map(i => i.id)));
  assert.ok(ids.includes("scissor-jump") || ids.includes("curve-runs"), "high jump drills");
  assert.ok(ids.filter(id => drillsById.get(id)?.legs === "one").length > ids.filter(id => drillsById.get(id)?.legs === "two").length);
});

test("gear decides the lifts: no barbell without a gym", () => {
  for (const s of allSessions(buildPlan({ goal: "general", level: 3, gear: "none", days: 4, weeks: 8, start: START }))) {
    for (const i of s.blocks.flatMap(b => b.items)) {
      if (i.src === "lift") assert.ok(!exercisesById.get(i.id).gear.some(g => g !== "bench"), `${i.id} needs only a chair`);
    }
  }
  const gym = allSessions(buildPlan({ goal: "general", level: 3, gear: "gym", days: 2, weeks: 8, start: START }));
  assert.ok(gym.some(s => s.blocks.some(b => b.items.some(i => i.id === "back-squat"))));
});

test("tests open and close the plan, in season caps days", () => {
  const plan = buildPlan({ goal: "basketball", days: 3, weeks: 6, start: START });
  const list = allSessions(plan);
  assert.ok(list[0].test && list[0].blocks.some(b => b.id === "test"));
  assert.equal(list.at(-1).type, "test");
  assert.equal(cleanOptions({ goal: "soccer", days: 4, inSeason: true }, START).days, 2);
  assert.equal(list[0].day, START);
  assert.equal(list[1].day, addDays(START, 2));
});

test("next session: catches up a recent miss, skips old ones", () => {
  const plan = buildPlan({ goal: "volleyball", days: 3, weeks: 8, start: START });
  assert.equal(nextSession(plan, {}, START).id, "w1d1");
  assert.equal(nextSession(plan, {}, "2026-12-02").id, "w1d1", "two days late: catch up");
  assert.equal(nextSession(plan, {}, "2026-12-10").id, "w2d1", "older misses are skipped past");
  assert.equal(nextSession(plan, {}, "2026-12-12").id, "w2d2");
  assert.equal(nextSession(plan, { w1d1: START }, START).id, "w1d2");
  const all = Object.fromEntries(allSessions(plan).map(s => [s.id, s.day]));
  assert.equal(nextSession(plan, all, START), null);
  assert.equal(findSession(plan, "w2d3").day, "2026-12-11");
});

test("jump math", () => {
  assert.equal(heightFromFlight(0.5), 30.7);
  assert.equal(flightFromFrames(100, 220, 240), 0.5);
  assert.equal(flightFromFrames(220, 100, 240), null);
  assert.equal(heightFromReach(234, 295), 61);
  assert.equal(heightFromReach(295, 234), null);
  assert.equal(fmtLength(60.96, "in"), "24 in");
  assert.equal(fmtLength(243.84, "in", { long: true }), "8′ 0″");
  assert.equal(fmtLength(244, "cm", { long: true }), "2.44 m");
  const best = bestByTest([
    { test: "standing", day: "2026-12-01", cm: 50 },
    { test: "standing", day: "2026-12-20", cm: 55 },
    { test: "single", side: "left", day: "2026-12-01", cm: 30 },
  ]);
  assert.equal(best.get("standing").best.cm, 55);
  assert.equal(best.get("standing").first.cm, 50);
  assert.ok(best.has("single:left"));
});

test("saved data is cleaned up", () => {
  assert.deepEqual(normalizeData(null), emptyData());
  const d = normalizeData({
    prefs: { unit: "cm", trainTime: "17:30" },
    plan: { id: "p1", createdAt: START, options: { goal: "nope", days: 9, start: START }, done: { w1d1: START, bad: "x", w1d2: 5 }, checks: { w1d1: ["warm-0", 3] } },
    results: [{ test: "standing", day: START, cm: 60 }, { test: "fly", day: START, cm: 60 }, { test: "broad", day: START, cm: -1 }],
  });
  assert.equal(d.prefs.unit, "cm");
  assert.equal(d.plan.options.goal, "basketball");
  assert.equal(d.plan.options.days, 3);
  assert.deepEqual(d.plan.done, { w1d1: START });
  assert.deepEqual(d.plan.checks, { w1d1: ["warm-0"] });
  assert.equal(d.results.length, 1);
});

test("PlanFox and FuelFox see the plan", () => {
  const raw = { prefs: { trainTime: "07:00" }, plan: { id: "p1", createdAt: START, options: { goal: "long-jump", days: 3, weeks: 8, start: START }, done: { w1d1: START } } };
  const items = planItems(raw, START, addDays(START, 6), "2026-12-02");
  assert.equal(items.length, 3);
  assert.equal(items[0].done, true);
  assert.equal(items[1].action, "Start");
  assert.equal(items[0].time, "07:00");
  assert.ok(items.every(i => i.href.startsWith("/leap?")));
  assert.ok(launchTargets(raw).length >= 3 && launchTargets(null).length >= 1);
  const fuel = leapWorkouts(raw, START, addDays(START, 6));
  assert.equal(fuel.length, 3);
  assert.ok(fuel.every(w => w.minutes >= 20 && w.met > 0 && w.source === "leapfox"));
  assert.deepEqual(leapWorkouts(null, START, START), []);
  assert.ok(goalById.has("triple-jump"));
});

console.log(`LeapFox: ${passed} checks passed.`);
