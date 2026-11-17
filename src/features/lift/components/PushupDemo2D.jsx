import { useMemo } from "react";

import { FLOOR, HEAD_R, SHAPES, makePushup2d, placeLines, placeShape, smoothPath } from "../model/pushup2d";
import { effortCss } from "../data/activation";

const rig = makePushup2d();

// Far limbs sit a little up and back, drawn darker, so the near side reads first.
const FAR = [1.6, -2.2];
const shift = (pts, [dx, dy]) => pts.map(([x, y]) => [x + dx, y + dy]);

function Bone({ name, bone, efforts, far, onPick }) {
  return SHAPES[name].map((shape, i) => {
    let pts = placeShape(shape, bone);
    if (far) pts = shift(pts, FAR);
    const level = shape.muscle ? efforts[shape.muscle] ?? 0 : 0;
    const cls = shape.base ? "lp-base" : shape.muscle ? "lp-muscle" : "lp-plain";
    const lines = shape.lines ? placeLines(shape, bone).map(l => (far ? shift(l, FAR) : l)) : [];
    return (
      <g key={i} onClick={shape.muscle && onPick ? () => onPick(shape.muscle) : undefined}>
        <path className={cls} d={smoothPath(pts)} style={shape.muscle ? { fill: effortCss(level) } : undefined} />
        {lines.map(([a, b], k) => (
          <line key={k} className="lp-fibre" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
      </g>
    );
  });
}

/** A side-on push-up drawn in muscle shapes; working muscles fill red. */
export default function PushupDemo2D({ depth, efforts, onPick }) {
  const pose = useMemo(() => rig.pose(depth), [depth]);
  const { bones, head, body } = pose;
  const neckEnd = [head[0] - body.dir[0] * HEAD_R * 0.7, head[1] - body.dir[1] * HEAD_R * 0.7];

  return (
    <svg className="lp-2d" viewBox="8 18 214 82" role="img" aria-label="Side view of a push-up. Working muscles turn red.">
      <defs>
        <radialGradient id="lp-floor-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff2a1a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff2a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy={FLOOR + 1} rx="100" ry="5" fill="url(#lp-floor-glow)" />
      <line className="lp-floor" x1="8" y1={FLOOR} x2="222" y2={FLOOR} />

      <g className="lp-far">
        <Bone name="foot" bone={bones.foot} efforts={efforts} far />
        <Bone name="leg" bone={bones.leg} efforts={efforts} far />
        <Bone name="hand" bone={bones.hand} efforts={efforts} far />
        <Bone name="fore" bone={bones.fore} efforts={efforts} far />
        <Bone name="upper" bone={bones.upper} efforts={efforts} far />
      </g>

      <Bone name="foot" bone={bones.foot} efforts={efforts} />
      <Bone name="leg" bone={bones.leg} efforts={efforts} onPick={onPick} />
      <line className="lp-neck" x1={bones.torso.to[0]} y1={bones.torso.to[1]} x2={neckEnd[0]} y2={neckEnd[1]} />
      <Bone name="torso" bone={bones.torso} efforts={efforts} onPick={onPick} />
      <circle className="lp-base" cx={head[0]} cy={head[1]} r={HEAD_R * 0.82} />
      <Bone name="hand" bone={bones.hand} efforts={efforts} />
      <Bone name="fore" bone={bones.fore} efforts={efforts} onPick={onPick} />
      <Bone name="upper" bone={bones.upper} efforts={efforts} onPick={onPick} />
    </svg>
  );
}
