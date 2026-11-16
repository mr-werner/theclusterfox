// MedicFox checks: node src/features/medic/tests/validate.mjs
import assert from "node:assert/strict";

import { EXAM_AREAS, LEVELS, LEVEL_IDS, covers } from "../data/levels.js";
import { TOPICS, topicById } from "../data/knowledge.js";
import { QUESTIONS } from "../data/questions.js";
import { GROUPS, SKILLS, skillById } from "../data/skills.js";
import { act, answerEvent, currentPhase, fillVitals, hint, pendingEvent, resolveStation, scoreRun, startRun, walkTarget, finishRun } from "../model/sim.js";
import { addAnswer, addResult, emptyData, normalizeData } from "../state/medicStore.js";
import { launchTargets, planItems } from "../model/planLink.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// ── Data ────────────────────────────────────────────────────────────────
test("levels, topics and questions are consistent", () => {
  assert.deepEqual(LEVEL_IDS, ["emr", "emt", "aemt", "paramedic"]);
  const areas = new Set(EXAM_AREAS.map(a => a.id));
  for (const t of TOPICS) {
    assert(areas.has(t.area), `${t.id} area`);
    assert(LEVEL_IDS.includes(t.min), `${t.id} min`);
    for (const p of t.points) if (typeof p !== "string") assert(LEVEL_IDS.includes(p.min) && p.t, `${t.id} point`);
    if (t.table) for (const r of t.table.rows) assert.equal(r.length, t.table.head.length, `${t.id} table row`);
  }
  assert.equal(new Set(TOPICS.map(t => t.id)).size, TOPICS.length);
  assert.equal(new Set(QUESTIONS.map(q => q.id)).size, QUESTIONS.length, "question ids unique");
  for (const q of QUESTIONS) {
    assert(topicById.has(q.topic), `${q.id} topic`);
    assert(LEVEL_IDS.includes(q.min), `${q.id} min`);
    assert.equal(q.choices.length, 4, `${q.id} has 4 choices`);
    assert.equal(new Set(q.choices).size, 4, `${q.id} choices differ`);
    assert(q.answer >= 0 && q.answer < 4 && q.why, `${q.id} answer`);
  }
  // Every level has something in every exam area.
  for (const level of LEVEL_IDS) for (const a of EXAM_AREAS) assert(TOPICS.some(t => t.area === a.id && covers(level, t.min)), `${level} ${a.id}`);
});

test("every skill station is well formed for every level and scenario", () => {
  assert.equal(new Set(SKILLS.map(s => s.id)).size, SKILLS.length);
  for (const skill of SKILLS) {
    assert(LEVEL_IDS.includes(skill.min) && skill.minutes > 0 && skill.phases.length, skill.id);
    for (const level of LEVEL_IDS.filter(l => covers(l, skill.min))) {
      for (const sc of skill.scenarios) {
        const { steps, distractors, events } = resolveStation(skill, sc.id, level);
        const ids = [...steps, ...distractors].map(a => a.id);
        assert.equal(new Set(ids).size, ids.length, `${skill.id}/${sc.id}/${level}: action ids unique`);
        for (const a of [...steps, ...distractors]) assert(GROUPS[a.group], `${skill.id} ${a.id} group ${a.group}`);
        for (const s of steps) {
          assert(s.phase >= 0 && s.phase < skill.phases.length, `${skill.id} ${s.id} phase`);
          assert(s.label && s.why && s.secs > 0 && s.pts > 0, `${skill.id} ${s.id} fields`);
        }
        // Every phase has at least one step.
        for (let i = 0; i < skill.phases.length; i++) assert(steps.some(s => s.phase === i), `${skill.id}/${sc.id}/${level}: phase ${i} empty`);
        for (const key of Object.keys(sc.findings ?? {})) assert(steps.some(s => s.id === key) || distractors.some(d => d.id === key), `${skill.id}/${sc.id}: finding for unknown step ${key}`);
        for (const e of events) {
          assert.equal(e.options.filter(o => o.ok).length, 1, `${skill.id} ${e.id}: one right answer`);
          assert(e.critical, `${skill.id} ${e.id} critical`);
        }
        // Findings fill in cleanly.
        for (const s of steps) {
          const text = fillVitals(sc.findings?.[s.id] ?? s.find ?? "", sc.vitals);
          assert(!/\{\w+\}/.test(text), `${skill.id}/${sc.id} ${s.id}: unfilled ${text}`);
        }
      }
      // A walk target the player can actually reach.
      const { steps } = resolveStation(skill, skill.scenarios[0].id, level);
      assert(walkTarget(skill, steps, 20) >= steps.reduce((s, x) => s + x.secs, 0), `${skill.id} walk floor reachable`);
    }
    for (const e of skill.events ?? []) for (const id of e.scenarios ?? []) assert(skill.scenarios.some(s => s.id === id), `${skill.id} ${e.id} scenario ${id}`);
  }
});

