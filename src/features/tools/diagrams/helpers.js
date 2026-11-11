import { useRef } from "react";
import { fromSI, fmt, unitLabel } from "../model/units";

/**
 * Pointer dragging in drawing coordinates. Returns props for the handle element.
 *
 * `opts.field` names the on-drawing value box(es) (a <Num field="…">) this handle
 * changes: they light up while you drag, so you can see the number moving, and a
 * tap on the handle without dragging jumps into that box to type a value.
 * `opts.onStart(point)` runs when a drag begins; whatever it returns is passed to
 * `onMove(point, start)`, for drags that work relative to where they started.
 */
export function useDrag(svgRef, onMove, opts = {}) {
  const active = useRef(null);
  const toLocal = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return { x: ((e.clientX - r.left) / r.width) * vb.width, y: ((e.clientY - r.top) / r.height) * vb.height };
  };
  const keys = [].concat(opts.field || []);
  const boxes = () => linkedBoxes(svgRef.current, keys);
  const light = (on) => boxes().forEach((el) => (on ? el.setAttribute("data-live", "") : el.removeAttribute("data-live")));
  const end = (e) => {
    const a = active.current;
    active.current = null;
    if (!a) return;
    light(false);
    // A tap: go type the value instead.
    if (!a.moved && e?.type === "pointerup") boxes()[0]?.querySelector("input")?.focus();
  };
  return {
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      active.current = { x: e.clientX, y: e.clientY, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    onPointerMove: (e) => {
      const a = active.current;
      if (!a) return;
      if (!a.moved) {
        if (Math.hypot(e.clientX - a.x, e.clientY - a.y) < 4) return;
        a.moved = true;
        light(true);
        const p0 = toLocal({ clientX: a.x, clientY: a.y });
        a.start = p0 && opts.onStart ? opts.onStart(p0) : undefined;
      }
      const p = toLocal(e);
      if (p) onMove(p, a.start);
    },
    onPointerUp: end,
    onPointerCancel: end,
    "data-links": keys.length ? keys.join(" ") : undefined,
    style: { touchAction: "none", cursor: "grab" },
  };
}

/** The on-drawing value boxes named by `keys`, in the drawing that holds `el`. */
function linkedBoxes(el, keys) {
  const root = el?.closest?.(".dg");
  if (!root || !keys.length) return [];
  return keys.flatMap((k) => [...root.querySelectorAll(`[data-field="${k}"]`)]);
}

/** Keyboard support for a drag handle: arrows move it by a step, Enter jumps to its value box. */
export const keyNudge = (onStep) => ({
  tabIndex: 0,
  role: "slider",
  onKeyDown: (e) => {
    if (e.key === "Enter") {
      const keys = (e.currentTarget.getAttribute("data-links") || "").split(" ").filter(Boolean);
      const input = linkedBoxes(e.currentTarget, keys)[0]?.querySelector("input");
      if (input) {
        e.preventDefault();
        input.focus();
      }
      return;
    }
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
