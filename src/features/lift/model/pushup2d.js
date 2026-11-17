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

// Body line at an incline (degrees above the floor), toes on the floor.
function bodyAt(incline) {
  const dir = [Math.cos(rad(incline)), -Math.sin(rad(incline))]; // toward the head (svg y is down)
  const front = [-dir[1], dir[0]]; // toward the floor
  const toe = [TOE_X, FLOOR];
  const ankle = add(toe, mul(front, -L.foot));
  const hip = add(ankle, mul(dir, L.leg));
  const shoulder = add(hip, mul(dir, L.torso));
  return { dir, front, toe, ankle, hip, shoulder };
}

function solveIncline(test, from, to, step) {
  for (let a = from; step > 0 ? a <= to : a >= to; a += step) if (test(a)) return a;
  return to;
}

export function makePushup2d() {
  const wristY = FLOOR - 2.5;
  const reach = L.upper + L.fore;
  const top = solveIncline(a => FLOOR - 2.5 - bodyAt(a).shoulder[1] >= reach * 0.985, 0, 40, 0.05);
  const topBody = bodyAt(top);
  const wrist = [topBody.shoulder[0] + 2, wristY];
  // Bottom: chest a few centimetres above the floor.
  const bottom = solveIncline(a => {
    const b = bodyAt(a);
    const chest = add(add(b.hip, mul(b.dir, L.torso * 0.85)), mul(b.front, 12.4));
    return chest[1] >= FLOOR - 6;
  }, top, 0, -0.05);

  function pose(depth) {
    const b = bodyAt(top + (bottom - top) * depth);
    const toWrist = sub(wrist, b.shoulder);
    const d = Math.min(len(toWrist), reach - 1e-3);
    const dirW = norm(toWrist);
    // Elbow points back toward the feet.
    let pole = [-1, -0.25];
    pole = norm(sub(pole, mul(dirW, dot(pole, dirW))));
    const a = (L.upper ** 2 - L.fore ** 2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L.upper ** 2 - a * a));
    const elbow = add(add(b.shoulder, mul(dirW, a)), mul(pole, h));
    const head = add(add(b.shoulder, mul(b.dir, L.neck + L.head * 0.6)), mul(b.front, 1.5));
    const frontOf = (from, to) => {
      const dir = norm(sub(to, from));
      return norm(sub(mul(pole, -1), mul(dir, dot(mul(pole, -1), dir))));
    };
    return {
      body: b,
      head,
      bones: {
        foot: { from: b.toe, to: b.ankle, front: b.dir },
        leg: { from: b.ankle, to: b.hip, front: b.front },
        torso: { from: b.hip, to: b.shoulder, front: b.front },
        upper: { from: b.shoulder, to: elbow, front: frontOf(b.shoulder, elbow) },
        fore: { from: elbow, to: wrist, front: frontOf(elbow, wrist) },
        hand: { from: wrist, to: add(wrist, [L.hand, 0.6]), front: [0, 1] },
      },
    };
  }

  return { pose, top, bottom };
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