// ── Simulator ───────────────────────────────────────────────────────────
// Do every step in phase order, answering surprises correctly.
function perfect(skill, run) {
  let r = run;
  for (let guard = 0; guard < 200 && !r.finished; guard++) {
    if (r.pendingEvent) {
      const ev = pendingEvent(skill, r);
      r = answerEvent(skill, r, ev.options.find(o => o.ok).index).run;
      continue;
    }
    const h = hint(skill, r);
    r = act(skill, r, h.id).run;
  }
  return r;
}

test("a perfect crawl is clean and passes on every station", () => {
  for (const skill of SKILLS) {
    for (const sc of skill.scenarios) {
      const r = perfect(skill, startRun(skill, { level: "paramedic", mode: "crawl", seed: 7, scenarioId: sc.id }));
      const s = scoreRun(skill, r);
      assert(r.finished, `${skill.id} finished`);
      assert(s.pass && s.clean && s.points === s.possible, `${skill.id}/${sc.id} clean: ${JSON.stringify(s.criticals)}`);
    }
  }
});

test("a perfect walk and run pass, with surprises in run", () => {
  for (const skill of SKILLS) {
    for (const seed of [1, 2, 3]) {
      const walk = scoreRun(skill, perfect(skill, startRun(skill, { level: "paramedic", mode: "walk", seed, walkPasses: 50 })));
      assert(walk.pass, `${skill.id} walk ${seed}: ${walk.criticals}`);
      const r = perfect(skill, startRun(skill, { level: "paramedic", mode: "run", seed }));
      assert(scoreRun(skill, r).pass, `${skill.id} run ${seed}`);
      if (skill.events?.length) assert(r.firedEvents.length >= 1, `${skill.id} run ${seed} had a surprise`);
    }
  }
});

test("crawl rejects a step that's too early and explains it", () => {
  const skill = skillById.get("trauma");
  const r0 = startRun(skill, { level: "emt", mode: "crawl", seed: 4, scenarioId: "ladder" });
  const { run, feedback } = act(skill, r0, "vitals");
  assert.equal(feedback.kind, "early");
  assert.equal(run.done.vitals, undefined);
  assert.equal(run.mistakes, 1);
  assert.equal(currentPhase(resolveStation(skill, "ladder", "emt").steps, run.done), 0);
  const s = scoreRun(skill, perfect(skill, run));
  assert(!s.clean && !s.pass, "a mistake means not clean");
});

test("walk accepts out of order steps but counts them; order-critical steps fail", () => {
  const skill = skillById.get("spine");
  let r = startRun(skill, { level: "emt", mode: "walk", seed: 3, scenarioId: "diving" });
  r = act(skill, r, "head").run;
  assert(r.done.head.late);
  r = perfect(skill, r);
  const s = scoreRun(skill, r);
  assert(s.criticals.includes("Secured the head before the torso"));
  assert(!s.pass);
});

test("dangerous actions are critical fails in walk and run, teaching moments in crawl", () => {
  const skill = skillById.get("bvm");
  const crawl = act(skill, startRun(skill, { mode: "crawl", seed: 1 }), "compressions");
  assert.equal(crawl.feedback.kind, "danger");
  assert.equal(crawl.run.criticals.length, 0);
  const walk = act(skill, startRun(skill, { mode: "walk", seed: 1 }), "compressions");
  assert.deepEqual(walk.run.criticals, ["Started CPR on a patient with a pulse"]);
});

test("missing a critical step and finishing early fails", () => {
  const skill = skillById.get("bleeding");
  let r = startRun(skill, { mode: "run", seed: 9, scenarioId: "chainsaw" });
  r = act(skill, r, "bsi").run;
  const s = scoreRun(skill, finishRun(r));
  assert(!s.pass);
  assert(s.criticals.includes("Did not apply direct pressure"));
});

test("skills above your level become out-of-scope traps", () => {
  const skill = skillById.get("medical");
  const emr = resolveStation(skill, "chest-pain", "emr");
  assert(!emr.steps.some(s => s.id === "aspirin"));
  const trap = emr.distractors.find(d => d.id === "aspirin");
  assert(trap?.danger.includes("EMR"));
  assert(resolveStation(skill, "chest-pain", "emt").steps.some(s => s.id === "aspirin"));
});

