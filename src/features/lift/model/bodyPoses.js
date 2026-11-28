// Side-on poses for the standing and lying exercises (squats, hinges,
// bridges), shared by the 2D drawing and the 3D rig so both move the same way.
//
// Units are metres. f is forward (the way the person faces), u is up from the
// floor. Angles are radians in the side-on plane:
//   trunk  lean of hip→shoulder from straight up (+ is forward, −90° lying on the back)
//   thigh  hip→knee from straight down (+ is the knee forward)
//   shin   knee→ankle from straight down (+ is the knee ahead of the ankle)
//   foot   tilt of the foot (+ is the toes down)
// Each leg also says, for 3D only: width (ankle out from under the hip, m),
// kneeOut (how far the knee points out, 0–1) and toes (turned out, rad).
// Leg 0 and arm 0 are the near (left) side, 1 the far (right) side.

export const LEN = {
  shin: 0.395,
  thigh: 0.425,
  trunk: 0.5,
  upper: 0.2675,
  fore: 0.249,
  ankle: 0.06, // ankle joint above the floor, foot flat
  heel: [-0.05, -0.06], // heel and toe tips from the ankle, foot flat
  toe: [0.157, -0.06],
  backThick: 0.124, // shoulder joint to the skin of the upper back
};
const REACH = LEN.upper + LEN.fore;

const deg = d => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => (1 - Math.cos(Math.PI * clamp01(x))) / 2;

/** Turn an (f, u) vector by angle a, the same way the 3D rig turns around x. */
export const turn = ([f, u], a) => [u * Math.sin(a) + f * Math.cos(a), u * Math.cos(a) - f * Math.sin(a)];

const trunkUp = lean => [Math.sin(lean), Math.cos(lean)];
const trunkFront = lean => [Math.cos(lean), -Math.sin(lean)];
const thighDir = a => [Math.sin(a), -Math.cos(a)];
const shinDir = a => [-Math.sin(a), -Math.cos(a)];

// Ankle height for a foot tilted by `foot`, resting on its heel or its toes,
// whichever is lower.
const ankleUp = foot => -Math.min(turn(LEN.heel, foot)[1], turn(LEN.toe, foot)[1]);

// The leg from the hip down.
function legFrom(hip, leg) {
  const knee = add(hip, mul(thighDir(leg.thigh), LEN.thigh));
  const ankle = add(knee, mul(shinDir(leg.shin), LEN.shin));
  return { ...leg, hip, knee, ankle, heel: add(ankle, turn(LEN.heel, leg.foot)), toe: add(ankle, turn(LEN.toe, leg.foot)) };
}

// The hip, from a planted ankle up.
const hipFromAnkle = (ankle, leg) => sub(sub(ankle, mul(shinDir(leg.shin), LEN.shin)), mul(thighDir(leg.thigh), LEN.thigh));

// Two-bone reach for a leg from hip to ankle, the knee bending toward the
// front of the hip→ankle line (forward when standing, up when lying).
function legTo(hip, ankle, foot = 0, stance = {}) {
  const to = sub(ankle, hip);
  const d = Math.min(len(to), LEN.thigh + LEN.shin - 1e-4);
  const dir = norm(to);
  const a = (LEN.thigh ** 2 - LEN.shin ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, LEN.thigh ** 2 - a * a));
  const knee = add(add(hip, mul(dir, a)), mul([-dir[1], dir[0]], h));
  const t = sub(knee, hip);
  const s = sub(ankle, knee);
  return { thigh: Math.atan2(t[0], -t[1]), shin: Math.atan2(-s[0], -s[1]), foot, ...stance };
}

// Arms. Each gives the wrist (world f, u), how far out to the side of the
// shoulder it sits in 3D (side, metres), and which way the elbow points.
const straightArm = (shoulder, angle, side = 0) => ({ wrist: add(shoulder, mul([Math.sin(angle), -Math.cos(angle)], REACH * 0.985)), side });
// In the trunk's own frame: fwd along the chest's facing, up along the spine.
const trunkPoint = (base, lean, fwd, up) => add(add(base, mul(trunkFront(lean), fwd)), mul(trunkUp(lean), up));

