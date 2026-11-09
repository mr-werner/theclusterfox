import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { compile } from "../engine/expr.js";
import { fmtNum } from "../engine/frac.js";
import { Tex } from "./Tex";

const W = 720;
const H = 440;
const COLORS = ["var(--mf-c1)", "var(--mf-c2)", "var(--mf-c3)", "var(--mf-c4)"];

function niceStep(span, target = 8) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? mag * 10;
}

const tickLabel = v => {
  const s = fmtNum(v, 6);
  return s === "-0" ? "0" : s;
};

function prepare(graph) {
  const v = graph.v ?? "x";
  return graph.fns.map((f, i) => {
    const color = COLORS[i % COLORS.length];
    if (f.implicit) {
      const F = compile(f.implicit);
      return { kind: "implicit", F: (x, y) => F({ x, y }), color, label: f.label, dashed: f.dashed };
    }
    if (f.f) return { kind: "explicit", f: f.f, color, label: f.label, dashed: true };
    const g = compile(f.e);
    return { kind: "explicit", f: x => g({ [v]: x }), color, label: f.label, dashed: f.dashed };
  });
}

function autoView(graph, fns) {
  const xs = [];
  for (const p of graph.points ?? []) if (Number.isFinite(p.x) && Math.abs(p.x) < 1e6) xs.push(p.x);
  for (const s of graph.shade ?? []) {
    if (Number.isFinite(s.lo)) xs.push(s.lo);
    if (Number.isFinite(s.hi)) xs.push(s.hi);
  }
  if (Number.isFinite(graph.focusX)) xs.push(graph.focusX);
  for (const x of graph.vlines ?? []) xs.push(x);
  let x0 = -10;
  let x1 = 10;
  if (xs.length) {
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const span = Math.max(hi - lo, 4);
    x0 = Math.min(lo - span * 0.35, lo === hi ? lo - 5 : lo - span * 0.35);
    x1 = Math.max(hi + span * 0.35, lo === hi ? hi + 5 : hi + span * 0.35);
    if (x0 > -1 && x0 < 1) x0 = Math.min(x0, -1);
    if (hi - lo < 20 && lo > -15 && hi < 15) {
      x0 = Math.min(x0, -2);
      x1 = Math.max(x1, 2);
    }
  }
  const explicit = fns.filter(f => f.kind === "explicit");
  if (!explicit.length) {
    // implicit only: equal scale on both axes
    const cx = (x0 + x1) / 2;
    const ys = (graph.points ?? []).map(p => p.y).filter(Number.isFinite);
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    let span = Math.max(x1 - x0, 12);
    const ySpan = (span * H) / W;
    return { x0: cx - span / 2, x1: cx + span / 2, y0: cy - ySpan / 2, y1: cy + ySpan / 2 };
  }
  const vals = [];
  for (const f of explicit)
    for (let i = 0; i <= 400; i++) {
      const y = f.f(x0 + ((x1 - x0) * i) / 400);
      if (Number.isFinite(y)) vals.push(y);
    }
  for (const p of graph.points ?? []) if (Number.isFinite(p.y)) vals.push(p.y);
  for (const y of graph.hlines ?? []) vals.push(y);
  vals.sort((a, b) => a - b);
  let y0 = -10;
  let y1 = 10;
  if (vals.length) {
    const q = p => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * (vals.length - 1))))];
    y0 = q(0.04);
    y1 = q(0.96);
    const pts = (graph.points ?? []).map(p => p.y).filter(Number.isFinite);
    if (pts.length) {
      y0 = Math.min(y0, ...pts);
      y1 = Math.max(y1, ...pts);
    }
    if (y1 - y0 < 1e-9) {
      y0 -= 2;
      y1 += 2;
    }
    const pad = (y1 - y0) * 0.15;
    y0 -= pad;
    y1 += pad;
    if (y0 > 0 && y0 < (y1 - y0) * 0.6) y0 = -(y1 - y0) * 0.08;
    if (y1 < 0 && -y1 < (y1 - y0) * 0.6) y1 = (y1 - y0) * 0.08;
  }
  return { x0, x1, y0, y1 };
}

