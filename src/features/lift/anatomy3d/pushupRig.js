// Poses BodyFox's standing 3D anatomy into a push-up.
//
// The model is one standing person (BodyParts3D, metres; +x is the person's
// left, +y up, +z the front). We don't have a rigged model, so this file
// gives every vertex a place on a small skeleton: the body moves as one
// piece, and each arm bends at the shoulder, elbow and wrist. A vertex near a
// joint turns part-way with each side of it, so muscles bend instead of
// tearing. The forearm also twists from palm-forward (how the model stands)
// to palm-down along its length, like a real forearm does.
//
// Pure maths on three.js vectors: no scene, so tests can run it in Node.

import { Matrix4, Quaternion, Vector3 } from "three";

// Joint centres on the model's left side, read from the bones in index.json.
// The right side mirrors x.
const LEFT = {
  shoulder: [0.168, 1.31, 0.074],
  elbow: [0.203, 1.045, 0.083],
  wrist: [0.246, 0.802, 0.117],
  knuckle: [0.262, 0.722, 0.127],
};
const TOE = [0, -0.068, 0.232]; // tip of the toes: the pivot on the floor
const CHEST = [0, 1.2, 0.215]; // front of the chest, for how low to go
const FACE = [0, 1.5, 0.2]; // tip of the nose
const CROWN = [0, 1.645, 0.06]; // top of the head
// The hips bend (for the pike) around a line through both hip joints.
const HIP = [0, 0.81, 0.08];

export const SEG = { body: 0, upper: 1, fore: 2, hand: 3 };
const SIDE_SEGS = 4; // segment ids: side 0 (left) 0–3, side 1 (right) 4–7; body is 0 on both
export const LEGS = 8; // pelvis down, when the hips bend

const v3 = a => new Vector3(...a);
const mirror = a => [-a[0], a[1], a[2]];