test("walk targets shrink with each pass but never below what's possible", () => {
  const skill = skillById.get("trauma");
  const { steps } = resolveStation(skill, "ladder", "emt");
  const t0 = walkTarget(skill, steps, 0);
  const t1 = walkTarget(skill, steps, 1);
  assert.equal(t0, 600);
  assert(t1 < t0);
  assert.equal(walkTarget(skill, steps, 30), walkTarget(skill, steps, 40), "levels off at the floor");
});

test("wrong surprise answers are critical", () => {
  const skill = skillById.get("arrest");
  let r = startRun(skill, { mode: "run", seed: 11 });
  for (let i = 0; i < 40 && !r.pendingEvent && !r.finished; i++) r = act(skill, r, hint(skill, r).id).run;
  assert(r.pendingEvent, "a surprise fired");
  const ev = pendingEvent(skill, r);
  r = answerEvent(skill, r, ev.options.find(o => !o.ok).index).run;
  assert(r.criticals.includes(ev.critical));
});

test("run randomizes the vitals but keeps them believable", () => {
  const skill = skillById.get("trauma");
  const a = startRun(skill, { mode: "run", seed: 1, scenarioId: "ladder" });
  const b = startRun(skill, { mode: "run", seed: 2, scenarioId: "ladder" });
  assert.notDeepEqual(a.vitals, b.vitals);
  for (const v of [a.vitals, b.vitals]) assert(v.sys > v.dia && v.spo2 <= 100 && v.hr > 80);
  assert.deepEqual(startRun(skill, { mode: "crawl", seed: 1, scenarioId: "ladder" }).vitals, skill.scenarios.find(s => s.id === "ladder").vitals);
});

// ── Storage and PlanFox ─────────────────────────────────────────────────
test("saved data is cleaned and results add up", () => {
  assert.deepEqual(normalizeData(null), emptyData());
  const junk = normalizeData({ level: "doctor", skills: { nope: {}, bvm: { crawl: { tries: -1, passes: 2 } } }, quiz: { aw1: { right: 1 }, zz: {} }, history: [{ day: "bad" }] });
  assert.equal(junk.level, "emt");
  assert.deepEqual(Object.keys(junk.skills), ["bvm"]);
  assert.equal(junk.skills.bvm.crawl.tries, 0);
  assert.deepEqual(Object.keys(junk.quiz), ["aw1"]);
  assert.equal(junk.history.length, 0);
  let d = addResult(emptyData(), { id: "a", day: "2026-11-16", skillId: "bvm", mode: "walk", pass: true, points: 11, possible: 11, secs: 140 });
  d = addResult(d, { id: "b", day: "2026-11-16", skillId: "bvm", mode: "walk", pass: true, points: 11, possible: 11, secs: 120 });
  d = addResult(d, { id: "c", day: "2026-11-16", skillId: "bvm", mode: "walk", pass: false, points: 5, possible: 11, secs: 90 });
  assert.deepEqual(d.skills.bvm.walk, { tries: 3, passes: 2, best: 120, bestShare: 1 });
  d = addAnswer(addAnswer(d, "aw1", true), "aw1", false);
  assert.deepEqual([d.quiz.aw1.right, d.quiz.aw1.wrong], [1, 1]);
  assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(d))).skills, d.skills);
});

test("PlanFox shows practice by day and offers every station", () => {
  let d = addResult(emptyData(), { id: "a", day: "2026-11-16", skillId: "bvm", mode: "crawl", pass: false, points: 5, possible: 11, secs: 90 });
  d = addResult(d, { id: "b", day: "2026-11-16", skillId: "bvm", mode: "crawl", pass: true, points: 11, possible: 11, secs: 80 });
  d = addResult(d, { id: "c", day: "2026-12-02", skillId: "trauma", mode: "run", pass: false, points: 20, possible: 30, secs: 500 });
  const items = planItems(d, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1);
  assert.equal(items[0].detail, "2 tries, passed");
  assert(items[0].href.startsWith("/medic?"));
  assert.equal(launchTargets().length, SKILLS.length + 1);
  assert.deepEqual(planItems(null, "2026-11-01", "2026-11-30"), []);
});

console.log(`MedicFox: ${passed} checks passed (${LEVELS.length} levels, ${TOPICS.length} topics, ${QUESTIONS.length} questions, ${SKILLS.length} stations).`);
