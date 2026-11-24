// Checks ReadyFox's standards, scoring and plans: node src/features/ready/tests/validate.mjs
import assert from "node:assert/strict";

import { BRANCHES, EVENTS, JOBS, SOURCES, jobById } from "../data/jobs.js";
import { AFT_TABLES } from "../data/aftTables.js";
import { ageGroup, aftNeeded, aftPoints, checkScores, standardsFor } from "../model/scoring.js";
import { allSessions, buildPlan } from "../model/plan.js";
import { fmtTime, parseHold, parseTime } from "../model/units.js";
import { normalizeData } from "../state/readyStore.js";
import { planItems, launchTargets } from "../model/planLink.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("every job has a branch, known events and official sources", () => {
  const branches = new Set(BRANCHES.map(b => b.id));
  assert.equal(new Set(JOBS.map(j => j.id)).size, JOBS.length);
  for (const j of JOBS) {
    assert.ok(branches.has(j.branch), j.id);
    for (const e of j.test.events) assert.ok(EVENTS[e.id], `${j.id}: ${e.id}`);
    for (const o of j.test.order) assert.ok(j.test.events.some(e => e.id === o.event), `${j.id} order: ${o.event}`);
    assert.ok(j.test.sources.length > 0);
    for (const s of j.test.sources) {
      assert.ok(SOURCES[s], `${j.id}: source ${s}`);
      assert.match(SOURCES[s].url, /^https:\/\/[^/]*\.(mil|navy\.com|marines\.com)(\/|$)|^https:\/\/www\.navy\.com\/|^https:\/\/aem\.marines\.com\//, `${s} is an official site`);
    }
  }
});

test("Navy PST minimums match MILPERSMAN 1220-410", () => {
  const seal = standardsFor(jobById.get("navy-seal"));
  const m = Object.fromEntries(seal.map(s => [s.id, s.min]));
  assert.deepEqual(m, { swim500y: 750, navyPushups: 50, navyCurlups: 50, navyPullups: 10, run15: 630 });
  const airr = Object.fromEntries(standardsFor(jobById.get("navy-airr")).map(s => [s.id, s.min]));
  assert.equal(airr.swim500yAirr, 720);
  assert.equal(airr.navyPullups, 4);
});

test("EOD swim and run must add up to 21:00", () => {
  const eod = jobById.get("navy-eod");
  const ok = { swim500y: 600, navyPushups: 60, navyCurlups: 60, navyPullups: 8, run15: 630 };
  assert.equal(checkScores(eod, ok).pass, true);
  assert.equal(checkScores(eod, { ...ok, swim500y: 700 }).pass, false); // 11:40 + 10:30 = 22:10
});

test("AFT scoring matches the army.mil tables", () => {
  assert.equal(ageGroup(19), "17-21");
  assert.equal(ageGroup(22), "22-26");
  assert.equal(ageGroup(64), "62+");
  assert.equal(aftPoints(AFT_TABLES, "mdl", 340, "17-21", "m"), 100);
  assert.equal(aftPoints(AFT_TABLES, "mdl", 150, "17-21", "m"), 60);
  assert.equal(aftPoints(AFT_TABLES, "mdl", 145, "17-21", "m"), 50);
  assert.equal(aftPoints(AFT_TABLES, "hrp", 15, "17-21", "m"), 60);
  assert.equal(aftPoints(AFT_TABLES, "2mr", 13 * 60 + 22, "17-21", "m"), 100);
  assert.equal(aftPoints(AFT_TABLES, "2mr", 19 * 60 + 57, "17-21", "m"), 60);
  assert.equal(aftPoints(AFT_TABLES, "2mr", 22 * 60 + 55, "17-21", "f"), 60);
  assert.equal(aftPoints(AFT_TABLES, "plk", 90, "17-21", "f"), 60);
  assert.equal(aftNeeded(AFT_TABLES, "sdc", 60, "17-21", "m"), 148);
  const combat = jobById.get("army-combat");
  const scores = { mdl: 250, hrp: 40, sdc: 110, plk: 180, run2: 15 * 60 };
  const r = checkScores(combat, scores, { age: 20, sex: "f" }, AFT_TABLES);
  assert.ok(r.total >= 350, `total ${r.total}`);
  assert.equal(r.pass, true);
  // Combat is sex-neutral: the same scores give the same points.
  assert.equal(checkScores(combat, scores, { age: 20, sex: "m" }, AFT_TABLES).total, r.total);
  // General standard: scored by sex.
  const general = jobById.get("army-general");
  const weak = { mdl: 120, hrp: 11, sdc: 195, plk: 90, run2: 22 * 60 + 55 };
  assert.equal(checkScores(general, weak, { age: 20, sex: "f" }, AFT_TABLES).total, 300);
  assert.equal(checkScores(general, weak, { age: 20, sex: "m" }, AFT_TABLES).pass, false);
});

