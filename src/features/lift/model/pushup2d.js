// The 2D push-up: a side-on body drawn as muscle shapes riding on a simple
// skeleton. Lengths are in centimetres; the drawing scales them.
//
// Each muscle is a closed outline in its bone's own frame: u runs along the
// bone (0 at its start, 1 at its end) and v is centimetres to the side, with
// +v toward the front of the body (chest, quads, biceps). Posing the bones
// moves every outline with them.

const L = { foot: 12, leg: 88, knee: 0.49, torso: 50, neck: 11, head: 10.5, upper: 30, fore: 27, hand: 17 };
export const FLOOR = 92;
const TOE_X = 22;

// Shapes. muscle: which activation entry colours it (null = always grey).
export const SHAPES = {
  torso: [
    { muscle: null, base: true, pts: [[-0.06, -11], [0.2, -9], [0.45, -8], [0.7, -10], [0.95, -9], [1.06, -5], [1.08, 0], [1.0, 6], [0.86, 12], [0.6, 10], [0.35, 9], [0.1, 9], [-0.08, 6], [-0.12, -4]] },
    { muscle: "glutes", pts: [[-0.12, -3], [-0.1, -9.5], [0.04, -11.2], [0.17, -9], [0.13, -4], [0, -1.5]] },
    { muscle: "lowerBack", pts: [[0.12, -8.6], [0.46, -7.8], [0.5, -5.6], [0.15, -5.4]] },
    { muscle: "obliques", pts: [[0.1, 6], [0.5, 6.6], [0.58, 1.5], [0.48, -3.8], [0.18, -3.6], [0.06, 1]] },
    { muscle: "abs", pts: [[0.1, 9], [0.36, 9.2], [0.6, 10], [0.64, 7.4], [0.36, 7], [0.12, 6.6]], lines: [[0.24, 6.8, 0.24, 9.1], [0.38, 7, 0.38, 9.3], [0.51, 7.2, 0.51, 9.6]] },
    { muscle: "lats", pts: [[0.46, -3.6], [0.62, 0.4], [0.84, -1.5], [0.92, -7], [0.72, -9.6], [0.5, -7.4]] },
    { muscle: "serratus", pts: [[0.6, 1.6], [0.62, 6.4], [0.74, 6.8], [0.8, 2], [0.7, 0.4]], lines: [[0.66, 1.2, 0.66, 6.6], [0.72, 1, 0.72, 6.8]] },
    { muscle: "traps", pts: [[0.84, -8.8], [1.0, -8.6], [1.12, -4.5], [1.14, -0.5], [1.0, -2.4], [0.9, -5]] },
    { muscle: "pecMajor", pts: [[0.62, 7], [0.74, 11.4], [0.88, 12.4], [1.0, 8.4], [1.0, 3.4], [0.86, 2.2], [0.72, 3.4]], lines: [[0.8, 3, 0.8, 11.8], [0.9, 2.8, 0.92, 11]] },
  ],
  leg: [
    { muscle: null, base: true, pts: [[0, -3.5], [0.2, -6.5], [0.42, -6.2], [0.5, -4.5], [0.7, -7.5], [0.95, -9], [1.02, -4], [1.0, 8.5], [0.78, 8.2], [0.52, 4.5], [0.42, 3.4], [0.15, 3.5], [0, 3]] },
    { muscle: null, pts: [[0.05, 0.2], [0.3, 3.8], [0.47, 3.4], [0.45, 0], [0.1, -0.6]] },
    { muscle: "calves", pts: [[0.1, -2.6], [0.24, -6.8], [0.42, -6.6], [0.5, -2.8], [0.3, -0.2]] },
    { muscle: "hamstrings", pts: [[0.52, -3.4], [0.7, -7.4], [0.94, -8.6], [0.99, -1.4], [0.62, -0.4]] },
    { muscle: "quads", pts: [[0.51, 3.8], [0.76, 8.6], [0.97, 8.4], [0.99, 0.6], [0.76, -0.2], [0.55, -0.6]], lines: [[0.62, 2.4, 0.96, 4.8]] },
  ],
  upper: [
    { muscle: null, base: true, pts: [[-0.1, -6], [0.3, -5.6], [0.7, -5.6], [1.05, -3.6], [1.08, 3.2], [0.7, 4.8], [0.3, 5.2], [-0.12, 6], [-0.22, 0]] },
    { muscle: "triceps", pts: [[0.24, -1.2], [0.3, -5.4], [0.62, -6], [0.92, -4], [1.02, -1.6], [0.6, -0.6]], lines: [[0.4, -2.4, 0.86, -3.4]] },
    { muscle: "biceps", pts: [[0.36, 1], [0.42, 4.6], [0.72, 5.2], [0.93, 2.8], [0.97, 0.6], [0.6, 0]] },
    { muscle: "sideDelt", pts: [[-0.14, -3], [-0.05, -6.6], [0.22, -5.8], [0.46, -1.2], [0.42, 0.2], [0.08, 0], [-0.16, 1]] },
    { muscle: "frontDelt", pts: [[-0.16, 1], [-0.06, 5.8], [0.16, 6.6], [0.44, 3.2], [0.42, 0.2], [0.08, 0]] },
  ],
  fore: [
    { muscle: null, base: true, pts: [[-0.06, -3.6], [0.3, -4.6], [0.75, -3.2], [1.0, -2], [1.0, 2], [0.7, 3.4], [0.3, 4.8], [-0.05, 4]] },
    { muscle: "forearms", pts: [[0, -3], [0.3, -4.1], [0.68, -2.8], [0.94, -1.4], [0.94, 1.4], [0.66, 3], [0.3, 4.3], [0, 3.4]], lines: [[0.1, 0.4, 0.9, 0.2]] },
  ],
  hand: [
    { muscle: null, base: true, pts: [[0, -1.6], [0.5, -1.4], [1, -0.6], [1.02, 0.6], [0.5, 1.4], [0, 1.8]] },
  ],
  foot: [
    { muscle: null, base: true, pts: [[0, -2.4], [0.5, -2.6], [1.0, -2.8], [1.05, 2.2], [0.5, 2.8], [0, 2]] },
  ],
};

