// Poses BodyFox's standing 3D anatomy for the standing and lying exercises:
// squats, hinges and bridges. The pose itself comes from model/bodyPoses.js
// (the 2D drawing uses the same one); this file turns it into a skeleton the
// mesh can follow.
//
// The skeleton: the trunk (pelvis, spine, head) as one piece, and on each
// side an upper arm, forearm and hand, and a thigh, shin and foot. Every
// vertex follows one segment, or blends between two around the joint they
// share, so muscles bend instead of tearing.
//
// Pure maths on three.js vectors: no scene, so tests can run it in Node.

import { Matrix4, Quaternion, Vector3 } from "three";

import { solveBody } from "../model/bodyPoses.js";
import { isArmPart } from "./pushupRig.js";

// Joint centres on the model's left side (BodyParts3D, metres; +x is the
// person's left, +y up, +z the front). The right side mirrors x.
const LEFT = {
  shoulder: [0.168, 1.31, 0.074],
  elbow: [0.203, 1.045, 0.083],
  wrist: [0.246, 0.802, 0.117],
  knuckle: [0.262, 0.722, 0.127],
  hip: [0.085, 0.81, 0.08],
  knee: [0.078, 0.385, 0.085],
  ankle: [0.072, -0.01, 0.075],
};
const HIP_MID = [0, 0.81, 0.08];

// Segment ids. 0 is the trunk; each side has six.
export const SEG = { trunk: 0, upper: 1, fore: 2, hand: 3, thigh: 4, shin: 5, foot: 6 };
const PER_SIDE = 6;
const segId = (side, k) => (k === 0 ? 0 : side * PER_SIDE + k);
const kindOf = seg => (seg === 0 ? 0 : ((seg - 1) % PER_SIDE) + 1);
const sideOf = seg => (seg > PER_SIDE ? 1 : 0);

const v3 = a => new Vector3(...a);
const mirror = a => [-a[0], a[1], a[2]];
const sideJoints = side => Object.fromEntries(Object.entries(LEFT).map(([k, v]) => [k, v3(side ? mirror(v) : v)]));
const JOINTS = [sideJoints(0), sideJoints(1)];

// Where each segment turns from: its joint nearest the trunk.
const ROOT = { 1: "shoulder", 2: "elbow", 3: "wrist", 4: "hip", 5: "knee", 6: "ankle" };
const rootRest = seg => (seg === 0 ? v3(HIP_MID) : JOINTS[sideOf(seg)][ROOT[kindOf(seg)]]);

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Chest and back muscles that reach the upper arm: their outer ends follow it.
const REACHES_ARM = /pectoralis major|latissimus|teres major|subscapularis|infraspinatus|supraspinatus|teres minor/;
// The pelvis stays with the trunk, all of it.
const PELVIS = /hip bone|sacrum|coccyx|ilium|ischium|pubis/;

/**
 * Binds vertices to the skeleton: per-vertex segA, segB (Uint8) and blend
 * (Float32, 0 = all segA, 1 = all segB). segB is the segment further from
 * the trunk, and the vertex turns around its root joint.
 */