export function restJoints() {
  const sides = [LEFT, Object.fromEntries(Object.entries(LEFT).map(([k, v]) => [k, mirror(v)]))];
  return sides.map(s => ({
    shoulder: v3(s.shoulder),
    elbow: v3(s.elbow),
    wrist: v3(s.wrist),
    knuckle: v3(s.knuckle),
  }));
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Which parts move with an arm. Hands and forearms are always arm; these
// torso muscles attach to the upper arm, so their outer ends follow it.
const ARM_PART = /deltoid|biceps brachii|brachialis|coracobrachialis|triceps|anconeus|brachioradialis|carpi|digitorum superficialis|digitorum profundus|extensor digitorum|pollicis|digiti minimi|indicis|pronator|supinator|palmaris|lumbrical|interosse|humerus|radius|ulna|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx|thenar|of (left|right) hand|finger|thumb/;
const REACHES_ARM = /pectoralis major|latissimus|teres major|subscapularis|infraspinatus|supraspinatus|teres minor/;

/** Is this part (by name and box) part of an arm? */
export function isArmPart(part) {
  const n = part.name.toLowerCase();
  const lowY = part.box?.[0]?.[1] ?? 1;
  return ARM_PART.test(n) && lowY > 0.5 && !/toe|foot|pedis|hallucis/.test(n);
}

/**
 * Binds vertices to the skeleton. Returns per-vertex segA, segB (Uint8),
 * blend (Float32, 0 = all segA, 1 = all segB) and twist (Float32, how far
 * along the forearm: 0 at the elbow, 1 at the wrist).
 */
export function bindVertices(positions, partIndex, parts) {
  const n = positions.length / 3;
  const segA = new Uint8Array(n);
  const segB = new Uint8Array(n);
  const blend = new Float32Array(n);
  const twist = new Float32Array(n);
  const joints = restJoints();
  const kind = parts.map(p => (isArmPart(p) ? 2 : REACHES_ARM.test(p.name.toLowerCase()) ? 1 : 0));

  const p = new Vector3();
  const tmp = new Vector3();
  const along = (from, to) => {
    tmp.subVectors(to, from);
    return p.clone().sub(from).dot(tmp) / tmp.lengthSq();
  };

  for (let v = 0; v < n; v++) {
    const k = kind[partIndex[v]] ?? 0;
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    if (k === 0) {
      // Body, the default. Below the waist it turns part-way with the legs,
      // all the way from mid-thigh down, so a bend at the hips stays smooth.
      const w = smooth(HIP[1] + 0.1, HIP[1] - 0.12, p.y);
      if (w > 0) {
        segB[v] = LEGS;
        blend[v] = w;
      }
      continue;
    }
    const side = p.x >= 0 ? 0 : 1;
    const j = joints[side];
    const base = side * SIDE_SEGS;
    const seg = s => (s === 0 ? 0 : base + s);

    if (k === 1) {
      // Chest and back muscles: the part out past the ribs follows the arm.
      const w = smooth(0.12, 0.175, Math.abs(p.x)) * smooth(1.05, 1.18, p.y);
      if (w > 0) {
        segA[v] = 0;
        segB[v] = seg(SEG.upper);
        blend[v] = w;
      }
      continue;
    }

    const tUpper = along(j.shoulder, j.elbow);
    const tFore = along(j.elbow, j.wrist);
    const tHand = along(j.wrist, j.knuckle);
    if (tFore < -0.12) {
      segA[v] = 0;
      segB[v] = seg(SEG.upper);
      blend[v] = smooth(-0.08, 0.28, tUpper);
    } else if (tFore < 0.12) {
      segA[v] = seg(SEG.upper);
      segB[v] = seg(SEG.fore);
      blend[v] = smooth(-0.12, 0.12, tFore);
      twist[v] = Math.max(0, tFore);
    } else if (tHand < -0.3) {
      segA[v] = seg(SEG.fore);
      segB[v] = seg(SEG.fore);
      twist[v] = Math.min(1, tFore);
    } else if (tHand < 0.25) {
      segA[v] = seg(SEG.fore);
      segB[v] = seg(SEG.hand);
      blend[v] = smooth(-0.3, 0.25, tHand);
      twist[v] = 1;
    } else {
      segA[v] = seg(SEG.hand);
      segB[v] = seg(SEG.hand);
      twist[v] = 1;
    }
  }
  return { segA, segB, blend, twist };
}

// A rotation that turns one frame (direction + a second direction) into
// another. Used to aim a bone and say which way its elbow points.
function frameRotation(fromDir, fromSide, toDir, toSide) {
  const basis = (d, s) => {
    const x = d.clone().normalize();
    const y = s.clone().sub(x.clone().multiplyScalar(s.dot(x))).normalize();
    const z = new Vector3().crossVectors(x, y);
    return new Matrix4().makeBasis(x, y, z);
  };
  const from = basis(fromDir, fromSide);
  const to = basis(toDir, toSide);
  return new Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
}

// The whole body: tipped forward by (90° − incline), toes at (0, toeY, 0).
function bodyTransform(incline, toeY = 0) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 - incline);
  const toe = v3(TOE).applyQuaternion(q);
  return { q, offset: toe.negate().add(new Vector3(0, toeY, 0)) };
}
const placeBody = (body, point) => point.clone().applyQuaternion(body.q).add(body.offset);

// The upper body for the pike: hips at hipWorld, torso pointing `down`
// radians below level toward the hands.
function torsoTransform(down, hipWorld) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 + down);
  return { q, offset: hipWorld.clone().sub(v3(HIP).applyQuaternion(q)) };
}

// Find the first angle from `from` toward `to` (in `step`s) where test passes.
function search(test, from, to, step) {
  for (let a = from; step > 0 ? a <= to : a >= to; a += step) if (test(a)) return a;
  return to;
}

/**
 * Builds the push-up or a variant: finds the top and bottom body angles and
 * where the hands go. Call once; then pose(depth) for each frame.
 *
 * Options (metres): handWidth (each hand out from under its shoulder;
 * negative is inward), handForward (toward the head), chestGap, flare (how
 * far the elbows point out), handTurn (fingers out, or in when negative),
 * handHeight (hands on a bench), footHeight (feet on a bench), pike (hips
 * up, head down between the hands) and forearms (a forearm plank, held).
 */
