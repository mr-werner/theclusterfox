import assert from 'node:assert/strict';
import { exercises, exercisesById, canDo } from '../data/exercises.js';
import { muscles, musclesById, FRONT_SHAPES, BACK_SHAPES } from '../data/muscles.js';
import { equipmentById } from '../data/equipment.js';
import { demos, demoFor } from '../data/demos.js';
import { BONES, blendPose, buildFigure, solveJoint } from '../model/figure.js';
import { alternatives, estimateMinutes, generateWorkout, GOALS, workoutTitle } from '../model/generate.js';
import { buildProgram, nextSession, progress, sessionDate } from '../model/program.js';
import { mergeData, normalizeData } from '../state/liftStore.js';

// The library is consistent.
const ids = new Set();
for (const e of exercises) {
  assert(!ids.has(e.id), `duplicate exercise ${e.id}`);
  ids.add(e.id);
  for (const m of [...e.primary, ...e.secondary]) assert(musclesById.has(m), `${e.id}: unknown muscle ${m}`);
  for (const g of e.gear) assert(equipmentById.has(g), `${e.id}: unknown gear ${g}`);
  assert(demos[e.demo] || demoFor(e.demo) !== demos.squat, `${e.id}: no demo for ${e.demo}`);
  assert(e.steps.length >= 2 && e.tip, `${e.id}: needs steps and a tip`);
}

// Every muscle can be trained with no gear at all, and is on the body map.
for (const m of muscles) {
  assert(exercises.some(e => e.primary.includes(m.id) && canDo(e, []) && e.level === 1), `${m.id}: no beginner bodyweight move`);
  assert([...FRONT_SHAPES, ...BACK_SHAPES].some(s => s.muscle === m.id), `${m.id}: not on the body map`);
}

// Stand-ins step aside when the real gear is there.
assert(canDo(exercisesById.get('db-floor-press'), ['dumbbells']));
assert(!canDo(exercisesById.get('db-floor-press'), ['dumbbells', 'bench']));

// The joint solver keeps bones their length.
const { joint, end } = solveJoint([0, 0], [10, 30], 24, 22, 1);
assert(Math.abs(Math.hypot(joint[0], joint[1]) - 24) < 1e-6, 'upper bone length');
assert(Math.abs(Math.hypot(end[0] - joint[0], end[1] - joint[1]) - 22) < 1e-6, 'lower bone length');

// Every demo draws at every point of the rep without NaNs.
for (const [id, demo] of Object.entries(demos)) {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const f = buildFigure(blendPose(demo.a, demo.b, t));
    for (const [a, b] of [...f.near, ...f.far]) {
      assert([...a, ...b].every(Number.isFinite), `${id} at ${t}: bad point`);
    }
  }
  const thigh = buildFigure(demo.a).near.find(([a]) => a === demo.a.hip);
  assert(thigh, `${id}: torso starts at the hip`);
}
assert.equal(BONES.torso, 44);

// Workouts fit the time and hit the muscles asked for.
const gym = [...equipmentById.keys()];
for (const goal of Object.keys(GOALS)) {
  for (const minutes of [15, 30, 45, 60, 90]) {
    for (const [muscleList, gear] of [[[], []], [['chest', 'triceps'], ['dumbbells', 'bench']], [['quads', 'glutes', 'hamstrings'], gym], [['abs'], []]]) {
      for (const level of [1, 2, 3]) {
        const w = generateWorkout({ muscles: muscleList, goal, minutes, gear, level, seed: minutes + level });
        assert(w.items.length > 0, `${goal} ${minutes} ${muscleList}: empty`);
        assert(w.estMinutes <= minutes + 3, `${goal} ${minutes} ${muscleList} L${level}: ${w.estMinutes} min is too long`);
        const targets = muscleList.length ? muscleList : ['chest', 'lats', 'quads', 'hamstrings', 'glutes', 'shoulders', 'abs'];
        for (const item of w.items) {
          const e = exercisesById.get(item.exerciseId);
          assert(canDo(e, gear), `${e.id} needs gear we don't have`);
          assert(e.level <= level, `${e.id} is too hard for level ${level}`);
          assert(e.primary.some(m => targets.includes(m)), `${e.id} misses the target muscles`);
          assert.equal(item.done.length, item.sets);
        }
        assert.equal(new Set(w.items.map(i => i.exerciseId)).size, w.items.length, 'no repeats');
        assert.equal(w.estMinutes, estimateMinutes(w));
      }
    }
  }
}

// Longer sessions get more work, and full-ish workouts use most of the time.
const short = generateWorkout({ muscles: [], goal: 'size', minutes: 20, gear: gym, level: 2, seed: 3 });
const long = generateWorkout({ muscles: [], goal: 'size', minutes: 75, gear: gym, level: 2, seed: 3 });
assert(long.items.length > short.items.length, 'more time, more exercises');
assert(long.estMinutes >= 65, `75 minutes should be mostly filled, got ${long.estMinutes}`);