test("Marine IST takes pull-ups or push-ups, by sex", () => {
  const ist = jobById.get("marines-recruit");
  const base = { istPlank: 45, run15Ist: 13 * 60 };
  assert.equal(checkScores(ist, { ...base, istUpper: 3, "istUpper:option": "pullups" }, { sex: "m" }).pass, true);
  assert.equal(checkScores(ist, { ...base, istUpper: 30, "istUpper:option": "pushups" }, { sex: "m" }).pass, false);
  assert.equal(checkScores(ist, { ...base, istUpper: 15, "istUpper:option": "pushups" }, { sex: "f" }).pass, true);
  assert.equal(checkScores(ist, { istUpper: 3, istPlank: 45, run15Ist: 14 * 60 }, { sex: "m" }).pass, false);
});

test("times read the way people type them", () => {
  assert.equal(parseTime("12:30"), 750);
  assert.equal(parseTime("9.45"), 585);
  assert.equal(parseTime("12"), 720);
  assert.equal(parseTime("abc"), null);
  assert.equal(parseHold("45"), 45);
  assert.equal(parseHold("1:30"), 90);
  assert.equal(fmtTime(750), "12:30");
});

test("every job gets a plan that ends on test day", () => {
  for (const job of JOBS) {
    for (const target of ["min", "aim"]) {
      const plan = { jobId: job.id, start: "2026-11-23", testDay: "2027-02-15", days: [1, 2, 3, 5, 6], target, baseline: {}, profile: { sex: "m", age: 20 }, completed: {} };
      const weeks = buildPlan(plan, job, AFT_TABLES);
      const sessions = allSessions(weeks);
      assert.equal(weeks.length, 12, job.id);
      assert.equal(sessions.at(-1).id, "test");
      assert.equal(sessions.at(-1).day, "2027-02-15");
      assert.equal(new Set(sessions.map(s => s.id)).size, sessions.length);
      for (const s of sessions) {
        assert.ok(s.day >= plan.start && s.day <= plan.testDay);
        assert.ok(s.blocks.length > 0, `${job.id} ${s.id}`);
        for (const b of s.blocks) for (const l of b.lines) assert.ok(!/NaN|undefined|null/.test(`${b.title} ${l}`), `${job.id} ${s.id}: ${b.title} ${l}`);
      }
      const kinds = new Set(sessions.map(s => s.kind));
      if (job.test.events.some(e => EVENTS[e.id].sport === "swim" && EVENTS[e.id].kind === "time")) assert.ok(kinds.has("swim"), `${job.id} swims`);
      if (job.test.scoring === "aft") assert.ok(kinds.has("strength"), `${job.id} lifts`);
      assert.ok(kinds.has("practice"), `${job.id} has practice tests`);
    }
  }
});

test("a short plan still reaches test day", () => {
  const job = jobById.get("navy-seal");
  const plan = { jobId: job.id, start: "2026-11-23", testDay: "2026-12-10", days: [1, 3, 5], target: "min", baseline: { navyPullups: 1 }, profile: {}, completed: {} };
  const sessions = allSessions(buildPlan(plan, job, AFT_TABLES));
  assert.equal(sessions.at(-1).day, "2026-12-10");
  assert.ok(sessions.some(s => s.blocks.some(b => /lowers/.test(b.lines.join(" ")))), "beginner pull-up work");
});

test("saved data is cleaned and feeds PlanFox", () => {
  const raw = {
    jobId: "navy-seal",
    profile: { sex: "x", age: 300 },
    plan: { id: "p1", jobId: "navy-seal", start: "2026-11-23", testDay: "2027-02-15", days: [1, 2, 3, 9], target: "aim", baseline: { run15: 700, bogus: 3 }, completed: { w1d1: true } },
    attempts: [{ id: "a1", jobId: "navy-seal", day: "2026-11-20", scores: { navyPushups: 40, nope: 1 } }, { id: "bad", jobId: "nope", day: "2026-11-20", scores: {} }],
  };
  const d = normalizeData(raw);
  assert.deepEqual(d.profile, { sex: null, age: null });
  assert.deepEqual(d.plan.days, [1, 2, 3]);
  assert.deepEqual(d.plan.baseline, { run15: 700 });
  assert.equal(d.attempts.length, 1);
  const items = planItems(raw, "2026-11-23", "2026-11-29", "2026-11-25");
  assert.ok(items.length >= 3);
  assert.equal(items[0].done, true);
  for (const i of items) assert.match(i.href, /^\/ready\?tab=plan&session=/);
  assert.equal(planItems(null, "2026-11-23", "2026-11-29").length, 0);
  assert.ok(launchTargets(raw).some(t => t.id === "next"));
});

console.log(`ReadyFox: ${passed} checks passed.`);