export function bindBody(positions, partIndex, parts) {
  const n = positions.length / 3;
  const segA = new Uint8Array(n);
  const segB = new Uint8Array(n);
  const blend = new Float32Array(n);
  const kind = parts.map(p => {
    const name = p.name.toLowerCase();
    if (isArmPart(p)) return 2;
    if (REACHES_ARM.test(name)) return 1;
    if (PELVIS.test(name)) return 3;
    return 0;
  });
  const hipY = LEFT.hip[1];
  const kneeY = LEFT.knee[1];
  const ankleY = LEFT.ankle[1];
  const p = new Vector3();
  const tmp = new Vector3();
  const along = (from, to) => {
    tmp.subVectors(to, from);
    return p.clone().sub(from).dot(tmp) / tmp.lengthSq();
  };
  const set = (v, a, b, w) => {
    segA[v] = a;
    segB[v] = b;
    blend[v] = w;
  };

  for (let v = 0; v < n; v++) {
    const k = kind[partIndex[v]] ?? 0;
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    const side = p.x >= 0 ? 0 : 1;
    const seg = s => segId(side, s);
    if (k === 3) continue;
    if (k === 1) {
      const w = smooth(0.12, 0.175, Math.abs(p.x)) * smooth(1.05, 1.18, p.y);
      if (w > 0) set(v, 0, seg(SEG.upper), w);
      continue;
    }
    if (k === 2) {
      const j = JOINTS[side];
      const tUpper = along(j.shoulder, j.elbow);
      const tFore = along(j.elbow, j.wrist);
      const tHand = along(j.wrist, j.knuckle);
      if (tFore < -0.12) set(v, 0, seg(SEG.upper), smooth(-0.08, 0.28, tUpper));
      else if (tFore < 0.12) set(v, seg(SEG.upper), seg(SEG.fore), smooth(-0.12, 0.12, tFore));
      else if (tHand < -0.3) set(v, seg(SEG.fore), seg(SEG.fore), 0);
      else if (tHand < 0.25) set(v, seg(SEG.fore), seg(SEG.hand), smooth(-0.3, 0.25, tHand));
      else set(v, seg(SEG.hand), seg(SEG.hand), 0);
      continue;
    }
    // Trunk and legs, by height.
    if (p.y > hipY + 0.1) continue;
    if (p.y > kneeY + 0.06) set(v, 0, seg(SEG.thigh), smooth(hipY + 0.1, hipY - 0.12, p.y));
    else if (p.y > kneeY - 0.06) set(v, seg(SEG.thigh), seg(SEG.shin), smooth(kneeY + 0.06, kneeY - 0.06, p.y));
    else if (p.y > ankleY + 0.04) set(v, seg(SEG.shin), seg(SEG.shin), 0);
    else set(v, seg(SEG.shin), seg(SEG.foot), smooth(ankleY + 0.04, ankleY - 0.03, p.y));
  }
  return { segA, segB, blend };
}

// A rotation that turns one frame (direction + a second direction) into another.
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

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const rotX = a => new Quaternion().setFromAxisAngle(X, a);
// (f, u) in the side-on plane to world, x given.
const world = ([f, u], x = 0) => new Vector3(x, u, f);

/**
 * Builds a standing or lying exercise. options.pose names one of the poses
 * in model/bodyPoses.js. Call once; then pose(depth, rep) for each frame.
 */