// Straight arms whose hands slide down the front of the legs (a bar or
// dumbbells held against the thighs and shins).
function armsDownLegs(shoulder, leg, side) {
  const frontAt = u => {
    // The front of the leg at height u: along the shin, then the thigh.
    const pts = [leg.ankle, leg.knee, leg.hip];
    const thick = [0.055, 0.075, 0.095];
    for (let i = 0; i < 2; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if ((u >= a[1] && u <= b[1]) || (u <= a[1] && u >= b[1])) {
        const t = (u - a[1]) / (b[1] - a[1] || 1);
        return lerp(a[0], b[0], t) + lerp(thick[i], thick[i + 1], t);
      }
    }
    return u > leg.hip[1] ? leg.hip[0] + thick[2] : leg.ankle[0] + thick[0];
  };
  const r = REACH * 0.985;
  let wrist = [shoulder[0], shoulder[1] - r];
  for (let i = 0; i < 4; i++) {
    const f = Math.max(shoulder[0] - r * 0.6, Math.min(shoulder[0] + r * 0.6, frontAt(wrist[1] - 0.03)));
    wrist = [f, shoulder[1] - Math.sqrt(Math.max(0, r * r - (f - shoulder[0]) ** 2))];
  }
  return { wrist, side };
}

// ---- The poses ----------------------------------------------------------

// Feet a bit wider than the hips, toes and knees turned out, for squats.
const SQUAT_STANCE = { width: 0.075, kneeOut: 0.35, toes: deg(14) };
const HIP_STANCE = { width: 0.01, kneeOut: 0.05, toes: deg(4) };
const FREE_LEG = { width: 0.0, kneeOut: 0, toes: 0 };

function squat(o) {
  return (d, rep) => {
    const air = rep?.air ?? 0;
    const leg = { thigh: lerp(0, o.thigh, d), shin: lerp(0, o.shin, d), foot: deg(28) * air, ...(o.stance ?? SQUAT_STANCE) };
    const ankle = [0, ankleUp(leg.foot) + 0.22 * air];
    const hip = hipFromAnkle(ankle, leg);
    const lean = lerp(0, o.trunk, d);
    const shoulder = add(hip, mul(trunkUp(lean), LEN.trunk));
    const spec = { lean, hip, legs: [leg, leg], gear: [], props: [] };
    if (o.arms === "forward") {
      const a = straightArm(shoulder, lerp(deg(8), deg(88), Math.min(1, d * 1.4)), -0.02);
      spec.arms = [a, a];
    } else if (o.arms === "swing") {
      const swing = lerp(lerp(deg(6), deg(-38), d), deg(165), ease(air * 1.3));
      const a = straightArm(shoulder, swing, 0);
      spec.arms = [a, a];
    } else if (o.arms === "goblet") {
      const a = { wrist: trunkPoint(shoulder, lean, 0.19, -0.17), side: -0.135, pole: [0.25, -1, 0.35], poleIn: "trunk" };
      spec.arms = [a, a];
      spec.gear.push({ kind: "dumbbell", at: "hands", along: "trunk" });
    } else if (o.arms === "bar") {
      const bar = trunkPoint(hip, lean, -0.075, 0.455);
      const a = { wrist: bar, side: 0.2, pole: [-0.35, -1, 0.5], poleIn: "trunk" };
      spec.arms = [a, a];
      spec.gear.push({ kind: "barbell", at: bar });
    } else {
      // Arms hang by the sides (the wall sit).
      const a = straightArm(shoulder, deg(4), 0.04);
      spec.arms = [a, a];
    }
    if (o.wall) {
      // A wall right behind the back, where it sits at the bottom.
      const backF = hipFromAnkle([0, LEN.ankle], { thigh: o.thigh, shin: o.shin })[0] - 0.12;
      spec.props.push({ center: [backF - 0.05, 0.95], size: [0.1, 1.9], width: 1.3 });
    }
    return spec;
  };
}