export function makePushup({
  handWidth = 0.07, handForward = 0.03, chestGap = 0.05, flare = 0.75, handTurn = 0.18,
  handHeight = 0, footHeight = 0, pike = false, forearms = false,
} = {}) {
  const joints = restJoints();
  const lenUpper = joints[0].shoulder.distanceTo(joints[0].elbow);
  const lenFore = joints[0].elbow.distanceTo(joints[0].wrist);
  const reach = lenUpper + lenFore;
  const wristHeight = handHeight + 0.03;
  const props = [];
  if (footHeight > 0) props.push({ center: [0, footHeight / 2, -0.12], size: [0.6, footHeight, 0.4] });

  // Elbows point back toward the feet and out a little.
  const poles = [new Vector3(flare, 0.25, -1), new Vector3(-flare, 0.25, -1)];
  const elbowFor = (shoulder, wrist, side) => {
    // Two-bone reach: where the elbow sits so both bones keep their length.
    const toWrist = wrist.clone().sub(shoulder);
    const d = Math.min(toWrist.length(), reach - 1e-4);
    const dir = toWrist.clone().normalize();
    const pole = poles[side].clone();
    pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const a = (lenUpper * lenUpper - lenFore * lenFore + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, lenUpper * lenUpper - a * a));
    return { elbow: shoulder.clone().add(dir.clone().multiplyScalar(a)).add(pole.clone().multiplyScalar(h)), pole };
  };

  // bodyAt(x) gives { body, legs? } for the rig's angle x, from top to bottom.
  let bodyAt;
  let top;
  let bottom;
  let wrists;
  let elbowsOnFloor = null;
  const shouldersAt = x => joints.map(j => placeBody(bodyAt(x).body, j.shoulder));
  const handsUnder = (shoulders, forward) =>
    shoulders.map((s, side) => new Vector3(s.x + (side === 0 ? handWidth : -handWidth), wristHeight, s.z + forward));

  if (pike) {
    // Torso 60° below level with the arms on its line at the top. Going down,
    // the legs tip forward around the toes, so the hips drop and come forward
    // with the torso at the same slope, and the head lands past the hands.
    const down = Math.PI / 3;
    const along = new Vector3(0, -Math.sin(down), Math.cos(down));
    const hipOf = legUp => placeBody(bodyTransform(legUp), v3(HIP));
    const armsLanded = legUp => {
      const t = torsoTransform(down, hipOf(legUp));
      return placeBody(t, joints[0].shoulder).y - reach * 0.985 * Math.sin(down) <= wristHeight;
    };
    const legUp0 = search(armsLanded, 1.5, 0.3, -0.0005);
    bodyAt = x => ({ body: torsoTransform(down, hipOf(legUp0 - x)), legs: bodyTransform(legUp0 - x) });
    top = 0;
    wrists = shouldersAt(0).map((s, side) => {
      const w = s.clone().add(along.clone().multiplyScalar(reach * 0.985));
      return new Vector3(w.x + (side === 0 ? handWidth : -handWidth), wristHeight, w.z + handForward);
    });
    // Bottom: the top of the head near the floor, or the elbows over the
    // hands (any further and the shoulders would be past them).
    bottom = search(x => {
      if (placeBody(bodyAt(x).body, v3(CROWN)).y <= 0.06) return true;
      const s = shouldersAt(x)[0];
      return elbowFor(s, wrists[0], 0).elbow.z >= wrists[0].z;
    }, 0, 0.8, 0.0005);
  } else if (forearms) {
    // Elbows on the floor under the shoulders, forearms flat toward the head.
    bodyAt = x => ({ body: bodyTransform(x, footHeight) });
    top = search(x => shouldersAt(x)[0].y >= lenUpper + 0.045, 0, 0.8, 0.0005);
    bottom = top;
    const shoulders = shouldersAt(top);
    elbowsOnFloor = shoulders.map(s => new Vector3(s.x, 0.045, s.z));
    wrists = elbowsOnFloor.map((e, side) => new Vector3(e.x + (side === 0 ? handWidth : -handWidth), 0.035, e.z + Math.sqrt(lenFore ** 2 - 0.0001 - handWidth ** 2)));
  } else {
    bodyAt = x => ({ body: bodyTransform(x, footHeight) });
    const chestAt = x => placeBody(bodyAt(x).body, v3(CHEST));
    if (handHeight > 0) {
      // Hands on a bench: find the bottom (chest just above the bench) first,
      // put the hands under the chest there, then the top is where the arms
      // are straight.
      bottom = search(x => chestAt(x).y > handHeight + chestGap, 0, 1.4, 0.0005) - 0.0005;
      wrists = handsUnder(shouldersAt(bottom), 0).map(w => w.setZ(chestAt(bottom).z - 0.02 + handForward));
      top = search(x => shouldersAt(x)[0].distanceTo(wrists[0]) >= reach * 0.985, bottom, 1.4, 0.0005);
      // The bench: its near edge just behind the hands.
      props.push({ center: [0, handHeight / 2, wrists[0].z + 0.17], size: [0.9, handHeight, 0.4] });
    } else {
      // Top: arms almost straight and straight down.
      top = search(x => shouldersAt(x)[0].y - wristHeight >= reach * 0.985, -0.8, 0.8, 0.0005);
      wrists = handsUnder(shouldersAt(top), handForward);
      // Hands in or back from under the shoulders (the diamond) are further
      // away: drop the top until the arms reach them.
      top = search(x => shouldersAt(x)[0].distanceTo(wrists[0]) <= reach * 0.985, top, -0.9, -0.0005);
      // Bottom: chest a few centimetres off the floor, or the elbows or face
      // close to it, whichever comes first.
      const low = x => {
        if (chestAt(x).y <= chestGap) return true;
        if (placeBody(bodyAt(x).body, v3(FACE)).y <= 0.06) return true;
        return shouldersAt(x).some((s, side) => elbowFor(s, wrists[side], side).elbow.y <= 0.07);
      };
      bottom = search(low, top, -0.9, -0.0005);
    }
  }

  const restBack = new Vector3(0, 0, -1); // in the model the elbow points back
  const restFront = new Vector3(0, 0, 1);

  function pose(depth) {
    const x = top + (bottom - top) * depth;
    const { body, legs } = bodyAt(x);
    const sides = joints.map((j, side) => {
      const shoulder = placeBody(body, j.shoulder);
      const wrist = wrists[side];
      const reached = elbowFor(shoulder, wrist, side);
      const elbow = elbowsOnFloor ? elbowsOnFloor[side] : reached.elbow;
      const pole = reached.pole;

      const upperDir = elbow.clone().sub(shoulder);
      const foreDir = wrist.clone().sub(elbow);
      const qUpper = frameRotation(j.elbow.clone().sub(j.shoulder), restBack, upperDir, pole);
      const qFore = frameRotation(j.wrist.clone().sub(j.elbow), restBack, foreDir, pole);

      // Hand flat on the floor, fingers toward the head and turned out a touch
      // (or in, for the diamond).
      const fingers = new Vector3(side === 0 ? handTurn : -handTurn, 0, 1).normalize();
      const qHand = frameRotation(j.knuckle.clone().sub(j.wrist), restBack, fingers, new Vector3(0, 1, 0));

      // Forearm twist: at the wrist, the forearm's thumb side must match the
      // hand's. Turn around the forearm's own line to get there.
      const restThumb = new Vector3(side === 0 ? 1 : -1, 0, 0);
      const handThumb = restThumb.clone().applyQuaternion(qHand);
      const foreThumb = restThumb.clone().applyQuaternion(qFore);
      const axis = foreDir.clone().normalize();
      const flat = v => v.clone().sub(axis.clone().multiplyScalar(v.dot(axis))).normalize();
      const ft = flat(foreThumb);
      const ht = flat(handThumb);
      const angle = Math.atan2(new Vector3().crossVectors(ft, ht).dot(axis), ft.dot(ht));
      const qForeWrist = new Quaternion().setFromAxisAngle(axis, angle).multiply(qFore);

      return { shoulder, elbow, wrist, qUpper, qFore, qForeWrist, qHand, twistAxis: axis, twistAngle: angle };
    });
    return { body, legs, hip: legs ? placeBody(legs, v3(HIP)) : null, sides, incline: x };
  }

  // Where the camera looks: the middle of the box the body moves through,
  // and how tall that box is (so the camera can step back for a tall pose).
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const depth of [0, 1]) {
    const p = pose(depth);
    const lower = p.legs ?? p.body;
    const points = [placeBody(lower, v3(TOE)), placeBody(lower, v3(HIP)), placeBody(p.body, v3(CROWN)), placeBody(p.body, v3(FACE))];
    for (const s of p.sides) points.push(s.shoulder, s.elbow, s.wrist);
    for (const pt of points) {
      lo.min(pt);
      hi.max(pt);
    }
  }
  // (Nudged so the plain push-up keeps the view it was tuned with.)
  const focus = lo.clone().add(hi).multiplyScalar(0.5).add(new Vector3(0, -0.04, -0.03));
  const height = hi.y - Math.min(0, lo.y);

  return { pose, top, bottom, restFront, props, focus, height };
}

