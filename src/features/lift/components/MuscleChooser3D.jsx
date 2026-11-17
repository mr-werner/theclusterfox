import { useEffect, useRef, useState } from "react";

import ChooserStage from "../anatomy3d/ChooserStage";
import { muscles } from "../data/muscles";

const GROUPS = muscles.map(m => m.id);

/** Front and back 3D bodies; tap a muscle to pick it. */
export default function MuscleChooser3D({ selected, onToggle, hovered, onHover, onFail }) {
  const box = useRef(null);
  const stage = useRef(null);
  const handlers = useRef({ onToggle, onHover });
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    handlers.current = { onToggle, onHover };
  }, [onToggle, onHover]);

  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const s = new ChooserStage(box.current, {
      groups: GROUPS,
      lite: coarse || window.innerWidth < 760,
      onStatus: setStatus,
      onPick: g => handlers.current.onToggle(g),
      onHover: g => handlers.current.onHover(g),
    });
    stage.current = s;
    return () => s.dispose();
  }, []);

  useEffect(() => stage.current?.setSelected(selected), [selected, status]);
  useEffect(() => stage.current?.setHovered(hovered ?? null), [hovered, status]);
  useEffect(() => {
    if (status === "error") onFail?.();
  }, [status, onFail]);

  return (
    <div className="lm-3d" ref={box}>
      {status === "loading" && <p className="lm-3d-status">Loading muscles…</p>}
      <span className="lm-3d-label lm-3d-label--front">Front</span>
      <span className="lm-3d-label lm-3d-label--back">Back</span>
    </div>
  );
}