function explicitPath(f, view, sx, sy) {
  const n = 900;
  const span = view.y1 - view.y0;
  let d = "";
  let pen = false;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = view.x0 + ((view.x1 - view.x0) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y) || Math.abs(y - (view.y0 + view.y1) / 2) > span * 50) {
      pen = false;
      prev = null;
      continue;
    }
    if (prev !== null && Math.abs(y - prev) > span * 2 && Math.sign(y - (view.y0 + view.y1) / 2) !== Math.sign(prev - (view.y0 + view.y1) / 2)) pen = false;
    const X = sx(x).toFixed(2);
    const Y = Math.max(-5000, Math.min(5000, sy(y))).toFixed(2);
    d += `${pen ? "L" : "M"}${X} ${Y}`;
    pen = true;
    prev = y;
  }
  return d;
}

function implicitPath(F, view, sx, sy) {
  const nx = 150;
  const ny = Math.round((nx * H) / W);
  const dx = (view.x1 - view.x0) / nx;
  const dy = (view.y1 - view.y0) / ny;
  const grid = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) row.push(F(view.x0 + i * dx, view.y0 + j * dy));
    grid.push(row);
  }
  let d = "";
  const interp = (a, b, va, vb) => a + ((b - a) * va) / (va - vb);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
      if (!v.every(Number.isFinite)) continue;
      const x = view.x0 + i * dx;
      const y = view.y0 + j * dy;
      const pts = [];
      // edges: bottom (0-1), right (1-2), top (2-3), left (3-0)
      const corners = [
        [x, y],
        [x + dx, y],
        [x + dx, y + dy],
        [x, y + dy],
      ];
      for (let e = 0; e < 4; e++) {
        const a = e;
        const b = (e + 1) % 4;
        if (v[a] === 0 && v[b] === 0) continue;
        if ((v[a] <= 0) !== (v[b] <= 0)) {
          const t = v[a] / (v[a] - v[b]);
          pts.push([corners[a][0] + (corners[b][0] - corners[a][0]) * t, corners[a][1] + (corners[b][1] - corners[a][1]) * t]);
        }
      }
      void interp;
      // skip sign flips across poles: the function should be small near the crossing
      const mag = Math.max(...v.map(Math.abs));
      const centre = F(x + dx / 2, y + dy / 2);
      if (!Number.isFinite(centre) || Math.abs(centre) > mag * 2.5) continue;
      for (let k = 0; k + 1 < pts.length; k += 2)
        d += `M${sx(pts[k][0]).toFixed(2)} ${sy(pts[k][1]).toFixed(2)}L${sx(pts[k + 1][0]).toFixed(2)} ${sy(pts[k + 1][1]).toFixed(2)}`;
    }
  return d;
}

