import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

// A zoomable, pannable frame for a drawing. The drawing is laid out at its own
// width (`width`, or the space available if that's wider) and scaled down to fit,
// so the whole thing is always visible first. Pinch, ctrl/⌘ + scroll, or the
// + and − buttons zoom in; one finger or the scrollbars pan; "Fit" goes back to
// the whole drawing.

const MAX_ZOOM = 6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function ZoomPan({ width = 0, children, label = "diagram", className = "" }) {
  const wrap = useRef(null);
  const view = useRef(null);
  const content = useRef(null);
  const [avail, setAvail] = useState(0);
  const [natH, setNatH] = useState(0);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const pending = useRef(null);
  const pinch = useRef(null);
  // Room around the drawing for labels that hang off its edges.
  const [pad, setPad] = useState({ l: 0, r: 0, t: 0, b: 0 });

  // Track the space we have and the drawing's own height.
  useLayoutEffect(() => {
    const w = wrap.current, c = content.current;
    if (!w || !c) return;
    setAvail(w.clientWidth);
    setNatH(c.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setAvail(w.clientWidth);
      setNatH(c.offsetHeight);
    });
    ro.observe(w);
    ro.observe(c, { box: "border-box" });
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(width, (avail || width || 1) - pad.l - pad.r);
  const natW = innerW + pad.l + pad.r;
  const fit = avail ? Math.min(1, avail / natW) : 1;
  const scale = fit * zoom;
  const fitRef = useRef(fit);
  useLayoutEffect(() => {
    fitRef.current = fit;
  }, [fit]);

  /** Zoom to `next`, keeping content point (ux, uy) under view point (px, py). */
  const zoomTo = useCallback((next, px, py, ux, uy) => {
    const v = view.current;
    if (!v) return;
    next = clamp(next, 1, MAX_ZOOM);
    const s1 = fitRef.current * next;
    const target = { left: ux * s1 - px, top: uy * s1 - py };
    if (next === zoomRef.current) {
      v.scrollLeft = target.left;
      v.scrollTop = target.top;
      return;
    }
    pending.current = target;
    zoomRef.current = next;
    setZoomState(next);
  }, []);

  /** Zoom about a point in the view (default: its center). */
  const zoomAbout = useCallback(
    (next, px, py) => {
      const v = view.current;
      if (!v) return;
      if (px === undefined) {
        px = v.clientWidth / 2;
        py = v.clientHeight / 2;
      }
      const s0 = fitRef.current * zoomRef.current;
      zoomTo(next, px, py, (v.scrollLeft + px) / s0, (v.scrollTop + py) / s0);
    },
    [zoomTo]
  );

  // After every render, check whether any overlay sticks out past the drawing,
  // and make room for it so nothing is cut off when the whole drawing is shown.
  useLayoutEffect(() => {
    const measure = () => {
      const c = content.current;
      const inner = c?.firstElementChild;
      if (!inner) return;
      const box = inner.getBoundingClientRect();
      const s = box.width / (inner.offsetWidth || 1) || 1;
      const need = { l: 0, r: 0, t: 0, b: 0 };
      for (const el of c.querySelectorAll(".dg-at")) {
        const r = el.getBoundingClientRect();
        need.l = Math.max(need.l, (box.left - r.left) / s);
        need.r = Math.max(need.r, (r.right - box.right) / s);
        need.t = Math.max(need.t, (box.top - r.top) / s);
        need.b = Math.max(need.b, (r.bottom - box.bottom) / s);
      }
      const round = (x) => (x > 1 ? Math.ceil((x + 6) / 8) * 8 : 0);
      // Only ever grow, so the drawing doesn't jitter as labels change width.
      setPad((p) => {
        const next = { l: Math.max(p.l, round(need.l)), r: Math.max(p.r, round(need.r)), t: Math.max(p.t, round(need.t)), b: Math.max(p.b, round(need.b)) };
        return next.l === p.l && next.r === p.r && next.t === p.t && next.b === p.b ? p : next;
      });
    };
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  });

  useLayoutEffect(() => {
    const v = view.current;
    if (!v || !pending.current) return;
    v.scrollLeft = pending.current.left;
    v.scrollTop = pending.current.top;
    pending.current = null;
  }, [zoom]);

  // Pinch (touch) and ctrl/⌘ + wheel (desktop, trackpad pinch). These need
  // non-passive listeners so the page itself doesn't zoom instead.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const local = (x, y) => {
      const r = v.getBoundingClientRect();
      return { px: x - r.left, py: y - r.top };
    };
    const two = (e) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, ...local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    };
    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      const t = two(e);
      const s0 = fitRef.current * zoomRef.current;
      pinch.current = { d0: t.d, z0: zoomRef.current, ux: (v.scrollLeft + t.px) / s0, uy: (v.scrollTop + t.py) / s0 };
    };
    const onMove = (e) => {
      if (!pinch.current || e.touches.length !== 2) return;
      e.preventDefault();
      const t = two(e);
      const p = pinch.current;
      zoomTo((p.z0 * t.d) / p.d0, t.px, t.py, p.ux, p.uy);
    };
    const onEnd = (e) => {
      if (e.touches.length < 2) pinch.current = null;
    };
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { px, py } = local(e.clientX, e.clientY);
      zoomAbout(zoomRef.current * Math.exp(-e.deltaY * 0.01), px, py);
    };
    // Safari's own pinch gesture: keep it on the drawing, not the page.
    const stop = (e) => e.preventDefault();
    v.addEventListener("touchstart", onStart, { passive: true });
    v.addEventListener("touchmove", onMove, { passive: false });
    v.addEventListener("touchend", onEnd);
    v.addEventListener("touchcancel", onEnd);
    v.addEventListener("wheel", onWheel, { passive: false });
    v.addEventListener("gesturestart", stop);
    v.addEventListener("gesturechange", stop);
    return () => {
      v.removeEventListener("touchstart", onStart);
      v.removeEventListener("touchmove", onMove);
      v.removeEventListener("touchend", onEnd);
      v.removeEventListener("touchcancel", onEnd);
      v.removeEventListener("wheel", onWheel);
      v.removeEventListener("gesturestart", stop);
      v.removeEventListener("gesturechange", stop);
    };
  }, [zoomTo, zoomAbout]);

  const fitAll = () => {
    pending.current = { left: 0, top: 0 };
    zoomRef.current = 1;
    setZoomState(1);
  };

  const zoomed = zoom > 1.001;
  const fitH = natH * fit;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Zoomed in, the frame grows to most of the screen and scrolls inside.
  const viewStyle = zoomed ? { maxHeight: Math.max(fitH, Math.round(vh * 0.75)), overflow: "auto" } : { overflow: "hidden" };

  return (
    <div ref={wrap} className={`zp ${zoomed ? "is-zoomed" : ""} ${className}`}>
      <div className="zp-bar" role="group" aria-label={`Zoom ${label}`}>
        <span className="zp-hint">{zoomed ? "Drag to pan · pinch to zoom" : "Pinch or + to zoom in"}</span>
        <button type="button" onClick={() => zoomAbout(zoomRef.current / 1.5)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out">
          <Minus size={15} />
        </button>
        <output className="zp-level" aria-label="Zoom level">
          {Math.round(scale * 100)}%
        </output>
        <button type="button" onClick={() => zoomAbout(zoomRef.current * 1.5)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
          <Plus size={15} />
        </button>
        <button type="button" className="zp-fit" onClick={fitAll} disabled={!zoomed} title="Show the whole drawing">
          <Maximize size={14} aria-hidden="true" /> Fit
        </button>
      </div>
      <div ref={view} className="zp-view" style={viewStyle}>
        <div className="zp-sizer" style={{ width: natW * scale, height: natH * scale }}>
          <div ref={content} className="zp-content" style={{ width: natW, padding: `${pad.t}px ${pad.r}px ${pad.b}px ${pad.l}px`, transform: `scale(${scale})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
