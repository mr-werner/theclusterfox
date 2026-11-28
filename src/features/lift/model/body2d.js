// The 2D view for standing and lying exercises: the same muscle shapes as
// the push-up drawing, with the leg split at the knee, riding on the
// side-on pose from bodyPoses.js. Centimetres; svg y points down.

import { SHAPES as PUSHUP_SHAPES, FLOOR, HEAD_R, placeShape } from "./pushup2d.js";
import { solveBody } from "./bodyPoses.js";

export { FLOOR, HEAD_R };

const NECK = 11;

// The push-up's leg runs ankle to hip as one bone with the knee at 0.49.
// Here the shin (ankle → knee) and thigh (knee → hip) are their own bones,
// so the same outlines are cut at the knee and stretched to each.
export const SHAPES = {
  ...PUSHUP_SHAPES,
  shin: [
    { muscle: null, base: true, pts: [[-0.02, -3.5], [0.4, -6.5], [0.86, -6.2], [1.05, -4.5], [1.1, 0], [1.05, 4.2], [0.86, 3.4], [0.3, 3.5], [-0.02, 3]] },
    { muscle: null, pts: [[0.1, 0.2], [0.61, 3.8], [0.96, 3.4], [0.92, 0], [0.2, -0.6]] },
    { muscle: "calves", pts: [[0.2, -2.6], [0.49, -6.8], [0.86, -6.6], [1.02, -2.8], [0.61, -0.2]] },
  ],
  thigh: [
    { muscle: null, base: true, pts: [[-0.08, -4.5], [0.41, -7.5], [0.9, -9], [1.04, -4], [1.0, 8.5], [0.57, 8.2], [0.06, 4.8], [-0.1, 0]] },
    { muscle: "hamstrings", pts: [[0.06, -3.4], [0.41, -7.4], [0.88, -8.6], [0.98, -1.4], [0.25, -0.4]] },
    { muscle: "quads", pts: [[0.04, 3.8], [0.53, 8.6], [0.94, 8.4], [0.98, 0.6], [0.53, -0.2], [0.12, -0.6]], lines: [[0.25, 2.4, 0.92, 4.8]] },
  ],
  // A foot standing on the floor: heel (0) to toes (1), +v up from the sole.
  sole: [
    { muscle: null, base: true, pts: [[0, 0.4], [-0.03, 4], [0.12, 8.5], [0.32, 8], [0.62, 4.4], [0.95, 2.4], [1.02, 0.6], [0.5, -0.1]] },
  ],
};

const m2cm = ([f, u]) => [f * 100, FLOOR - u * 100];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const norm = a => mul(a, 1 / (Math.hypot(a[0], a[1]) || 1));
// (f, u) direction to svg (y down).
const svgDir = ([f, u]) => [f, -u];
// The side of a bone its front faces: for leg and trunk bones, turned from
// the bone's direction toward where the person faces.
const frontOf = (from, to) => {
  const d = norm(sub(to, from));
  return [-d[1], d[0]];
};

function legBones(leg) {
  const [ankle, knee, hip, heel, toe] = [leg.ankle, leg.knee, leg.hip, leg.heel, leg.toe].map(m2cm);
  const along = norm(sub(toe, heel));
  return {
    sole: { from: heel, to: toe, front: [along[1], -along[0]] },
    shin: { from: ankle, to: knee, front: frontOf(ankle, knee) },
    thigh: { from: knee, to: hip, front: frontOf(knee, hip) },
  };
}

function armBones(arm, gripLen = 17) {
  const [shoulder, elbow, wrist] = [arm.shoulder, arm.elbow, arm.wrist].map(m2cm);
  // The biceps side faces away from where the elbow points.
  const pole = norm(svgDir(arm.pole));
  const front = (from, to) => {
    const d = norm(sub(to, from));
    const p = sub(mul(pole, -1), mul(d, -pole[0] * d[0] - pole[1] * d[1]));
    const n = Math.hypot(p[0], p[1]);
    return n > 1e-6 ? mul(p, 1 / n) : [d[1], -d[0]];
  };
  const foreDir = norm(sub(wrist, elbow));
  const hand = add(wrist, mul(foreDir, gripLen));
  return {
    upper: { from: shoulder, to: elbow, front: front(shoulder, elbow) },
    fore: { from: elbow, to: wrist, front: front(elbow, wrist) },
    hand: { from: wrist, to: hand, front: front(elbow, wrist) },
    grip: add(wrist, mul(foreDir, gripLen * 0.5)),
    dir: foreDir,
  };
}

/**
 * The 2D body for a pose from bodyPoses.js. pose(depth, rep) gives the near
 * and far bones, the head, weights and the neck; view is the drawing's frame.
 */
export function makeBody2d({ pose: poseName } = {}) {
  function pose(depth, rep) {
    const b = solveBody(poseName, depth, rep);
    const hip = m2cm(b.hip);
    const shoulder = m2cm(b.shoulder);
    const up = norm(svgDir(b.up));
    const front = norm(svgDir(b.front));
    const head = add(add(shoulder, mul(up, NECK + HEAD_R * 0.6)), mul(front, 1.5));
    const near = { ...legBones(b.legs[0]), ...armBones(b.arms[0]), torso: { from: hip, to: shoulder, front } };
    const far = { ...legBones(b.legs[1]), ...armBones(b.arms[1]) };
    const gear = b.gear.map(g => {
      if (g.kind === "kettlebell") return { kind: g.kind, at: add(near.grip, mul(near.dir, 11)) };
      if (g.at === "hands") return { kind: g.kind, at: near.grip, far: far.grip };
      return { kind: g.kind, at: m2cm(g.at) };
    });
    return { near, far, head, up, gear };
  }

  // Benches and walls, as svg rectangles.
  const props = solveBody(poseName, 0, {}).props.map(p => ({
    x: (p.center[0] - p.size[0] / 2) * 100,
    y: FLOOR - (p.center[1] + p.size[1] / 2) * 100,
    w: p.size[0] * 100,
    h: p.size[1] * 100,
  }));

  // The frame: every outline over the rep (and in the air, for a jump).
  const xs = [];
  const ys = [FLOOR];
  for (const [depth, air] of [[0, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0], [0, 1]]) {
    const { near, far, head, gear } = pose(depth, { air });
    for (const bones of [near, far]) {
      for (const [name, bone] of Object.entries(bones)) {
        if (!SHAPES[name]) continue;
        for (const shape of SHAPES[name]) {
          for (const p of placeShape(shape, bone)) {
            xs.push(p[0]);
            ys.push(p[1]);
          }
        }
      }
    }
    xs.push(head[0] + HEAD_R, head[0] - HEAD_R);
    ys.push(head[1] - HEAD_R);
    for (const g of gear) {
      const r = gearRadius(g.kind);
      xs.push(g.at[0] - r, g.at[0] + r);
      ys.push(g.at[1] - r);
    }
  }
  for (const p of props) {
    xs.push(p.x, p.x + p.w);
    ys.push(p.y);
  }
  const minX = Math.min(...xs) - 4;
  const maxX = Math.max(...xs) + 4;
  const minY = Math.min(...ys) - 3;
  const width = Math.max(210, maxX - minX);
  const view = [(minX + maxX - width) / 2, minY, width, FLOOR + 6 - minY];
  return { pose, props, view };
}

/** How big each weight is drawn, side on (cm). */
export function gearRadius(kind) {
  return kind === "barbell" ? 22.5 : kind === "kettlebell" ? 9 : 5.5;
}