const rad = d => (d * Math.PI) / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

// Body line at an incline (degrees above the floor), toes resting at `toe`.
function bodyAt(incline, toe = [TOE_X, FLOOR]) {
  const dir = [Math.cos(rad(incline)), -Math.sin(rad(incline))]; // toward the head (svg y is down)
  const front = [-dir[1], dir[0]]; // toward the floor
  const ankle = add(toe, mul(front, -L.foot));
  const hip = add(ankle, mul(dir, L.leg));
  const shoulder = add(hip, mul(dir, L.torso));
  return { dir, front, toe, ankle, hip, shoulder, legDir: dir, legFront: front, footFront: dir };
}

// The pike: legs and torso meet at the hips in an upside-down V. Toes on the
// floor; `torsoDown` is how far the torso points below level, in degrees.
function pikeAt(torsoDown, hip, ankle, toe) {
  const dir = [Math.cos(rad(torsoDown)), Math.sin(rad(torsoDown))];
  const front = [-dir[1], dir[0]];
  const legDir = norm(sub(hip, ankle));
  return {
    dir, front, toe, ankle, hip,
    shoulder: add(hip, mul(dir, L.torso)),
    legDir, legFront: [-legDir[1], legDir[0]], footFront: legDir,
  };
}

function solveIncline(test, from, to, step) {
  for (let a = from; step > 0 ? a <= to : a >= to; a += step) if (test(a)) return a;
  return to;
}

