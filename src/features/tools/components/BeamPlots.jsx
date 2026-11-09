import { useLayoutEffect, useRef, useState } from "react";
import { fromSI, unitLabel, fmt } from "../model/units";
import { simpleBeamItems } from "../model/structures";
import ZoomPan from "./ZoomPan";

// Shear, moment and deflection plotted under a sketch of the beam, all on the
// same x scale, with a crosshair that reads all three at once.

// Drawn at the card's real pixel width, so text stays the same size on any screen.
const PAD_R = 28;
const PLOT_H = 176;

function useWidth(ref) {
  const [w, setW] = useState(960);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const PLOTS = [
  { key: "V", label: "Shear", dim: "force", color: "#5cc8ff", sign: 1 },
  { key: "M", label: "Bending moment", dim: "moment", color: "#c6a6ff", sign: 1 },
  { key: "y", label: "Deflection", dim: "smallLength", color: "#7be0c3", sign: -1 },
];

export default function BeamPlots({ v, unit }) {
  const [hoverX, setHoverX] = useState(null);
  const box = useRef(null);
  const W = useWidth(box);
  // On narrow screens the labels go above each plot instead of beside it.
  const narrow = W < 560;
  const PAD_L = narrow ? 18 : 92;
  const { pts, L } = v;
  if (!pts?.length || !(L > 0)) return <div ref={box} />;
  const items = v.items || simpleBeamItems(v);
  const sx = (x) => PAD_L + (x / L) * (W - PAD_L - PAD_R);
  const toX = (px) => Math.min(L, Math.max(0, ((px - PAD_L) / (W - PAD_L - PAD_R)) * L));
  const marks = [...new Set([0, L, ...items.flatMap((it) => (it.kind === "udl" ? [it.x1, it.x2] : [it.x]))].map((x) => Math.min(L, Math.max(0, x))))];

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHoverX(px < PAD_L - 10 || px > W - PAD_R + 10 ? null : toX(px));
  };
  // Value at x: interpolate, taking the right-hand side of jumps.
  const at = (key, x) => {
    let i = pts.findIndex((p) => p.x > x);
    if (i <= 0) return pts[i === 0 ? 0 : pts.length - 1][key];
    const a = pts[i - 1], b = pts[i];
    return b.x === a.x ? b[key] : a[key] + ((b[key] - a[key]) * (x - a.x)) / (b.x - a.x);
  };
  const xUnit = unit("length");
  const readout = hoverX === null ? null : (
    <div className="tf-bp-readout" aria-live="off">
      <span>
        x <strong>{fmt(fromSI(hoverX, "length", xUnit), 3)} {unitLabel("length", xUnit)}</strong>
      </span>
      {PLOTS.map((p) => (
        <span key={p.key}>
          <i style={{ background: p.color }} />
          {p.label} <strong>{fmt(fromSI(at(p.key, hoverX), p.dim, unit(p.dim)), 3)} {unitLabel(p.dim, unit(p.dim))}</strong>
        </span>
      ))}
    </div>
  );

  return (
    <section className="tf-card tf-visual tf-bp" aria-label="Shear, moment and deflection diagrams">
      <div ref={box} className="tf-bp-measure" />
      <div className="tf-bp-head">
        <h3 className="tf-visual-title">Shear, moment and deflection</h3>
        {readout || <span className="tf-muted tf-small">Point at or tap a diagram to read values anywhere along the beam.</span>}
      </div>
      <ZoomPan label="shear, moment and deflection diagrams">
        <svg viewBox={`0 0 ${W} 92`} className="tf-bp-sketch" role="img" aria-label="Beam, supports and loads">
          <BeamSketch items={items} L={L} sx={sx} />
          {hoverX !== null && <line x1={sx(hoverX)} x2={sx(hoverX)} y1="0" y2="92" className="tf-bp-cross" />}
        </svg>
        {PLOTS.map((p) => (
          <Plot key={p.key} W={W} padL={PAD_L} narrow={narrow} p={p} pts={pts} sx={sx} marks={marks} unit={unit(p.dim)} hoverX={hoverX} at={at} onMove={onMove} onLeave={() => setHoverX(null)} />
        ))}
      </ZoomPan>
    </section>
  );
}

