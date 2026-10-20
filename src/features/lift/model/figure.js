// Turns a pose (where the hips, hands and feet are) into a stick figure. The
// elbows and knees are solved so every bone keeps its length, which lets a
// demo blend smoothly between two poses.

export const BONES = { torso: 44, neck: 14, head: 8, upperArm: 24, forearm: 22, thigh: 36, shin: 34 };
const RAD = Math.PI / 180;

const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// Direction for an angle in degrees: 0 points up, 90 points right.
const dir = deg => [Math.sin(deg * RAD), -Math.cos(deg * RAD)];
const angleOf = (from, to) => Math.atan2(to[0] - from[0], -(to[1] - from[1])) / RAD;

// Two-bone solve: where does the middle joint go? bend picks the side.
export function solveJoint(root, target, l1, l2, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const reach = Math.hypot(dx, dy) || 0.0001;
  const d = Math.min(reach, l1 + l2 - 0.0001);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const side = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / reach;
  const uy = dy / reach;
  const joint = [root[0] + ux * along + -uy * side * bend, root[1] + uy * along + ux * side * bend];
  const end = [root[0] + ux * d, root[1] + uy * d];
  return { joint, end };
}

function torsoAngle(pose) {
  if (Number.isFinite(pose.t)) return pose.t;
  return pose.shoulder ? angleOf(pose.hip, pose.shoulder) : 0;
}

// Blend two poses. Angles and points interpolate; flags come from the first.
export function blendPose(a, b, t) {
  const pick = key => (b[key] ? (a[key] ? lerpPoint(a[key], b[key], t) : b[key]) : a[key]);
  return {
    ...a,
    t: lerp(torsoAngle(a), torsoAngle(b), t),
    shoulder: undefined,
    hip: lerpPoint(a.hip, b.hip, t),
    hand: pick("hand"),
    hand2: b.hand2 || a.hand2 ? lerpPoint(a.hand2 ?? a.hand, b.hand2 ?? b.hand, t) : undefined,
    foot: pick("foot"),
    foot2: b.foot2 || a.foot2 ? lerpPoint(a.foot2 ?? a.foot, b.foot2 ?? b.foot, t) : undefined,
    toe: lerpPoint(a.toe ?? [10, 4], b.toe ?? [10, 4], t),
    shrug: lerp(a.shrug ?? 0, b.shrug ?? 0, t),
  };
}

// The drawable figure: bones as point pairs (far side first) and the head.
export function buildFigure(pose) {
  const t = torsoAngle(pose);
  const up = dir(t);
  const across = [-up[1], up[0]];
  const { torso, neck, head, upperArm, forearm, thigh, shin } = BONES;
  const neckBase = add(pose.hip, [up[0] * torso, up[1] * torso]);
  const headCenter = add(neckBase, [up[0] * neck, up[1] * neck]);
  const shrug = [up[0] * (pose.shrug ?? 0), up[1] * (pose.shrug ?? 0)];

  // Front view spreads shoulders and hips; side view stacks them.
  const spread = pose.front ? 13 : 0;
  const hipSpread = pose.front ? 7 : 0;
  const shoulderNear = add(add(neckBase, shrug), [across[0] * spread, across[1] * spread + (pose.front ? 4 : 0)]);
  const shoulderFar = add(add(neckBase, shrug), [-across[0] * spread, -across[1] * spread + (pose.front ? 4 : 0)]);
  const hipNear = add(pose.hip, [across[0] * hipSpread, across[1] * hipSpread]);
  const hipFar = add(pose.hip, [-across[0] * hipSpread, -across[1] * hipSpread]);

  const elbow = pose.elbowBend ?? 1;
  const knee = pose.kneeBend ?? -1;
  const arm = (shoulder, hand, bend) => {
    const { joint, end } = solveJoint(shoulder, hand, upperArm, forearm, bend);
    return [[shoulder, joint], [joint, end]];
  };
  const leg = (hip, ankle, bend, toe) => {
    const { joint, end } = solveJoint(hip, ankle, thigh, shin, bend);
    return [[hip, joint], [joint, end], [end, add(end, toe)]];
  };

  const toe = pose.toe ?? [10, 4];
  const far = [
    ...leg(hipFar, pose.foot2 ?? pose.foot, pose.front ? -knee : knee, pose.front ? [-toe[0] * 0.4, toe[1]] : toe),
    ...arm(shoulderFar, pose.hand2 ?? pose.hand, pose.front ? -elbow : (pose.elbowBend2 ?? elbow)),
  ];
  const near = [
    [pose.hip, neckBase],
    [neckBase, headCenter],
    ...(pose.front ? [[shoulderNear, shoulderFar], [hipNear, hipFar]] : []),
    ...leg(hipNear, pose.foot, knee, pose.front ? [toe[0] * 0.4, toe[1]] : toe),
    ...arm(shoulderNear, pose.hand, elbow),
  ];
  const hands = [far[far.length - 1][1], near[near.length - 1][1]];
  return { far, near, head: { center: headCenter, r: head }, hands };
}