export function makeBody({ pose: poseName } = {}) {
  const upperLen = JOINTS[0].shoulder.distanceTo(JOINTS[0].elbow);
  const foreLen = JOINTS[0].elbow.distanceTo(JOINTS[0].wrist);
  const reach = upperLen + foreLen;
  const thighLen = JOINTS[0].hip.distanceTo(JOINTS[0].knee);
  const shinLen = JOINTS[0].knee.distanceTo(JOINTS[0].ankle);

  function pose(depth, rep) {
    const s2 = solveBody(poseName, depth, rep);
    const q = new Array(1 + 2 * PER_SIDE);
    const at = new Array(1 + 2 * PER_SIDE); // world position of each segment's root
    q[0] = rotX(s2.lean);
    at[0] = world(s2.hip);
    const place = (seg, restPoint) => restPoint.clone().sub(rootRest(seg)).applyQuaternion(q[seg]).add(at[seg]);

    // Legs: from each hip to the ankle the side-on pose gives, set out to
    // the side by the stance width, the knee bending toward the front of the
    // leg (and out, for a squat).
    s2.legs.forEach((leg, side) => {
      const out = side === 0 ? 1 : -1;
      const j = JOINTS[side];
      const thigh = segId(side, SEG.thigh);
      const shin = segId(side, SEG.shin);
      const foot = segId(side, SEG.foot);
      const hip = place(0, j.hip);
      const want = world(leg.ankle, j.hip.x + out * (leg.width ?? 0));
      const toAnkle = want.clone().sub(hip);
      const d = Math.min(toAnkle.length(), thighLen + shinLen - 1e-4);
      const dir = toAnkle.normalize();
      // The knee's way: off the hip→ankle line in the side-on pose, or the
      // front of the thigh when the leg is straight.
      const h2 = leg.hip;
      const line = [leg.ankle[0] - h2[0], leg.ankle[1] - h2[1]];
      const ll = Math.hypot(...line) || 1;
      const k2 = [leg.knee[0] - h2[0], leg.knee[1] - h2[1]];
      const along2 = (k2[0] * line[0] + k2[1] * line[1]) / (ll * ll);
      let off = [k2[0] - line[0] * along2, k2[1] - line[1] * along2];
      if (Math.hypot(...off) < 0.01) off = [Math.cos(leg.thigh), Math.sin(leg.thigh)];
      const offLen = Math.hypot(...off);
      const pole = world([off[0] / offLen, off[1] / offLen], out * (leg.kneeOut ?? 0));
      pole.sub(dir.clone().multiplyScalar(pole.dot(dir)));
      if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1);
      pole.normalize();
      const a = (thighLen * thighLen - shinLen * shinLen + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, thighLen * thighLen - a * a));
      const knee = hip.clone().add(dir.clone().multiplyScalar(a)).add(pole.clone().multiplyScalar(h));
      const ankle = hip.clone().add(dir.clone().multiplyScalar(d));
      const front = new Vector3(0, 0, 1);
      q[thigh] = frameRotation(j.knee.clone().sub(j.hip), front, knee.clone().sub(hip), pole);
      at[thigh] = hip;
      q[shin] = frameRotation(j.ankle.clone().sub(j.knee), front, ankle.clone().sub(knee), pole);
      at[shin] = knee;
      q[foot] = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -out * (leg.toes ?? 0)).multiply(rotX(leg.foot));
      at[foot] = ankle;
    });

    // Arms: reach from the shoulder toward the wrist the pose asks for.
    const sides = s2.arms.map((arm, side) => {
      const j = JOINTS[side];
      const out = side === 0 ? 1 : -1;
      const shoulder = place(0, j.shoulder);
      const offset = world([arm.wrist[0] - arm.shoulder[0], arm.wrist[1] - arm.shoulder[1]], out * arm.side);
      let wrist = shoulder.clone().add(offset);
      // Side offsets are from the shoulder as it stands; keep them in reach.
      const toWrist = wrist.clone().sub(shoulder);
      const d = Math.min(toWrist.length(), reach - 1e-4);
      const dir = toWrist.normalize();
      wrist = shoulder.clone().add(dir.clone().multiplyScalar(d));
      const pole = world([arm.pole[0], arm.pole[1]], out * (arm.pole[2] ?? 0));
      pole.sub(dir.clone().multiplyScalar(pole.dot(dir)));
      if (pole.lengthSq() < 1e-8) pole.set(out, 0, 0);
      pole.normalize();
      const a = (upperLen * upperLen - foreLen * foreLen + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a));
      const elbow = shoulder.clone().add(dir.clone().multiplyScalar(a)).add(pole.clone().multiplyScalar(h));
      const back = new Vector3(0, 0, -1);
      const qUpper = frameRotation(j.elbow.clone().sub(j.shoulder), back, elbow.clone().sub(shoulder), pole);
      const qFore = frameRotation(j.wrist.clone().sub(j.elbow), back, wrist.clone().sub(elbow), pole);
      const upper = segId(side, SEG.upper);
      const fore = segId(side, SEG.fore);
      const hand = segId(side, SEG.hand);
      q[upper] = qUpper;
      at[upper] = shoulder;
      q[fore] = qFore;
      at[fore] = elbow;
      q[hand] = qFore;
      at[hand] = wrist;
      const grip = j.knuckle.clone().sub(j.wrist).multiplyScalar(0.55).applyQuaternion(qFore).add(wrist);
      return { shoulder, elbow, wrist, grip, armDir: dir };
    });

    const knees = [0, 1].map(s => at[segId(s, SEG.shin)]);
    const ankles = [0, 1].map(s => at[segId(s, SEG.foot)]);
    const hips = [0, 1].map(s => at[segId(s, SEG.thigh)]);
    return { q, at, sides, knees, ankles, hips, gear: gearFor(s2, sides, q[0]), flat: s2 };
  }

  // Where the camera looks: the middle of the box the body moves through.
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const [depth, air] of [[0, 0], [0.5, 0], [1, 0], [0, 1]]) {
    const p = pose(depth, { air });
    const crown = new Vector3(0, 1.645, 0.06).sub(v3(HIP_MID)).applyQuaternion(p.q[0]).add(p.at[0]);
    for (const pt of [crown, ...p.knees, ...p.ankles, ...p.hips, ...p.sides.flatMap(s => [s.shoulder, s.wrist])]) {
      lo.min(pt);
      hi.max(pt);
    }
  }
  const focus = lo.clone().add(hi).multiplyScalar(0.5);
  const height = hi.y - Math.min(0, lo.y);
  const length = hi.z - lo.z;
  const props = pose(0, {}).flat.props.map(p => ({ center: [0, p.center[1], p.center[0]], size: [p.width, p.size[1], p.size[0]] }));
  const gearKinds = pose(0, {}).gear.map(g => g.kind);

  return { pose, props, focus, height, length, upright: height > length, gearKinds, bind: bindBody, skin: skinBody };
}

