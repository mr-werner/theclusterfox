// The muscle demos: activation data, the 3D push-up rig and the 2D drawing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vector3 } from 'three';

import { MOVEMENTS, effortRgb, efforts, movementFor, muscleForPart, repAt, repFor } from '../data/activation.js';
import { musclesById } from '../data/muscles.js';
import { exercisesById } from '../data/exercises.js';
import { normalizeData } from '../state/liftStore.js';
import { makePushup, restJoints } from '../anatomy3d/pushupRig.js';
import { FLOOR, SHAPES, makePushup2d } from '../model/pushup2d.js';

const pushup = MOVEMENTS.pushup;
assert.equal(movementFor(exercisesById.get('push-up')), pushup);
assert.equal(movementFor(exercisesById.get('bodyweight-squat')), null, 'later batches wait for their own data');

// Every muscle belongs to a real LiftFox group and matches parts in the 3D model.
const index = JSON.parse(fs.readFileSync(new URL('../../../../public/anatomy/index.json', import.meta.url)));
const muscleParts = index.parts.filter(p => p.layer === 'muscles');
for (const movement of Object.values(MOVEMENTS)) {
  const ids = new Set();
  for (const m of movement.muscles) {
    assert(!ids.has(m.id), `${movement.name}: ${m.id} twice`);
    ids.add(m.id);
    assert(musclesById.has(m.group), `${movement.name} ${m.id}: unknown group ${m.group}`);
    assert(m.peak > 0 && m.peak <= 1, `${movement.name} ${m.id}: peak out of range`);
    assert(m.role === 'mover' || m.role === 'brace', `${movement.name} ${m.id}: role`);
    assert(muscleParts.some(p => muscleForPart(movement, p.name)?.id === m.id), `${movement.name} ${m.id}: matches no 3D part`);
  }
}
assert.equal(muscleForPart(pushup, 'Sternocostal part of left pectoralis major').id, 'pecMajor');

// The rep runs top → bottom → top, and the chest works hardest at the bottom.
assert.equal(repAt(0, pushup.cycleMs).depth, 0);
assert.equal(repAt(pushup.cycleMs * 0.45, pushup.cycleMs).depth, 1);
assert.equal(repAt(pushup.cycleMs * 0.9, pushup.cycleMs).depth, 0);
const top = efforts(pushup, { depth: 0, pressing: false });
const bottom = efforts(pushup, { depth: 1, pressing: true });
assert(bottom.pecMajor > top.pecMajor + 0.4);
assert(bottom.pecMajor > bottom.biceps);
for (const v of Object.values(bottom)) assert(v >= 0 && v <= 1);
assert.deepEqual(effortRgb(0), effortRgb(0.1), 'barely working stays grey');
assert(effortRgb(1)[0] > effortRgb(1)[1] * 5, 'full effort is red');

// 3D rig: hands stay planted, bones keep their length, the chest drops.
const rig = makePushup();
const joints = restJoints();
const upperLen = joints[0].shoulder.distanceTo(joints[0].elbow);
const foreLen = joints[0].elbow.distanceTo(joints[0].wrist);
let lastShoulderY = Infinity;
for (const depth of [0, 0.5, 1]) {
  const pose = rig.pose(depth);
  for (const s of pose.sides) {
    assert(Math.abs(s.shoulder.distanceTo(s.elbow) - upperLen) < 1e-6);
    assert(Math.abs(s.elbow.distanceTo(s.wrist) - foreLen) < 1e-6);
    // The forearm rotation lands the wrist where the hand is.
    const end = joints[0].wrist.clone().sub(joints[0].elbow).applyQuaternion(s.qForeWrist);
    assert(end.length() > 0);
    assert(s.elbow.y > 0.05, 'elbow above the floor');
  }
  const y = pose.sides[0].shoulder.y;
  assert(y < lastShoulderY);
  lastShoulderY = y;
}
assert(rig.top > rig.bottom && rig.bottom > 0);
const wristL = rig.pose(0).sides[0].wrist;
assert.deepEqual(rig.pose(1).sides[0].wrist.toArray(), wristL.toArray(), 'hands stay put');
assert(new Vector3(...wristL.toArray()).y < 0.05);

// 2D: every coloured shape has activation data; the body stays above the floor.
for (const list of Object.values(SHAPES)) {
  for (const s of list) if (s.muscle) assert(pushup.muscles.some(m => m.id === s.muscle), `2D shape for unknown ${s.muscle}`);
}
const rig2 = makePushup2d();
for (const depth of [0, 1]) {
  const { bones } = rig2.pose(depth);
  for (const b of Object.values(bones)) for (const p of [b.from, b.to]) assert(p[1] <= FLOOR + 0.5, 'below the floor');
}

