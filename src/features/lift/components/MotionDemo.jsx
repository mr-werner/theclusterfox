import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Box, Pause, Play, Square } from "lucide-react";

import PushupDemo2D from "./PushupDemo2D";
import { effortCss, efforts as effortsAt, repFor } from "../data/activation";

// three.js only loads when someone opens the 3D view.
const PushupDemo3D = lazy(() => import("./PushupDemo3D"));

// The 2D drawing for each rig, and which rigs have a 3D pose yet (keep in
// step with anatomy3d/rigs.js, which is left out here so three.js stays lazy).
const VIEWS_2D = { pushup: PushupDemo2D };
const HAS_3D = new Set(["pushup"]);

const VIEW_KEY = "liftfox-demo-view";
const readView = () => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
};
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useRepClock(movement, running, speed) {
  const [ms, setMs] = useState(movement.cycleMs * 0.45);
  useEffect(() => {
    if (!running) return undefined;
    let frame;
    let last = null;
    const tick = now => {
      if (last != null) setMs(m => m + (now - last) * speed);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed]);
  return ms;
}

/**
 * The exercise demo for movements we have muscle data for: a 2D drawing or
 * the 3D body, with every working muscle shading red by how hard it works.
 */
export default function MotionDemo({ movement, exerciseName }) {
  const has3d = HAS_3D.has(movement.rig);
  const Demo2D = VIEWS_2D[movement.rig] ?? PushupDemo2D;
  const [savedView, setView] = useState(readView);
  const view = has3d ? savedView : "2d";
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [speed, setSpeed] = useState(1);
  const [picked, setPicked] = useState(null);
  const ms = useRepClock(movement, view === "2d" && playing, speed);
  const [live3d, setLive3d] = useState(null);

  const chooseView = v => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode */
    }
  };
  const on3dFrame = useCallback((rep, efforts) => setLive3d({ rep, efforts }), []);
  const on3dFail = useCallback(() => setView("2d"), []);

  const rep2d = repFor(movement, ms);
  const { rep, efforts } = view === "3d" && live3d ? live3d : { rep: rep2d, efforts: effortsAt(movement, rep2d) };
  const ranked = [...movement.muscles].sort((a, b) => b.peak - a.peak);

  return (
    <div className="lp-demo">
      <div className="lp-stage">
        <div className="lp-toolbar">
          {has3d && <div className="lp-views" role="radiogroup" aria-label="Demo view">
            <button type="button" role="radio" aria-checked={view === "2d"} onClick={() => chooseView("2d")}>
              <Square size={14} aria-hidden="true" /> 2D
            </button>
            <button type="button" role="radio" aria-checked={view === "3d"} onClick={() => chooseView("3d")}>
              <Box size={14} aria-hidden="true" /> 3D
            </button>
          </div>}
          <span className={`lp-phase ${rep.pressing ? "is-press" : ""}`} aria-live="off">{rep.label}</span>
          {movement.hold == null && <div className="lp-play">
            <button type="button" className="lp-iconbtn" onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button type="button" className="lp-speed" onClick={() => setSpeed(s => (s === 1 ? 0.5 : 1))} aria-label="Change speed">
              {speed === 1 ? "1×" : "½×"}
            </button>
          </div>}
        </div>

        {view === "2d" ? (
          <Demo2D depth={rep.depth} efforts={efforts} onPick={setPicked} options={movement.rigOptions} label={`a ${exerciseName.toLowerCase()}`} />
        ) : (
          <Suspense fallback={<div className="lp-3d"><p className="lp-3d-status">Loading the 3D body…</p></div>}>
            <PushupDemo3D movement={movement} playing={playing} speed={speed} onFrame={on3dFrame} onFail={on3dFail} />
          </Suspense>
        )}
        <p className="lp-caption">
          {exerciseName}: muscles shade from grey to deep red as they work harder. {view === "3d" ? "3D anatomy from BodyParts3D (CC BY 4.0)." : "Tap a muscle to find it in the list."}
        </p>
      </div>

      <ul className="lp-legend" aria-label="Muscles working">
        {ranked.map(m => {
          const level = efforts[m.id] ?? 0;
          return (
            <li key={m.id} className={picked === m.id ? "is-picked" : ""} onClick={() => setPicked(m.id === picked ? null : m.id)}>
              <span className="lp-swatch" style={{ background: effortCss(level) }} aria-hidden="true" />
              <span className="lp-name">
                <strong>{m.name}</strong>
                <small>{m.detail} · {m.role === "mover" ? "moves you" : "holds you steady"}</small>
              </span>
              <span className="lp-bar" aria-label={`${Math.round(level * 100)}% effort`}>
                <span style={{ width: `${Math.round(level * 100)}%`, background: effortCss(Math.max(level, 0.35)) }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
