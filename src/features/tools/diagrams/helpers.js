import { useRef } from "react";
import { fromSI, fmt, unitLabel } from "../model/units";

/** Pointer dragging in drawing coordinates. Returns props for the handle element. */
export function useDrag(svgRef, onMove) {
  const active = useRef(false);
  const toLocal = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return { x: ((e.clientX - r.left) / r.width) * vb.width, y: ((e.clientY - r.top) / r.height) * vb.height };
  };
  return {
    onPointerDown: (e) => {
      active.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    onPointerMove: (e) => {
      if (!active.current) return;
      const p = toLocal(e);
      if (p) onMove(p);
    },
    onPointerUp: () => {
      active.current = false;
    },
    onPointerCancel: () => {
      active.current = false;
    },
    style: { touchAction: "none", cursor: "grab" },
  };
}

/** Keyboard support for a drag handle: arrows move it by a step. */
export const keyNudge = (onStep) => ({
  tabIndex: 0,
  role: "slider",
  onKeyDown: (e) => {
    const map = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
    if (map[e.key] === undefined) return;
    e.preventDefault();
    onStep(map[e.key] * (e.shiftKey ? 10 : 1));
  },
});

/** "12.3 kN" in the person's unit for that dimension. */
export const show = (value, dim, unit) => `${fmt(fromSI(value, dim, unit))} ${unitLabel(dim, unit)}`.trim();

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Round a dragged value to 3 significant figures so the box stays readable. */
export const tidy = (v) => (v === 0 ? 0 : Number(v.toPrecision(3)));