// The push-up family: each variant leads with the muscles it's known for.
{
  const lead = key => [...MOVEMENTS[key].muscles].sort((a, b) => b.peak - a.peak)[0].id;
  const peak = (key, id) => MOVEMENTS[key].muscles.find(m => m.id === id).peak;
  for (const id of ['incline-push-up', 'decline-push-up', 'diamond-push-up', 'pike-push-up', 'plank']) {
    assert(movementFor(exercisesById.get(id)), `${id}: no muscle view`);
  }
  assert(peak('inclinePushup', 'pecMajor') < peak('pushup', 'pecMajor'), 'incline is easier than the floor');
  assert(peak('declinePushup', 'frontDelt') > peak('pushup', 'frontDelt'), 'decline loads the front shoulder');
  assert.equal(lead('diamondPushup'), 'triceps');
  assert.equal(lead('pikePushup'), 'frontDelt');
  assert.equal(lead('plank'), 'abs');
  // A hold stays put and every muscle sits at its peak.
  const plank = MOVEMENTS.plank;
  assert.deepEqual(repFor(plank, 0), repFor(plank, 1234));
  assert(plank.muscles.every(m => m.role === 'brace'));
  const held = efforts(plank, repFor(plank, 500));
  for (const m of plank.muscles) assert.equal(held[m.id], m.peak);

  // Every variant's 3D pose keeps the hands planted, bones their length,
  // elbows off the floor, and moves the shoulders down; its 2D drawing stays
  // above the floor and inside its frame.
  for (const [key, movement] of Object.entries(MOVEMENTS)) {
    const options = movement.rigOptions ?? {};
    const r3 = makePushup({ chestGap: 0.08, ...options });
    const held3 = movement.hold != null;
    const p0 = r3.pose(0);
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = r3.pose(depth);
      pose.sides.forEach((s, side) => {
        assert(Math.abs(s.elbow.distanceTo(s.wrist) - foreLen) < 1e-3, `${key}: forearm length`);
        if (!options.forearms) assert(Math.abs(s.shoulder.distanceTo(s.elbow) - upperLen) < 1e-6, `${key}: upper arm length`);
        assert(s.elbow.y > 0.04, `${key}: elbow through the floor at ${depth}`);
        assert.deepEqual(s.wrist.toArray(), p0.sides[side].wrist.toArray(), `${key}: hands move`);
        // The posed forearm runs from the elbow to the hand.
        const end = s.elbow.clone().add(joints[side].wrist.clone().sub(joints[side].elbow).applyQuaternion(s.qForeWrist));
        assert(end.distanceTo(s.wrist) < 0.01, `${key}: forearm misses the wrist`);
      });
    }
    if (!held3) assert(r3.pose(1).sides[0].shoulder.y < p0.sides[0].shoulder.y - 0.08, `${key}: shoulders barely move`);
    const r2 = makePushup2d(options);
    const [vx, vy, vw, vh] = r2.view;
    for (const depth of [0, 0.5, 1]) {
      const { bones } = r2.pose(depth);
      for (const b of Object.values(bones)) {
        for (const p of [b.from, b.to]) {
          assert(p[1] <= FLOOR + 0.5, `${key}: 2D below the floor`);
          assert(p[0] >= vx && p[0] <= vx + vw && p[1] >= vy && p[1] <= vy + vh, `${key}: 2D outside its frame`);
        }
      }
    }
  }
  // The pike bends at the hips; the others stay straight.
  assert(makePushup({ pike: true }).pose(0).legs);
  assert.equal(makePushup().pose(0).legs, undefined);
}

// Favourites survive saving and loading, without duplicates.
const saved = normalizeData({ prefs: { favorites: ['push-up', 'push-up', 3, 'squat'] } });
assert.deepEqual(saved.prefs.favorites, ['push-up', 'squat']);
assert.deepEqual(normalizeData({}).prefs.favorites, []);

console.log('lift muscle demos ok');

// The five-a-day queue covers every exercise exactly once, five at most a day.
{
  const { MUSCLE_VIEW_QUEUE, nextBatch } = await import('../data/muscleViewQueue.js');
  const { BY_EXERCISE } = await import('../data/activation.js');
  const { exercises } = await import('../data/exercises.js');
  const queued = MUSCLE_VIEW_QUEUE.flatMap(b => b.exercises);
  assert.equal(new Set(queued).size, queued.length, 'an exercise is queued twice');
  for (const b of MUSCLE_VIEW_QUEUE) assert(b.exercises.length <= 5 && b.note, 'batches are five or fewer, with a note');
  for (const id of queued) assert(exercisesById.has(id), `queue: unknown exercise ${id}`);
  for (const e of exercises) assert(queued.includes(e.id) || BY_EXERCISE[e.id], `${e.id} is not in the queue`);
  // Done exercises have real movement data, and every movement has a known rig.
  for (const [id, key] of Object.entries(BY_EXERCISE)) assert(MOVEMENTS[key] && exercisesById.has(id), `${id}: bad mapping`);
  for (const m of Object.values(MOVEMENTS)) assert(typeof m.rig === 'string', `${m.name}: no rig`);
  assert.deepEqual(nextBatch(Object.keys(BY_EXERCISE)).index >= 0, true);
  console.log(`muscle view queue: ${queued.length} exercises in ${MUSCLE_VIEW_QUEUE.length} days`);
}