function Plot({ W, padL, narrow, p, pts, sx, marks, unit, hoverX, at, onMove, onLeave }) {
  const vals = pts.map((q) => fromSI(q[p.key], p.dim, unit));
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const top = narrow ? 52 : 28, bottom = PLOT_H - 28;
  // Deflection is drawn downward, the way the beam actually bends.
  const flip = p.sign < 0;
  const sy = (val) => (flip ? top + ((val - lo) / span) * (bottom - top) : bottom - ((val - lo) / span) * (bottom - top));
  const y0 = sy(0);
  const line = pts.map((q, i) => `${i ? "L" : "M"}${sx(q.x).toFixed(1)},${sy(vals[i]).toFixed(1)}`).join(" ");
  const area = `M${sx(pts[0].x).toFixed(1)},${y0.toFixed(1)} ` + pts.map((q, i) => `L${sx(q.x).toFixed(1)},${sy(vals[i]).toFixed(1)}`).join(" ") + ` L${sx(pts[pts.length - 1].x).toFixed(1)},${y0.toFixed(1)} Z`;
  const iHi = vals.indexOf(Math.max(...vals)), iLo = vals.indexOf(Math.min(...vals));
  const big = Math.max(Math.abs(hi), Math.abs(lo));
  const label = (i, above) => {
    const x = Math.min(Math.max(sx(pts[i].x), padL + 46), W - PAD_R - 46);
    const y = sy(vals[i]);
    return (
      <g className="tf-bp-peak">
        <circle cx={sx(pts[i].x)} cy={y} r="4.5" fill={p.color} />
        <text x={x} y={above ? y - 10 : y + 20} textAnchor="middle">
          {fmt(vals[i], 3)} {unitLabel(p.dim, unit)}
        </text>
      </g>
    );
  };
  const id = `bp-${p.key}`;
  return (
    <div className="tf-bp-row">
      <svg viewBox={`0 0 ${W} ${PLOT_H}`} role="img" aria-label={`${p.label} diagram`} onPointerDown={onMove} onPointerMove={onMove} onPointerLeave={(e) => e.pointerType === "mouse" && onLeave()}>
        <defs>
          <clipPath id={`${id}-pos`}>
            <rect x="0" y="0" width={W} height={y0} />
          </clipPath>
          <clipPath id={`${id}-neg`}>
            <rect x="0" y={y0} width={W} height={PLOT_H - y0} />
          </clipPath>
        </defs>
        <text x="14" y="22" className="tf-bp-label" fill={p.color}>
          {p.label}
          {narrow && <tspan className="tf-bp-unit"> · {unitLabel(p.dim, unit)}</tspan>}
        </text>
        {!narrow && (
          <text x="14" y="40" className="tf-bp-unit">
            {unitLabel(p.dim, unit)}
          </text>
        )}
        {marks.map((m) => (
          <line key={m} x1={sx(m)} x2={sx(m)} y1={top - 8} y2={bottom + 8} className="tf-bp-grid" />
        ))}
        <path d={area} fill={p.color} fillOpacity="0.28" clipPath={`url(#${id}-pos)`} />
        <path d={area} fill={p.color} fillOpacity="0.14" clipPath={`url(#${id}-neg)`} />
        <line x1={sx(0) - 6} x2={W - PAD_R + 6} y1={y0} y2={y0} className="tf-bp-zero" />
        <path d={line} fill="none" stroke={p.color} strokeWidth="2.75" strokeLinejoin="round" />
        {Math.abs(vals[iHi]) > big * 0.04 && vals[iHi] > 0 && label(iHi, !flip)}
        {Math.abs(vals[iLo]) > big * 0.04 && vals[iLo] < 0 && label(iLo, flip)}
        {hoverX !== null && (
          <g className="tf-bp-hover">
            <line x1={sx(hoverX)} x2={sx(hoverX)} y1="0" y2={PLOT_H} className="tf-bp-cross" />
            <circle cx={sx(hoverX)} cy={sy(fromSI(at(p.key, hoverX), p.dim, unit))} r="5" fill="#fff" stroke={p.color} strokeWidth="2.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Supports and loads drawn small, on the plots' x scale. */
export function BeamSketch({ items, L, sx, y = 58 }) {
  const maxW = Math.max(1e-12, ...items.filter((i) => i.kind === "udl").flatMap((u) => [Math.abs(u.w1), Math.abs(u.w2)]));
  const cx = (x) => sx(Math.min(L, Math.max(0, x)));
  return (
    <g>
      {items
        .filter((i) => i.kind === "udl")
        .map((u, k) => {
          const h1 = 8 + 16 * (Math.abs(u.w1) / maxW), h2 = 8 + 16 * (Math.abs(u.w2) / maxW);
          return <path key={`u${k}`} d={`M${cx(u.x1)},${y - 6} V${y - 6 - h1} L${cx(u.x2)},${y - 6 - h2} V${y - 6} Z`} className="tf-bp-udl" />;
        })}
      <rect x={sx(0)} y={y - 5} width={sx(L) - sx(0)} height="10" rx="2" className="tf-beam-body" />
      {items.map((it, k) => {
        const x = cx(it.x ?? 0);
        if (it.kind === "pin") return <path key={k} d={`M${x},${y + 5} l-10,16 h20 Z`} className="tf-support" />;
        if (it.kind === "roller")
          return (
            <g key={k} className="tf-support">
              <circle cx={x} cy={y + 13} r="8" />
              <line x1={x - 14} x2={x + 14} y1={y + 23} y2={y + 23} />
            </g>
          );
        if (it.kind === "fixed") {
          const side = it.x <= 0 ? -1 : it.x >= L ? 1 : 0;
          return side ? <rect key={k} x={side < 0 ? x - 10 : x} y={y - 24} width="10" height="48" className="tf-support" /> : <rect key={k} x={x - 12} y={y + 5} width="24" height="16" className="tf-support" />;
        }
        if (it.kind === "point") {
          const up = it.P < 0;
          return (
            <g key={k} className="tf-load">
              <line x1={x} x2={x} y1={up ? y - 10 : y - 44} y2={up ? y - 40 : y - 12} />
              <path d={up ? `M${x - 5},${y - 34} L${x},${y - 44} L${x + 5},${y - 34} Z` : `M${x - 5},${y - 15} L${x},${y - 6} L${x + 5},${y - 15} Z`} />
            </g>
          );
        }
        if (it.kind === "moment") {
          const cw = it.M >= 0;
          return (
            <g key={k} className="tf-bp-moment">
              <path d={`M${x - 14},${y - 4} A15,15 0 1,1 ${x + 14},${y - 4}`} fill="none" />
              <path d={cw ? `M${x + 14},${y + 2} l-6,-8 l9,-1 Z` : `M${x - 14},${y + 2} l6,-8 l-9,-1 Z`} />
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}