function hinge(o) {
  return d => {
    const stance = { thigh: lerp(0, o.thigh, d), shin: lerp(0, o.shin, d), foot: 0, ...(o.stance ?? HIP_STANCE) };
    const ankle = [0, LEN.ankle];
    const hip = hipFromAnkle(ankle, stance);
    const lean = lerp(0, o.trunk, d);
    const shoulder = add(hip, mul(trunkUp(lean), LEN.trunk));
    const legs = [stance, stance];
    if (o.singleLeg) {
      // The free leg stays in line with the trunk, lifting behind.
      const thigh = -lean * 0.95;
      legs[1] = { thigh, shin: -thigh, foot: -thigh + deg(8) * d, ...FREE_LEG };
    }
    const spec = { lean, hip, legs, gear: [], props: [] };
    const near = legFrom(hip, stance);
    if (o.arms === "swing") {
      // Hands together: between the legs at the bottom, out to chest height at the top.
      const a = straightArm(shoulder, lerp(deg(88), deg(-30), d), -0.135);
      spec.arms = [a, a];
      spec.gear.push({ kind: "kettlebell", at: "hands" });
    } else if (o.arms === "hang") {
      const a = straightArm(shoulder, deg(2), 0.02);
      spec.arms = [a, a];
    } else {
      const a = armsDownLegs(shoulder, near, o.gear === "dumbbells" ? 0.0 : 0.05);
      spec.arms = [a, a];
      spec.gear.push(o.gear === "dumbbells" ? { kind: "dumbbells", at: "hands" } : { kind: "barbell", at: "hands" });
    }
    return spec;
  };
}

function bridge(o) {
  return d => {
    const shoulder = o.shoulder;
    const t = o.walk ? 1 : d;
    const lift = lerp(o.lift[0], o.lift[1], o.walk ? lerp(1, 0.55, d) : t);
    const hip = add(shoulder, mul([Math.cos(lift), Math.sin(lift)], LEN.trunk));
    const lean = Math.atan2(-Math.cos(lift), -Math.sin(lift));
    let legs;
    if (o.walk) {
      // Heels walk away from the hips in small steps, one foot then the other.
      const steps = 3;
      legs = [0, 0.5].map(phase => {
        const x = Math.min(steps, Math.max(0, d * (steps + 0.5) - phase));
        const k = Math.min(steps - 1, Math.floor(x));
        const frac = x - k;
        const moved = (k + ease(Math.min(1, frac * 1.6))) / steps;
        const lifting = frac < 0.62 && x < steps ? Math.sin(Math.PI * Math.min(1, frac * 1.6)) : 0;
        const f = o.walk * moved;
        // Toes come up as the legs straighten; the heel stays on the floor.
        const foot = lerp(0, deg(-55), moved);
        const ankle = [f, ankleUp(foot) + 0.035 * lifting];
        return legTo(hip, ankle, foot, { width: 0.02, kneeOut: 0.05, toes: 0 });
      });
    } else {
      const ankle = [0, LEN.ankle];
      const leg = legTo(hip, ankle, 0, { width: 0.04, kneeOut: 0.12, toes: deg(6) });
      legs = [leg, leg];
      if (o.singleLeg) {
        // The free leg straight, its thigh beside the working one.
        legs[1] = { thigh: leg.thigh, shin: -leg.thigh, foot: -leg.thigh + deg(80), ...FREE_LEG };
      }
    }
    const spec = { lean, hip, legs, gear: [], props: [] };
    if (o.gear) {
      // Weight across the hips, the hands holding it there.
      const at = trunkPoint(hip, lean, o.gear === "barbell" ? 0.13 : 0.11, 0.03);
      const a = { wrist: at, side: o.gear === "barbell" ? 0.06 : -0.075, pole: [0, -1, 0.6], poleIn: "trunk" };
      spec.arms = [a, a];
      spec.gear.push({ kind: o.gear === "barbell" ? "barbell" : "dumbbell", at });
    } else {
      // Arms flat on the floor beside the body.
      const a = { wrist: [shoulder[0] + REACH * 0.94, 0.04], side: 0.03 };
      spec.arms = [a, a];
    }
    if (o.bench) {
      const top = shoulder[1] - LEN.backThick;
      spec.props.push({ center: [shoulder[0] - 0.1, top / 2], size: [0.36, top], width: 1.1 });
    }
    return spec;
  };
}

// Heights for the lying poses: the shoulder joint sits about a back's
// thickness above whatever the upper back rests on.
const FLOOR_SHOULDER = [-0.98, LEN.backThick];
const BENCH_SHOULDER = [-0.93, 0.42 + LEN.backThick];