// Strength keeps heavy compound lifts at low reps; stamina is high reps.
const strong = generateWorkout({ muscles: ['quads'], goal: 'strength', minutes: 45, gear: gym, level: 2, seed: 1 });
assert.equal(exercisesById.get(strong.items[0].exerciseId).kind, 'compound');
assert.equal(strong.items[0].reps, '4–6');
assert.equal(generateWorkout({ muscles: ['quads'], goal: 'stamina', minutes: 30, gear: [], level: 1 }).items[0].reps, '15–20');

// Swaps stay on the same muscle.
for (const alt of alternatives('db-bench-press', { gear: ['dumbbells', 'bench'], level: 1 })) {
  assert(alt.primary.includes('chest'));
}

assert.equal(workoutTitle([]), 'Full body');
assert.equal(workoutTitle(['chest', 'biceps']), 'Chest & biceps');
assert.equal(workoutTitle(['quads', 'hamstrings', 'glutes', 'calves']), 'Legs');

// Plans: right shape, progression, deloads and dates.
const plan = buildProgram({ goal: 'strength', daysPerWeek: 4, minutes: 45, weeks: 8, level: 2, gear: gym, focus: ['calves'], startDate: '2026-10-20', seed: 5 });
assert.equal(plan.schedule.length, 8);
assert(plan.schedule.every(w => w.sessions.length === 4));
assert.deepEqual(plan.schedule.map(w => w.deload), [false, false, false, true, false, false, false, true]);
const firstMain = w => plan.schedule[w].sessions[0].items[0];
assert(firstMain(2).sets > firstMain(0).sets, 'week 3 adds a set');
assert(firstMain(3).sets < firstMain(2).sets, 'easy week drops sets');
assert.notEqual(firstMain(0).reps, firstMain(4).reps, 'block 2 moves to heavier reps');
assert(plan.schedule[0].sessions.some(s => s.items.some(i => exercisesById.get(i.exerciseId).primary.includes('calves'))), 'focus muscle shows up');
assert.equal(sessionDate(plan, 0, plan.schedule[0].sessions[0].weekday), '2026-10-20', 'first session on the start date');
assert.equal(sessionDate(plan, 1, plan.schedule[1].sessions[0].weekday), '2026-10-27');
assert.equal(nextSession(plan, { w1d1: '2026-10-20' }).session.id, 'w1d2');
assert.deepEqual(progress(plan, { w1d1: 'x', w1d2: 'y' }), { done: 2, total: 32 });
for (const days of [2, 3, 5, 6]) {
  const p = buildProgram({ goal: 'general', daysPerWeek: days, weeks: 4, gear: [], level: 1 });
  assert(p.schedule.every(w => w.sessions.length === days && w.sessions.every(s => s.items.length > 0)));
}

// Store: bad data is cleaned, and merging keeps both devices' work.
const clean = normalizeData({ prefs: { goal: 'nope', minutes: 9999, level: 7 }, history: [{ id: 'x' }], plans: [{ id: 'p' }] });
assert.equal(clean.prefs.goal, 'size');
assert.equal(clean.prefs.minutes, 45);
assert.equal(clean.history.length, 0);
assert.equal(clean.plans.length, 0);

const h = (id, date, at) => ({ id, date, title: 'W', goal: 'size', minutes: 30, muscles: [], setsDone: 3, setsTotal: 3, loads: {}, updatedAt: at });
const p = (completed, at) => ({ id: 'plan', createdAt: '2026-10-01T00:00:00Z', updatedAt: at, program: plan, completed });
const local = { history: [h('a', '2026-10-18', '2026-10-18T10:00:00Z')], plans: [p({ w1d1: '2026-10-20' }, '2026-10-20T00:00:00Z')], updatedAt: '2026-10-20T00:00:00Z' };
const remote = {
  history: [h('b', '2026-10-19', '2026-10-19T10:00:00Z')],
  plans: [p({ w1d2: '2026-10-21' }, '2026-10-21T00:00:00Z')],
  deletedHistoryIds: [],
  updatedAt: '2026-10-21T00:00:00Z',
};
const merged = mergeData(local, remote);
assert.deepEqual(merged.history.map(x => x.id), ['b', 'a'], 'history pooled, newest first');
assert.deepEqual(Object.keys(merged.plans[0].completed).sort(), ['w1d1', 'w1d2'], 'plan progress pooled');
const deleted = mergeData(local, { ...remote, deletedHistoryIds: [{ id: 'a', at: '2026-10-19T00:00:00Z' }] });
assert(!deleted.history.some(x => x.id === 'a'), 'deletions stick');

console.log('LiftFox: all checks passed');