export default function Graph({ graph }) {
  const fns = useMemo(() => prepare(graph), [graph]);
  const initial = useMemo(() => autoView(graph, fns), [graph, fns]);
  const [view, setView] = useState(initial);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());

  const sx = useCallback(x => ((x - view.x0) / (view.x1 - view.x0)) * W, [view]);
  const sy = useCallback(y => H - ((y - view.y0) / (view.y1 - view.y0)) * H, [view]);
  const toWorld = useCallback(
    (px, py) => ({ x: view.x0 + (px / W) * (view.x1 - view.x0), y: view.y0 + ((H - py) / H) * (view.y1 - view.y0) }),
    [view]
  );

  const localPoint = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { px: ((e.clientX - r.left) / r.width) * W, py: ((e.clientY - r.top) / r.height) * H };
  };

  const zoom = useCallback((factor, cx, cy) => {
    setView(v => {
      const fx = cx ?? (v.x0 + v.x1) / 2;
      const fy = cy ?? (v.y0 + v.y1) / 2;
      const nx0 = fx - (fx - v.x0) * factor;
      const nx1 = fx + (v.x1 - fx) * factor;
      const ny0 = fy - (fy - v.y0) * factor;
      const ny1 = fy + (v.y1 - fy) * factor;
      if (nx1 - nx0 < 1e-6 || nx1 - nx0 > 1e7) return v;
      return { x0: nx0, x1: nx1, y0: ny0, y1: ny1 };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = e => {
      e.preventDefault();
      const { px, py } = localPoint(e);
      const w = toWorld(px, py);
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, w.x, w.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toWorld, zoom]);

  const onPointerDown = e => {
    svgRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, localPoint(e));
    if (pointers.current.size === 1) drag.current = { start: localPoint(e), view };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { pinch: Math.hypot(a.px - b.px, a.py - b.py), view, mid: { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 } };
    }
  };
  const onPointerMove = e => {
    const p = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (d && pointers.current.size === 2 && d.pinch) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.px - b.px, a.py - b.py);
      const f = d.pinch / Math.max(dist, 1);
      const v0 = d.view;
      const cx = v0.x0 + (d.mid.px / W) * (v0.x1 - v0.x0);
      const cy = v0.y0 + ((H - d.mid.py) / H) * (v0.y1 - v0.y0);
      setView({ x0: cx - (cx - v0.x0) * f, x1: cx + (v0.x1 - cx) * f, y0: cy - (cy - v0.y0) * f, y1: cy + (v0.y1 - cy) * f });
      return;
    }
    if (d && pointers.current.size === 1 && d.start) {
      const v0 = d.view;
      const dx = ((p.px - d.start.px) / W) * (v0.x1 - v0.x0);
      const dy = ((p.py - d.start.py) / H) * (v0.y1 - v0.y0);
      setView({ x0: v0.x0 - dx, x1: v0.x1 - dx, y0: v0.y0 + dy, y1: v0.y1 + dy });
      setHover(null);
      return;
    }
    const w = toWorld(p.px, p.py);
    const f = fns.find(g => g.kind === "explicit");
    if (f) {
      const y = f.f(w.x);
      setHover(Number.isFinite(y) ? { x: w.x, y } : null);
    } else setHover({ x: w.x, y: w.y, free: true });
  };
  const onPointerUp = e => {
    pointers.current.delete(e.pointerId);
    drag.current = pointers.current.size === 1 ? { start: [...pointers.current.values()][0], view } : null;
  };

  const stepX = niceStep(view.x1 - view.x0);
  const stepY = niceStep(view.y1 - view.y0, 6);
  const gx = [];
  for (let x = Math.ceil(view.x0 / stepX) * stepX; x <= view.x1; x += stepX) gx.push(Number(x.toPrecision(12)));
  const gy = [];
  for (let y = Math.ceil(view.y0 / stepY) * stepY; y <= view.y1; y += stepY) gy.push(Number(y.toPrecision(12)));
  const axisY = Math.min(H - 2, Math.max(2, sy(0)));
  const axisX = Math.min(W - 2, Math.max(2, sx(0)));

  const paths = fns.map(f => (f.kind === "explicit" ? explicitPath(f.f, view, sx, sy) : implicitPath(f.F, view, sx, sy)));
  const first = fns.find(f => f.kind === "explicit");

  const shadePaths = (graph.shade ?? []).map(s => {
    const lo = Math.max(view.x0, Number.isFinite(s.lo) ? s.lo : -Infinity);
    const hi = Math.min(view.x1, Number.isFinite(s.hi) ? s.hi : Infinity);
    if (!(hi > lo)) return null;
    if (s.under && first) {
      let d = `M${sx(lo)} ${sy(0)}`;
      const n = 200;
      for (let i = 0; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        const y = first.f(x);
        if (Number.isFinite(y)) d += `L${sx(x).toFixed(2)} ${Math.max(-5000, Math.min(5000, sy(y))).toFixed(2)}`;
      }
      d += `L${sx(hi)} ${sy(0)}Z`;
      return { d, under: true };
    }
    return { rect: { x: sx(lo), w: sx(hi) - sx(lo) } };
  });

  const axes = graph.axes ?? [graph.v ?? "x", "y"];

  return (
    <div className="mf-graph">
      <div className="mf-graph__legend">
        {fns.map((f, i) => (
          <span key={i} className="mf-graph__key">
            <i style={{ background: f.color, opacity: f.dashed ? 0.7 : 1 }} className={f.dashed ? "is-dashed" : ""} />
            <Tex tex={f.label} />
          </span>
        ))}
      </div>
      <div className="mf-graph__frame">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Graph"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <rect width={W} height={H} className="mf-graph__bg" />
          {shadePaths.map((s, i) =>
            !s ? null : s.under ? <path key={i} d={s.d} className="mf-graph__area" /> : <rect key={i} x={s.rect.x} y={0} width={s.rect.w} height={H} className="mf-graph__band" />
          )}
          {gx.map(x => (
            <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} className={x === 0 ? "mf-graph__axis" : "mf-graph__grid"} />
          ))}
          {gy.map(y => (
            <line key={`gy${y}`} y1={sy(y)} y2={sy(y)} x1={0} x2={W} className={y === 0 ? "mf-graph__axis" : "mf-graph__grid"} />
          ))}
          {gx.map(x =>
            x === 0 || sx(x) < 14 || sx(x) > W - 14 ? null : (
              <text key={`tx${x}`} x={sx(x)} y={Math.min(H - 6, axisY + 16)} className="mf-graph__tick" textAnchor="middle">
                {tickLabel(x)}
              </text>
            )
          )}
          {gy.map(y =>
            y === 0 || sy(y) < 12 || sy(y) > H - 8 ? null : (
              <text key={`ty${y}`} x={Math.min(W - 6, Math.max(6, axisX - 6))} y={sy(y) + 4} className="mf-graph__tick" textAnchor={axisX < 40 ? "start" : "end"}>
                {tickLabel(y)}
              </text>
            )
          )}
          <text x={W - 8} y={axisY - 8} className="mf-graph__axislabel" textAnchor="end">
            {axes[0]}
          </text>
          <text x={axisX + 8} y={16} className="mf-graph__axislabel">
            {axes[1]}
          </text>
          {(graph.vlines ?? []).map((x, i) => (
            <line key={`vl${i}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} className="mf-graph__asym" />
          ))}
          {(graph.hlines ?? []).map((y, i) => (
            <line key={`hl${i}`} y1={sy(y)} y2={sy(y)} x1={0} x2={W} className="mf-graph__asym" />
          ))}
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={fns[i].color} strokeWidth={2.6} strokeDasharray={fns[i].dashed ? "7 6" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {(graph.points ?? []).map((p, i) =>
            Number.isFinite(p.x) && Number.isFinite(p.y) ? (
              <g key={`p${i}`} className="mf-graph__pt">
                <circle cx={sx(p.x)} cy={sy(p.y)} r={5.5} className={p.hollow ? "is-hollow" : ""} />
                <title>{`${p.label ?? "point"} (${fmtNum(p.x, 6)}, ${fmtNum(p.y, 6)})`}</title>
              </g>
            ) : null
          )}
          {hover && (
            <g className="mf-graph__hover">
              <line x1={sx(hover.x)} x2={sx(hover.x)} y1={0} y2={H} />
              {!hover.free && <circle cx={sx(hover.x)} cy={sy(hover.y)} r={4.5} />}
            </g>
          )}
        </svg>
        <div className="mf-graph__tools">
          <button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => zoom(1.5)} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" onClick={() => setView(initial)} aria-label="Reset view">
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="mf-graph__readout" aria-live="polite">
          {hover ? `(${fmtNum(hover.x, 4)}, ${fmtNum(hover.y, 4)})` : "Drag to move, scroll or pinch to zoom"}
        </div>
      </div>
      {(graph.points ?? []).some(p => p.label && p.label !== "point") && (
        <ul className="mf-graph__points">
          {dedupePoints(graph.points).map((p, i) => (
            <li key={i}>
              <span className={`mf-dot ${p.hollow ? "is-hollow" : ""}`} />
              <b>{p.label}</b> ({fmtNum(p.x, 6)}, {fmtNum(p.y, 6)})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dedupePoints(points) {
  const out = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (out.some(o => Math.abs(o.x - p.x) < 1e-9 && Math.abs(o.y - p.y) < 1e-9 && o.label === p.label)) continue;
    out.push(p);
  }
  return out.slice(0, 16);
}