export const POSES = {
  bodyweightSquat: squat({ thigh: deg(98), shin: deg(34), trunk: deg(42), arms: "forward" }),
  gobletSquat: squat({ thigh: deg(100), shin: deg(36), trunk: deg(26), arms: "goblet", stance: { width: 0.09, kneeOut: 0.45, toes: deg(16) } }),
  backSquat: squat({ thigh: deg(100), shin: deg(34), trunk: deg(46), arms: "bar" }),
  jumpSquat: squat({ thigh: deg(78), shin: deg(30), trunk: deg(38), arms: "swing" }),
  wallSit: squat({ thigh: deg(90), shin: deg(2), trunk: 0, arms: "sides", wall: true }),

  romanianDeadlift: hinge({ thigh: deg(38), shin: deg(6), trunk: deg(66) }),
  deadlift: hinge({ thigh: deg(76), shin: deg(21), trunk: deg(56), stance: { width: 0.02, kneeOut: 0.12, toes: deg(6) } }),
  dbRdl: hinge({ thigh: deg(36), shin: deg(6), trunk: deg(70), gear: "dumbbells" }),
  kbSwing: hinge({ thigh: deg(44), shin: deg(10), trunk: deg(60), arms: "swing", stance: { width: 0.08, kneeOut: 0.2, toes: deg(10) } }),
  singleLegRdl: hinge({ thigh: deg(22), shin: deg(7), trunk: deg(80), arms: "hang", singleLeg: true }),

  gluteBridge: bridge({ shoulder: FLOOR_SHOULDER, lift: [deg(6), deg(30)] }),
  singleLegBridge: bridge({ shoulder: FLOOR_SHOULDER, lift: [deg(6), deg(29)], singleLeg: true }),
  hipThrust: bridge({ shoulder: BENCH_SHOULDER, lift: [deg(-38), deg(2)], bench: true, gear: "barbell" }),
  dbHipThrust: bridge({ shoulder: BENCH_SHOULDER, lift: [deg(-38), deg(2)], bench: true, gear: "dumbbell" }),
  hamstringWalkout: bridge({ shoulder: FLOOR_SHOULDER, lift: [deg(12), deg(28)], walk: 0.3 }),
};

/**
 * The whole pose for one moment: joint positions in (f, u) and the angles the
 * 3D rig needs. rep is the rep state (for the jump's air time).
 */
export function solveBody(name, depth, rep) {
  const spec = POSES[name](depth, rep);
  const shoulder = add(spec.hip, mul(trunkUp(spec.lean), LEN.trunk));
  const legs = spec.legs.map(l => legFrom(spec.hip, l));
  const back = mul(trunkFront(spec.lean), -1);
  const arms = spec.arms.map(a => {
    // Keep the wrist within reach, and say which way the elbow points.
    let wrist = a.wrist;
    const to = sub(wrist, shoulder);
    if (len(to) > REACH * 0.99) wrist = add(shoulder, mul(norm(to), REACH * 0.99));
    const dir = norm(sub(wrist, shoulder));
    let pole;
    if (a.pole && a.poleIn === "trunk") {
      const p = add(mul(trunkFront(spec.lean), a.pole[0]), mul(trunkUp(spec.lean), a.pole[1]));
      pole = [p[0], p[1], a.pole[2]];
    } else if (a.pole) {
      pole = a.pole;
    } else {
      // A straight arm turned only forward or back: the elbow keeps facing
      // the way it does with the arm by the side, so the arm doesn't twist.
      pole = [dir[1], -dir[0], 0.15];
      if (Math.abs(dot(dir, back)) > 0.98) pole = [0, -1, 0.15];
    }
    return { shoulder, wrist, side: a.side, pole, elbow: elbow2d(shoulder, wrist, pole) };
  });
  return { lean: spec.lean, hip: spec.hip, shoulder, legs, arms, gear: spec.gear, props: spec.props, front: trunkFront(spec.lean), up: trunkUp(spec.lean) };
}

function elbow2d(shoulder, wrist, pole) {
  const to = sub(wrist, shoulder);
  const d = Math.min(len(to), REACH - 1e-4);
  const dir = norm(to);
  let p = [pole[0], pole[1]];
  p = sub(p, mul(dir, dot(p, dir)));
  if (len(p) < 1e-6) p = [dir[1], -dir[0]];
  p = norm(p);
  const a = (LEN.upper ** 2 - LEN.fore ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, LEN.upper ** 2 - a * a));
  return add(add(shoulder, mul(dir, a)), mul(p, h));
}
