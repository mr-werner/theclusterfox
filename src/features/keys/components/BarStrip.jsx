import { memo, useRef } from "react";
import { barCount } from "../model/song";
import { barNumber, loopFromBars } from "../model/loop";

// The whole song as a row of bars. Drag across it to loop those bars; tap
// a bar to jump there. Works the same with a mouse or a finger.
const TAP_PX = 6; // a press that moves less than this is a tap

function BarStrip({ song, loop, preview, onPreview, onSelect, onSeek, headRef }) {
  const n = barCount(song);
  const ref = useRef(null);
  const drag = useRef(null);

  const indexAt = clientX => {
    const r = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
  };

  const onPointerDown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, from: indexAt(e.clientX), moved: false };
  };
  const onPointerMove = e => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < TAP_PX) return;
    d.moved = true;
    onPreview(loopFromBars(song, d.from, indexAt(e.clientX)));
  };
  const onPointerUp = e => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    onPreview(null);
    if (d.moved) onSelect(loopFromBars(song, d.from, indexAt(e.clientX)));
    else onSeek(d.from);
  };
  const onPointerCancel = () => {
    drag.current = null;
    onPreview(null);
  };

  const shown = preview || (loop.on ? loop : null);
  const inLoop = i => shown && barNumber(song, i) >= shown.a && barNumber(song, i) <= shown.b;
  // Label every bar when there's room, else every 2nd, 4th or 8th.
  const every = n <= 16 ? 1 : n <= 32 ? 2 : n <= 64 ? 4 : 8;

  return (
    <div className="ks-bars-row">
      <span className="ks-bars-label">{shown ? `Loop ${shown.a}–${shown.b}` : "Bars"}</span>
      <div
        ref={ref}
        className={`ks-bars${preview ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="slider"
        aria-label="Bars. Drag across bars to loop them, or tap one to jump there."
        aria-valuemin={1}
        aria-valuemax={barNumber(song, n - 1)}
        aria-valuenow={shown ? shown.a : 1}
        aria-valuetext={shown ? `Looping bars ${shown.a} to ${shown.b}` : "No loop"}
        title="Drag across bars to loop them. Tap a bar to jump there."
      >
        {Array.from({ length: n }, (_, i) => {
          const num = barNumber(song, i);
          return (
            <span key={i} className={`ks-bar-cell${inLoop(i) ? " is-loop" : ""}${num === 0 ? " is-pickup" : ""}`}>
              {num > 0 && (num === 1 || num % every === 0) && <em>{num}</em>}
            </span>
          );
        })}
        <span ref={headRef} className="ks-bars-head" />
      </div>
      {!shown && <span className="ks-bars-hint">Drag to loop</span>}
    </div>
  );
}

export default memo(BarStrip);
