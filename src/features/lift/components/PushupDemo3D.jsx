import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import MuscleStage from "../anatomy3d/MuscleStage";

function hasWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function wantsLite() {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return Boolean(coarse || window.innerWidth < 760 || (navigator.deviceMemory ?? 8) <= 4);
}

/**
 * The 3D push-up. The stage keeps its own clock; it reports each frame so the
 * muscle list beside it can follow along.
 */
export default function PushupDemo3D({ movement, playing, speed, onFrame, onFail }) {
  const box = useRef(null);
  const stage = useRef(null);
  const frameRef = useRef(onFrame);
  const [status, setStatus] = useState("loading");
  const [ok] = useState(hasWebGL2);

  useEffect(() => {
    frameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!ok || !box.current) return undefined;
    let last = 0;
    const s = new MuscleStage(box.current, {
      movement,
      lite: wantsLite(),
      onStatus: setStatus,
      // About 20 updates a second is plenty for the list and keeps React calm.
      onFrame: (rep, efforts) => {
        const now = performance.now();
        if (now - last < 50) return;
        last = now;
        frameRef.current?.(rep, efforts);
      },
    });
    stage.current = s;
    return () => {
      s.dispose();
      stage.current = null;
    };
  }, [movement, ok]);

  useEffect(() => stage.current?.setPlaying(playing), [playing]);
  useEffect(() => stage.current?.setSpeed(speed), [speed]);
  useEffect(() => {
    if (!ok || status === "error") onFail?.();
  }, [ok, status, onFail]);

  return (
    <div className="lp-3d" ref={box}>
      {status === "loading" && <p className="lp-3d-status">Loading the 3D body…</p>}
      {status === "ready" && (
        <>
          <p className="lp-3d-hint">Drag to turn any way · pinch or scroll to zoom</p>
          <button type="button" className="lp-3d-reset" onClick={() => stage.current?.resetView()}>
            <RotateCcw size={14} aria-hidden="true" /> Reset view
          </button>
        </>
      )}
    </div>
  );
}
