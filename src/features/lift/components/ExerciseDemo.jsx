import { useEffect, useState } from "react";

import { demoFor } from "../data/demos";
import { blendPose, buildFigure } from "../model/figure";

const CYCLE_MS = 3200;

// Ease down, hold, ease back, hold: like a controlled rep.
function phase(ms) {
  const x = (ms % CYCLE_MS) / CYCLE_MS;
  const ease = v => (1 - Math.cos(Math.PI * v)) / 2;
  if (x < 0.4) return ease(x / 0.4);
  if (x < 0.5) return 1;
  if (x < 0.9) return 1 - ease((x - 0.5) / 0.4);
  return 0;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function holdFor(gear) {
  if (gear.includes("barbell")) return "bar";
  if (gear.includes("kettlebell")) return "kb";
  if (gear.includes("dumbbells")) return "db";
  if (gear.includes("cable")) return "cable";
  if (gear.includes("bands")) return "band";
  return null;
}

const PROPS = {
  bench: <rect x="44" y="110" width="96" height="7" rx="3" />,
  lowbench: <rect x="40" y="104" width="44" height="7" rx="3" />,
  box: <rect x="104" y="112" width="44" height="38" rx="4" />,
  bar: <line x1="70" y1="-12" x2="140" y2="-12" />,
  lowbar: <line x1="116" y1="84" x2="160" y2="84" />,
  dipbars: <line x1="84" y1="80" x2="126" y2="80" />,
  seat: <rect x="70" y="114" width="40" height="7" rx="3" />,
  recline: <path d="M66 92 L106 128 L130 128" fill="none" />,
  wall: <line x1="70" y1="-20" x2="70" y2="150" />,
};

function Hold({ type, at, pulley }) {
  const [x, y] = at;
  if (type === "db") return <rect className="ld-weight" x={x - 7} y={y - 3} width="14" height="6" rx="2" />;
  if (type === "kb") return <circle className="ld-weight" cx={x} cy={y + 6} r="6" />;
  if (type === "bar") return <circle className="ld-weight" cx={x} cy={y} r="9" />;
  if ((type === "cable" || type === "band") && pulley) {
    return <line className="ld-cable" x1={pulley[0]} y1={pulley[1]} x2={x} y2={y} />;
  }
  return null;
}

function Figure({ pose, demo, hold }) {
  const figure = buildFigure(pose);
  const seg = ([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
  const holdBoth = pose.front || hold === "bar";
  return (
    <>
      <g className="ld-props">{(demo.props ?? []).map(p => <g key={p}>{PROPS[p]}</g>)}</g>
      <g className="ld-far">{figure.far.map(seg)}</g>
      {holdBoth && <Hold type={hold} at={figure.hands[0]} pulley={demo.pulley} />}
      <g className="ld-near">
        {figure.near.map(seg)}
        <circle cx={figure.head.center[0]} cy={figure.head.center[1]} r={figure.head.r} />
      </g>
      <Hold type={hold} at={figure.hands[1]} pulley={demo.pulley} />
    </>
  );
}

/** An animated stick figure doing the movement, looping like a slow rep. */
export default function ExerciseDemo({ exercise }) {
  const demo = demoFor(exercise.demo);
  const [t, setT] = useState(0);
  const still = prefersReducedMotion();

  useEffect(() => {
    if (still) return undefined;
    let frame;
    const start = performance.now();
    const tick = now => {
      setT(phase(now - start));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still, exercise.id]);

  const hold = holdFor(exercise.gear);
  const viewBox = "0 -26 200 182";

  if (still) {
    return (
      <div className="ld-demo ld-demo--still" role="img" aria-label={`${exercise.name}: start and finish positions`}>
        {[demo.a, demo.b].map((pose, i) => (
          <svg key={i} viewBox={viewBox} aria-hidden="true">
            <line className="ld-floor" x1="0" y1="150" x2="200" y2="150" />
            <Figure pose={pose} demo={demo} hold={hold} />
          </svg>
        ))}
      </div>
    );
  }

  return (
    <div className="ld-demo" role="img" aria-label={`Animation of ${exercise.name}`}>
      <svg viewBox={viewBox} aria-hidden="true">
        <line className="ld-floor" x1="0" y1="150" x2="200" y2="150" />
        <Figure pose={blendPose(demo.a, demo.b, t)} demo={demo} hold={hold} />
      </svg>
    </div>
  );
}
