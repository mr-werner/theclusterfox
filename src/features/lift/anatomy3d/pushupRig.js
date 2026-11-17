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

export const SEG = { body: 0, upper: 1, fore: 2, hand: 3 };
const SIDE_SEGS = 4; // segment ids: side 0 (left) 0–3, side 1 (right) 4–7; body is 0 on both

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
    if (k === 0) continue; // body, the default
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
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

// The whole body: tipped forward by (90° − incline), toes on the floor at the origin.
function bodyTransform(incline) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 - incline);
  const toe = v3(TOE).applyQuaternion(q);
  return { q, offset: toe.negate() };
}
const placeBody = (body, point) => point.clone().applyQuaternion(body.q).add(body.offset);

/**
 * Builds the push-up: finds the top and bottom body angles and where the
 * hands go. Call once; then pose(depth) for each frame.
 */
export function makePushup({ handWidth = 0.07, handForward = 0.03, chestGap = 0.05, flare = 0.75 } = {}) {
  const joints = restJoints();
  const lenUpper = joints[0].shoulder.distanceTo(joints[0].elbow);
  const lenFore = joints[0].elbow.distanceTo(joints[0].wrist);
  const wristHeight = 0.03;

  // Top: arms almost straight and straight down.
  let top = 0;
  for (let a = 0; a < 0.8; a += 0.0005) {
    const s = placeBody(bodyTransform(a), joints[0].shoulder);
    if (s.y - wristHeight >= (lenUpper + lenFore) * 0.985) {
      top = a;
      break;
    }
  }
  const topShoulders = joints.map(j => placeBody(bodyTransform(top), j.shoulder));
  const wrists = topShoulders.map((s, side) =>
    new Vector3(s.x + (side === 0 ? handWidth : -handWidth), wristHeight, s.z + handForward));

  // Bottom: chest a few centimetres off the floor.
  let bottom = top;
  for (let a = top; a > 0; a -= 0.0005) {
    bottom = a;
    if (placeBody(bodyTransform(a), v3(CHEST)).y <= chestGap) break;
  }

  // Elbows point back toward the feet and out a little.
  const poles = [new Vector3(flare, 0.25, -1), new Vector3(-flare, 0.25, -1)];
  const restBack = new Vector3(0, 0, -1); // in the model the elbow points back
  const restFront = new Vector3(0, 0, 1);

  function pose(depth) {
    const incline = top + (bottom - top) * depth;
    const body = bodyTransform(incline);
    const sides = joints.map((j, side) => {
      const shoulder = placeBody(body, j.shoulder);
      const wrist = wrists[side];
      // Two-bone reach: where the elbow sits so both bones keep their length.
      const toWrist = wrist.clone().sub(shoulder);
      const reach = Math.min(toWrist.length(), lenUpper + lenFore - 1e-4);
      const dir = toWrist.clone().normalize();
      const pole = poles[side].clone();
      pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const a = (lenUpper * lenUpper - lenFore * lenFore + reach * reach) / (2 * reach);
      const h = Math.sqrt(Math.max(0, lenUpper * lenUpper - a * a));
      const elbow = shoulder.clone().add(dir.clone().multiplyScalar(a)).add(pole.clone().multiplyScalar(h));

      const upperDir = elbow.clone().sub(shoulder);
      const foreDir = wrist.clone().sub(elbow);
      const qUpper = frameRotation(j.elbow.clone().sub(j.shoulder), restBack, upperDir, pole);
      const qFore = frameRotation(j.wrist.clone().sub(j.elbow), restBack, foreDir, pole);

      // Hand flat on the floor, fingers toward the head and turned out a touch.
      const fingers = new Vector3(side === 0 ? 0.18 : -0.18, 0, 1).normalize();
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
    return { body, sides, incline };
  }

  return { pose, top, bottom, restFront };
}

/**
 * Moves every vertex (and normal) into the pose. Writes into outPos/outNorm.
 */
export function skin(rest, restNormals, binding, posed, outPos, outNorm) {
  const { segA, segB, blend, twist } = binding;
  const joints = restJoints();
  const { body, sides } = posed;
  const n = rest.length / 3;
  const qa = new Quaternion();
  const qb = new Quaternion();
  const q = new Quaternion();
  const p = new Vector3();
  const nrm = new Vector3();

  const segQuat = (seg, t, out) => {
    if (seg === 0) return out.copy(body.q);
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
    if (a === 0 && b === 0) {
      p.applyQuaternion(body.q).add(body.offset);
      nrm.applyQuaternion(body.q);
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
