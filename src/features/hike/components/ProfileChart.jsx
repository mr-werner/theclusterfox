import { useLayoutEffect, useRef, useState } from "react";

// The elevation profile: climb along the trail, with peaks, water and
// other features marked, and a "you are here" line while hiking.
export default function ProfileChart({ trip, pois = [], f, here = null, turnAt = null, height = 170 }) {
  const box = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!trip || trip.length < 2) return null;

  const pad = { l: 46, r: 12, t: 14, b: 24 };
  const total = trip[trip.length - 1][0];
  const eles = trip.map(p => p[1]);
  let lo = Math.min(...eles);
  let hi = Math.max(...eles);
  const span = Math.max(60, hi - lo);
  lo -= span * 0.12;
  hi += span * 0.12;
  const x = d => pad.l + (d / total) * (w - pad.l - pad.r);
  const y = e => pad.t + (1 - (e - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const path = trip.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const area = `${path}L${x(total).toFixed(1)},${height - pad.b}L${pad.l},${height - pad.b}Z`;

  // Gridlines at round numbers in the display unit.
  const ticks = [];
  const loU = f.toEle(lo);
  const hiU = f.toEle(hi);
  const step = [50, 100, 200, 250, 500, 1000, 2000].find(s => (hiU - loU) / s <= 4) ?? 5000;
  for (let v = Math.ceil(loU / step) * step; v <= hiU; v += step) ticks.push(v);
  const distTicks = [];
  const totalU = f.toDist(total);
  const dStep = [0.5, 1, 2, 5, 10, 20].find(s => totalU / s <= 6) ?? 50;
  for (let v = dStep; v < totalU; v += dStep) distTicks.push(v);
  const fromU = u => (u / f.toDist(1000)) * 1000;
  const fromEleU = u => u / f.toEle(1);

  function move(e) {
    const rect = box.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const d = Math.max(0, Math.min(total, ((px - pad.l) / (w - pad.l - pad.r)) * total));
    let best = trip[0];
    for (const p of trip) if (Math.abs(p[0] - d) < Math.abs(best[0] - d)) best = p;
    setHover(best);
  }

  return (
    <div className="hk-profile" ref={box} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`Elevation profile from ${f.ele(Math.min(...eles))} to ${f.ele(Math.max(...eles))}`}>
        <defs>
          <linearGradient id="hk-prof-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--hk-accent)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--hk-accent)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(fromEleU(v))} y2={y(fromEleU(v))} className="hk-prof-grid" />
            <text x={pad.l - 6} y={y(fromEleU(v))} dy="0.32em" textAnchor="end" className="hk-prof-axis">{Math.round(v).toLocaleString()}</text>
          </g>
        ))}
        {distTicks.map(v => (
          <text key={v} x={x(fromU(v))} y={height - 6} textAnchor="middle" className="hk-prof-axis">{v} {f.distUnit}</text>
        ))}
        <path d={area} fill="url(#hk-prof-fill)" />
        <path d={path} className="hk-prof-line" />
        {turnAt !== null && <line x1={x(turnAt)} x2={x(turnAt)} y1={pad.t} y2={height - pad.b} className="hk-prof-turn" />}
        {pois.filter(p => Number.isFinite(p.d) && p.d <= total).map(p => {
          const e = trip.reduce((b, q) => (Math.abs(q[0] - p.d) < Math.abs(b[0] - p.d) ? q : b), trip[0])[1];
          return (
            <g key={p.id} transform={`translate(${x(p.d)} ${y(e)})`} className={`hk-prof-poi hk-mk--${p.kind}`}>
              <circle r="4" />
              <title>{p.name || p.kind}</title>
            </g>
          );
        })}
        {here !== null && <line x1={x(here)} x2={x(here)} y1={pad.t} y2={height - pad.b} className="hk-prof-here" />}
        {hover && (
          <g>
            <line x1={x(hover[0])} x2={x(hover[0])} y1={pad.t} y2={height - pad.b} className="hk-prof-cursor" />
            <circle cx={x(hover[0])} cy={y(hover[1])} r="4" className="hk-prof-dot" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="hk-prof-tip" style={{ left: Math.min(w - 130, Math.max(0, x(hover[0]) - 60)) }}>
          {f.short(hover[0])} · {f.ele(hover[1])}
        </div>
      )}
    </div>
  );
}