// The weights, placed in the hands or where the pose says.
function gearFor(flat, sides, trunkQ) {
  return flat.gear.map(g => {
    const mid = sides[0].grip.clone().add(sides[1].grip).multiplyScalar(0.5);
    let position;
    let quaternion = new Quaternion();
    if (g.at === "hands") position = mid;
    else position = world(g.at);
    if (g.kind === "kettlebell") position = mid.clone().add(sides[0].armDir.clone().multiplyScalar(0.12));
    if (g.along === "trunk") quaternion = trunkQ.clone().multiply(new Quaternion().setFromAxisAngle(Z, Math.PI / 2));
    const out = { kind: g.kind, position, quaternion };
    if (g.kind === "dumbbells") out.positions = sides.map(s => s.grip.clone());
    return out;
  });
}

/** Moves every vertex (and normal) into the pose. Writes into outPos/outNorm. */
export function skinBody(rest, restNormals, binding, posed, outPos, outNorm) {
  const { segA, segB, blend } = binding;
  const { q: quats, at } = posed;
  const n = rest.length / 3;
  const roots = quats.map((_, seg) => rootRest(seg));
  const q = new Quaternion();
  const p = new Vector3();
  const nrm = new Vector3();
  for (let v = 0; v < n; v++) {
    const i = v * 3;
    p.set(rest[i], rest[i + 1], rest[i + 2]);
    nrm.set(restNormals[i], restNormals[i + 1], restNormals[i + 2]);
    const a = segA[v];
    const b = segB[v];
    const w = blend[v];
    if (a === b || w <= 0) q.copy(quats[a]);
    else if (w >= 1) q.copy(quats[b]);
    else q.copy(quats[a]).slerp(quats[b], w);
    // Turn around the root of the outer segment, which both sides share.
    const pivot = a === b ? a : b;
    p.sub(roots[pivot]).applyQuaternion(q).add(at[pivot]);
    nrm.applyQuaternion(q);
    outPos[i] = p.x;
    outPos[i + 1] = p.y;
    outPos[i + 2] = p.z;
    outNorm[i] = nrm.x;
    outNorm[i + 1] = nrm.y;
    outNorm[i + 2] = nrm.z;
  }
}

