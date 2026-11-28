import { useMemo } from "react";

import { FLOOR, HEAD_R, SHAPES, gearRadius, makeBody2d } from "../model/body2d";
import { placeLines, placeShape, smoothPath } from "../model/pushup2d";
import { effortCss } from "../data/activation";

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

// A weight, side on: a plate for the barbell, a small disc for a dumbbell,
// a bell for the kettlebell.
function Gear({ kind, at }) {
  const r = gearRadius(kind);
  return (
    <g className={`lp-gear lp-gear-${kind}`}>
      <circle cx={at[0]} cy={at[1]} r={r} />
      <circle className="lp-gear-hub" cx={at[0]} cy={at[1]} r={kind === "barbell" ? 2.2 : 1.4} />
    </g>
  );
}

const rigs = new Map();
function rigFor(options) {
  const key = JSON.stringify(options ?? {});
  if (!rigs.has(key)) rigs.set(key, makeBody2d(options));
  return rigs.get(key);
}

/** A side-on squat, hinge or bridge drawn in muscle shapes; working muscles fill red. */
export default function BodyDemo2D({ depth, rep, efforts, onPick, options, label = "an exercise" }) {
  const rig = rigFor(options);
  const air = rep?.air ?? 0;
  const pose = useMemo(() => rig.pose(depth, { air }), [rig, depth, air]);
  const [vx, vy, vw, vh] = rig.view;
  const { near, far, head, up, gear } = pose;
  const neckEnd = [head[0] - up[0] * HEAD_R * 0.7, head[1] - up[1] * HEAD_R * 0.7];
  const limbs = ["sole", "shin", "thigh"];
  const arm = ["hand", "fore", "upper"];

  return (
    <svg
      className="lp-2d"
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{ aspectRatio: `${vw} / ${vh}`, maxHeight: "min(64vh, 460px)" }}
      role="img"
      aria-label={`Side view of ${label}. Working muscles turn red.`}
    >
      <defs>
        <radialGradient id="lp-floor-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff2a1a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff2a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={vx + vw / 2} cy={FLOOR + 1} rx={vw / 2 - 10} ry="5" fill="url(#lp-floor-glow)" />
      <line className="lp-floor" x1={vx - 2} y1={FLOOR} x2={vx + vw + 2} y2={FLOOR} />
      {rig.props.map((p, i) => (
        <rect key={i} className="lp-prop" x={p.x} y={p.y} width={p.w} height={p.h} rx="1.5" />
      ))}

      <g className="lp-far">
        {limbs.map(n => <Bone key={n} name={n} bone={far[n]} efforts={efforts} far />)}
        {arm.map(n => <Bone key={n} name={n} bone={far[n]} efforts={efforts} far />)}
      </g>
      {gear.filter(g => g.far && g.kind !== "barbell").map((g, i) => <Gear key={`f${i}`} kind={g.kind} at={shift([g.far], FAR)[0]} />)}

      {gear.filter(g => g.kind === "barbell").map((g, i) => <Gear key={`b${i}`} kind={g.kind} at={g.at} />)}
      {limbs.map(n => <Bone key={n} name={n} bone={near[n]} efforts={efforts} onPick={n === "sole" ? undefined : onPick} />)}
      <line className="lp-neck" x1={near.torso.to[0]} y1={near.torso.to[1]} x2={neckEnd[0]} y2={neckEnd[1]} />
      <Bone name="torso" bone={near.torso} efforts={efforts} onPick={onPick} />
      <circle className="lp-base" cx={head[0]} cy={head[1]} r={HEAD_R * 0.82} />
      {arm.map(n => <Bone key={n} name={n} bone={near[n]} efforts={efforts} onPick={n === "hand" ? undefined : onPick} />)}
      {gear.filter(g => g.kind !== "barbell").map((g, i) => <Gear key={`n${i}`} kind={g.kind} at={g.at} />)}
    </svg>
  );
}