// Two-bone reach: the elbow sits where both arm bones keep their length,
// pointing back toward the feet.
function poleFor(shoulder, wrist) {
  const dirW = norm(sub(wrist, shoulder));
  const pole = [-1, -0.25];
  return norm(sub(pole, mul(dirW, dot(pole, dirW))));
}
function elbowFor(b, wrist) {
  const reach = L.upper + L.fore;
  const toWrist = sub(wrist, b.shoulder);
  const d = Math.min(len(toWrist), reach - 1e-3);
  const a = (L.upper ** 2 - L.fore ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L.upper ** 2 - a * a));
  return add(add(b.shoulder, mul(norm(toWrist), a)), mul(poleFor(b.shoulder, wrist), h));
}

const chestOf = b => add(add(b.hip, mul(b.dir, L.torso * 0.85)), mul(b.front, 12.4));
const headOf = b => add(add(b.shoulder, mul(b.dir, L.neck + L.head * 0.6)), mul(b.front, 1.5));

/**
 * The push-up and its variants, side on. Options match the 3D rig's, in
 * metres: handHeight (hands on a bench), footHeight (feet on a bench),
 * handForward (hands toward the head; negative is under the chest), pike
 * (hips up) and forearms (a forearm plank, held still).
 */
export function makePushup2d({ handHeight = 0, footHeight = 0, handForward = 0, pike = false, forearms = false } = {}) {
  const cm = v => v * 100;
  const toe = [TOE_X, FLOOR - cm(footHeight)];
  const wristY = FLOOR - 2.5 - cm(handHeight);
  const reach = L.upper + L.fore;
  const props = [];
  if (footHeight > 0) props.push({ x: TOE_X - 26, y: toe[1], w: 32, h: cm(footHeight) });

  let bodyFor;
  let wrist;
  let top;
  let bottom;
  let elbowOnFloor = null;

  if (pike) {
    // Top: torso 60° below level with the arms carrying on its line. Going
    // down, the legs tip forward around the ankles so the hips come down and
    // forward with the torso at the same slope, and the head lands just in
    // front of the hands.
    const down = 60;
    const dir = [Math.cos(rad(down)), Math.sin(rad(down))];
    const ankle = add(toe, mul([-Math.cos(rad(55)), -Math.sin(rad(55))], L.foot));
    const hipY = wristY - (L.torso + reach * 0.985) * dir[1];
    const legUp = Math.asin(Math.min(1, (ankle[1] - hipY) / L.leg));
    const hipAt = t => add(ankle, [L.leg * Math.cos(legUp - rad(t)), -L.leg * Math.sin(legUp - rad(t))]);
    wrist = [hipAt(0)[0] + (L.torso + reach * 0.985) * dir[0], wristY];
    bodyFor = t => pikeAt(down, hipAt(t), ankle, toe);
    top = 0;
    // Bottom: the top of the head a few centimetres off the floor.
    bottom = solveIncline(t => {
      const b = bodyFor(t);
      return add(headOf(b), mul(b.dir, L.head * 0.82))[1] >= FLOOR - 4;
    }, 0, 40, 0.05);
  } else if (forearms) {
    // Elbows on the floor under the shoulders, forearms flat, body straight.
    const elbowY = FLOOR - 4.5;
    top = solveIncline(a => bodyAt(a, toe).shoulder[1] <= elbowY - L.upper, 0, 40, 0.05);
    bottom = top;
    const s = bodyAt(top, toe).shoulder;
    elbowOnFloor = [s[0] + 1, elbowY];
    wrist = add(elbowOnFloor, [L.fore, 0.5]);
    bodyFor = a => bodyAt(a, toe);
  } else {
    bodyFor = a => bodyAt(a, toe);
    // Bottom: chest a few centimetres above the floor or the bench.
    const chestDone = a => chestOf(bodyFor(a))[1] >= wristY - 3.5;
    if (handHeight > 0) {
      // Hands on a bench: find the bottom first, put the hands under the
      // chest there, then the top is where the arms are straight.
      bottom = solveIncline(a => !chestDone(a), 0, 80, 0.05) - 0.05;
      wrist = [chestOf(bodyFor(bottom))[0] - 3 + cm(handForward), wristY];
      top = solveIncline(a => len(sub(wrist, bodyFor(a).shoulder)) >= reach * 0.985, bottom, 80, 0.05);
      props.push({ x: wrist[0] - 4, y: FLOOR - cm(handHeight), w: 40, h: cm(handHeight) });
    } else {
      top = solveIncline(a => wristY - bodyFor(a).shoulder[1] >= reach * 0.985, -40, 40, 0.05);
      wrist = [bodyFor(top).shoulder[0] + 2 + cm(handForward), wristY];
      // ...or the elbows reach the floor, or the face does.
      const elbowLow = a => elbowFor(bodyFor(a), wrist)[1] >= FLOOR - 5;
      const faceLow = a => headOf(bodyFor(a))[1] + L.head * 0.82 >= FLOOR - 2;
      bottom = solveIncline(a => chestDone(a) || elbowLow(a) || faceLow(a), top, -40, -0.05);
    }
  }

  function pose(depth) {
    const b = bodyFor(top + (bottom - top) * depth);
    const pole = poleFor(b.shoulder, wrist);
    const elbow = elbowOnFloor ?? elbowFor(b, wrist);
    const head = headOf(b);
    const frontOf = (from, to) => {
      const dir = norm(sub(to, from));
      return norm(sub(mul(pole, -1), mul(dir, dot(mul(pole, -1), dir))));
    };
    return {
      body: b,
      head,
      bones: {
        foot: { from: b.toe, to: b.ankle, front: b.footFront },
        leg: { from: b.ankle, to: b.hip, front: b.legFront },
        torso: { from: b.hip, to: b.shoulder, front: b.front },
        upper: { from: b.shoulder, to: elbow, front: frontOf(b.shoulder, elbow) },
        fore: { from: elbow, to: wrist, front: frontOf(elbow, wrist) },
        hand: { from: wrist, to: add(wrist, [L.hand, 0.6]), front: [0, 1] },
      },
    };
  }

  // The drawing's frame: every outline over the rep, the head and the props.
  const xs = [];
  const ys = [FLOOR];
  for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
    const { bones, head } = pose(depth);
    for (const [name, bone] of Object.entries(bones)) {
      for (const shape of SHAPES[name]) {
        for (const p of placeShape(shape, bone)) {
          xs.push(p[0]);
          ys.push(p[1]);
        }
      }
    }
    xs.push(head[0] + L.head * 0.82, head[0] - L.head * 0.82);
    ys.push(head[1] - L.head * 0.82);
  }
  for (const p of props) xs.push(p.x, p.x + p.w);
  const minY = Math.min(...ys) - 3;
  const maxX = Math.max(...xs) + 4;
  const minX = Math.min(...xs) - 4;
  // At least 210 wide, with the body in the middle.
  const width = Math.max(210, maxX - minX);
  const view = [(minX + maxX - width) / 2, Math.min(19, minY), width, 0];
  view[3] = FLOOR + 6 - view[1];

  return { pose, top, bottom, props, view };
}

/** A shape's outline points in drawing space. */
export function placeShape(shape, bone) {
  const along = sub(bone.to, bone.from);
  return shape.pts.map(([u, v]) => add(add(bone.from, mul(along, u)), mul(bone.front, v)));
}

export function placeLines(shape, bone) {
  const along = sub(bone.to, bone.from);
  const at = (u, v) => add(add(bone.from, mul(along, u)), mul(bone.front, v));
  return (shape.lines ?? []).map(([u1, v1, u2, v2]) => [at(u1, v1), at(u2, v2)]);
}

/** A smooth closed path through the points (Catmull-Rom as cubic Béziers). */
export function smoothPath(pts) {
  const n = pts.length;
  const f = x => x.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

export const HEAD_R = L.head;
