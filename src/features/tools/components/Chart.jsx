import { useId, useState } from "react";
import { fromSI, unitLabel, fmt } from "../model/units";

// A small SVG line chart. Points are SI; axes display in the chosen units.
// series: [{ points: [{x, y}], color, label, dashed }]

const W = 640;
const H = 300;
const PAD = { l: 62, r: 18, t: 16, b: 46 };

function niceTicks(lo, hi, count = 5) {
  if (!(hi > lo)) return [lo];
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    const v = 10 ** e;
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
  }
  return out;
}

export default function Chart({ series, x, y, marker, logX = false, logY = false, height = H, legend = true }) {
  const id = useId();
  const [hover, setHover] = useState(null);
  const conv = (axis, v) => (axis.dim ? fromSI(v, axis.dim, axis.unit) : v);
  const all = series.flatMap((s) => s.points.map((p) => ({ x: conv(x, p.x), y: conv(y, p.y) }))).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!all.length) return null;
  let [x0, x1] = [Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x))];
  let [y0, y1] = [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))];
  if (x.min !== undefined) x0 = x.min;
  if (x.max !== undefined) x1 = x.max;
  if (y.min !== undefined) y0 = y.min;
  if (y.max !== undefined) y1 = y.max;
  if (!logY) {
    const padY = (y1 - y0 || Math.abs(y1) || 1) * 0.06;
    y0 = y.min ?? (y0 >= 0 && y0 - padY < 0 ? 0 : y0 - padY);
    y1 = y.max ?? y1 + padY;
  }
  if (x1 === x0) x1 = x0 + 1;
  const ih = height - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const sx = (v) => PAD.l + (logX ? (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) : (v - x0) / (x1 - x0)) * iw;
  const sy = (v) => PAD.t + ih - (logY ? (Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) : (v - y0) / (y1 - y0)) * ih;
  const xt = logX ? logTicks(x0, x1) : niceTicks(x0, x1, 6);
  const yt = logY ? niceLogY(y0, y1) : niceTicks(y0, y1, 5);
  const xUnit = x.dim ? unitLabel(x.dim, x.unit) : "";
  const yUnit = y.dim ? unitLabel(y.dim, y.unit) : "";

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < PAD.l || px > W - PAD.r) return setHover(null);
    const s = series[0];
    let best = null;
    for (const p of s.points) {
      const d = Math.abs(sx(conv(x, p.x)) - px);
      if (!best || d < best.d) best = { d, p };
    }
    setHover(best?.p ?? null);
  }

  return (
    <figure className="tf-chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${y.label} against ${x.label}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <clipPath id={`clip${id}`}>
            <rect x={PAD.l} y={PAD.t} width={iw} height={ih} />
          </clipPath>
        </defs>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="tf-grid" />
            <text x={PAD.l - 8} y={sy(t) + 4} textAnchor="end" className="tf-tick">
              {logY ? fmtLog(t) : fmt(t, 3)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={height - PAD.b} className="tf-grid" />
            <text x={sx(t)} y={height - PAD.b + 17} textAnchor="middle" className="tf-tick">
              {logX ? fmtLog(t) : fmt(t, 3)}
            </text>
          </g>
        ))}
        <text x={PAD.l + iw / 2} y={height - 6} textAnchor="middle" className="tf-axis-label">
          {x.label}
          {xUnit ? ` (${xUnit})` : ""}
        </text>
        <text transform={`translate(14 ${PAD.t + ih / 2}) rotate(-90)`} textAnchor="middle" className="tf-axis-label">
          {y.label}
          {yUnit ? ` (${yUnit})` : ""}
        </text>
        <g clipPath={`url(#clip${id})`}>
          {series.map((s, k) => {
            const d = s.points
              .map((p) => [conv(x, p.x), conv(y, p.y)])
              .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && (!logX || a > 0) && (!logY || b > 0))
              .map(([a, b], i) => `${i ? "L" : "M"}${sx(a).toFixed(1)},${sy(b).toFixed(1)}`)
              .join("");
            return <path key={k} d={d} fill="none" stroke={s.color || "var(--tf-accent)"} strokeWidth={s.width || 2.2} strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinejoin="round" />;
          })}
          {marker && Number.isFinite(marker.x) && Number.isFinite(marker.y) && (
            <g className="tf-marker">
              <line x1={sx(conv(x, marker.x))} x2={sx(conv(x, marker.x))} y1={PAD.t} y2={height - PAD.b} />
              <circle cx={sx(conv(x, marker.x))} cy={sy(conv(y, marker.y))} r="6" />
            </g>
          )}
          {hover && (
            <circle cx={sx(conv(x, hover.x))} cy={sy(conv(y, hover.y))} r="4" className="tf-hover-dot" />
          )}
        </g>
      </svg>
      {hover && (
        <figcaption className="tf-chart-readout">
          {x.label}: <strong>{fmt(conv(x, hover.x))}</strong> {xUnit} · {y.label}: <strong>{fmt(conv(y, hover.y))}</strong> {yUnit}
        </figcaption>
      )}
      {legend && series.some((s) => s.label) && (
        <div className="tf-legend">
          {series.filter((s) => s.label).map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

function niceLogY(lo, hi) {
  const ticks = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo * 0.999 && v <= hi * 1.001) ticks.push(v);
    }
  }
  return ticks;
}

function fmtLog(v) {
  const e = Math.round(Math.log10(v));
  if (Math.abs(v - 10 ** e) < 1e-9 * v && (e > 3 || e < -2)) return `10${"⁰¹²³⁴⁵⁶⁷⁸⁹".split("").reduce((s, c, i) => s.replaceAll(String(i), c), String(e)).replace("-", "⁻")}`;
  return fmt(v, 3);
}