/**
 * Moves every vertex (and normal) into the pose. Writes into outPos/outNorm.
 */
export function skin(rest, restNormals, binding, posed, outPos, outNorm) {
  const { segA, segB, blend, twist } = binding;
  const joints = restJoints();
  const { body, legs, hip, sides } = posed;
  const n = rest.length / 3;
  const qa = new Quaternion();
  const qb = new Quaternion();
  const q = new Quaternion();
  const p = new Vector3();
  const nrm = new Vector3();

  const hipRest = v3(HIP);
  const segQuat = (seg, t, out) => {
    if (seg === 0 || (seg === LEGS && !legs)) return out.copy(body.q);
    if (seg === LEGS) return out.copy(legs.q);
    const s = sides[seg >= SIDE_SEGS ? 1 : 0];
    const k = seg % SIDE_SEGS;
    if (k === SEG.upper) return out.copy(s.qUpper);
    if (k === SEG.hand) return out.copy(s.qHand);
    if (t >= 1) return out.copy(s.qForeWrist);
    return out.setFromAxisAngle(s.twistAxis, s.twistAngle * t).multiply(s.qFore);
  };

  for (let v = 0; v < n; v++) {
    const i = v * 3;
    p.set(rest[i], rest[i + 1], rest[i + 2]);
    nrm.set(restNormals[i], restNormals[i + 1], restNormals[i + 2]);
    const a = segA[v];
    const b = segB[v];
    if ((a === 0 && b === 0) || (b === LEGS && !legs)) {
      p.applyQuaternion(body.q).add(body.offset);
      nrm.applyQuaternion(body.q);
    } else if (b === LEGS) {
      // Between the torso and the legs: turn around the hips.
      segQuat(a, 0, qa);
      q.copy(qa).slerp(legs.q, blend[v]);
      p.sub(hipRest).applyQuaternion(q).add(hip);
      nrm.applyQuaternion(q);
    } else {
      const side = Math.max(a, b) >= SIDE_SEGS ? 1 : 0;
      const j = joints[side];
      const s = sides[side];
      const ka = a % SIDE_SEGS;
      const kb = b % SIDE_SEGS;
      const hi = Math.max(a === 0 ? 0 : ka, kb);
      // Turn around the joint shared by the two segments.
      let pivotRest;
      let pivotWorld;
      if (hi === SEG.upper) {
        pivotRest = j.shoulder;
        pivotWorld = s.shoulder;
      } else if (hi === SEG.fore) {
        pivotRest = j.elbow;
        pivotWorld = s.elbow;
      } else {
        pivotRest = j.wrist;
        pivotWorld = s.wrist;
      }
      if (ka === SEG.fore && kb === SEG.fore) {
        pivotRest = j.elbow;
        pivotWorld = s.elbow;
      }
      segQuat(a, twist[v], qa);
      segQuat(b, twist[v], qb);
      const w = blend[v];
      if (w <= 0) q.copy(qa);
      else if (w >= 1) q.copy(qb);
      else q.copy(qa).slerp(qb, w);
      p.sub(pivotRest).applyQuaternion(q).add(pivotWorld);
      nrm.applyQuaternion(q);
    }
    outPos[i] = p.x;
    outPos[i + 1] = p.y;
    outPos[i + 2] = p.z;
    outNorm[i] = nrm.x;
    outNorm[i + 1] = nrm.y;
    outNorm[i + 2] = nrm.z;
  }
}
