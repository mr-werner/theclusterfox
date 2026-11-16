import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, RotateCw, Maximize2 } from "lucide-react";
import { EXTENT, boxCorners, fenceEnds, fenceFromEnds, isBoxKind, isTreeKind, localPoint, worldPoint, bearing, moveHouse, turnHouse, seasonDay } from "../model/yard";
import { sunPosition, lightFor } from "../model/sun";
import { plantsById } from "../data/plants";

// A top-down plan of the yard. Map meters: x east, y north; SVG y runs down,
// so a point (x, y) is drawn at (x, -y). The whole plan turns so any compass
// direction can sit at the top (yard.turn), and zooms and pans.
//
// Layers, bottom to top: ground cover (lawn, beds, mulch, rocks, patios),
// the sun layer (hours of sun, shadows at a moment, or where a plant fits),
// plants, fences, buildings with hip roofs, tree crowns, spot pins, and the
// edit handles for whatever is selected.

const E = EXTENT;
const FT = 3.28084;
const MAX_ZOOM = 5;

// One SVG path per class, with runs of equal cells merged into strips.
function layers(n, cell, classOf) {
  const out = {};
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      const k = classOf(row * n + col);
      let end = col + 1;
      while (end < n && classOf(row * n + end) === k) end++;
      if (k != null) out[k] = (out[k] ?? "") + `M${(-E + col * cell).toFixed(2)} ${(-E + row * cell).toFixed(2)}h${((end - col) * cell).toFixed(2)}v${cell}h${(-(end - col) * cell).toFixed(2)}z`;
      col = end;
    }
  }
  return out;
}

const pts = corners => corners.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join(" ");
const snap = (deg, step = 5) => (((Math.round(deg / step) * step) % 360) + 360) % 360;
const clampMap = v => Math.max(-E + 0.2, Math.min(E - 0.2, Math.round(v * 100) / 100));

// A hip roof: the outline plus a ridge and four hips.
function Roof({ b, className }) {
  const c = boxCorners(b);
  const along = b.w >= b.d; // ridge runs along the front
  const half = Math.abs(b.w - b.d) / 2;
  const r0 = along ? worldPoint({ x: b.cx, y: b.cy, angle: b.angle }, 0, -half) : worldPoint({ x: b.cx, y: b.cy, angle: b.angle }, -half, 0);
  const r1 = along ? worldPoint({ x: b.cx, y: b.cy, angle: b.angle }, 0, half) : worldPoint({ x: b.cx, y: b.cy, angle: b.angle }, half, 0);
  // Corners in order: front-left, front-right, back-right, back-left.
  const near = along ? [r0, r1, r1, r0] : [r1, r1, r0, r0];
  return (
    <g className={className}>
      <polygon points={pts(c)} className="gf-ym-roof" />
      <g className="gf-ym-hips">
        <line x1={r0[0]} y1={-r0[1]} x2={r1[0]} y2={-r1[1]} />
        {c.map(([x, y], i) => (
          <line key={i} x1={x} y1={-y} x2={near[i][0]} y2={-near[i][1]} />
        ))}
      </g>
    </g>
  );
}

// A leafy crown: soft scalloped edge. An evergreen: a dark, spiky star.
function crownPath(o) {
  const n = o.kind === "evergreen" ? 32 : 60;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = o.kind === "evergreen" ? (i % 2 ? o.r * 0.74 : o.r) : o.r * (0.86 + 0.14 * Math.abs(Math.cos(t * 4.5)));
    out.push(`${(o.x + Math.sin(t) * r).toFixed(2)},${(-(o.y + Math.cos(t) * r)).toFixed(2)}`);
  }
  return `M${out.join("L")}Z`;
}

function Ground({ o }) {
  const b = { cx: o.x, cy: o.y, w: o.w, d: o.d, angle: o.angle };
  const cls = `gf-ym-ground-item gf-ym-${o.kind}`;
  const shape = o.round ? <ellipse cx={0} cy={0} rx={o.w / 2} ry={o.d / 2} transform={`translate(${o.x} ${-o.y}) rotate(${o.angle})`} className={cls} /> : <polygon points={pts(boxCorners(b))} className={cls} />;
  if (o.kind !== "raised") return shape;
  // A raised bed: a wooden frame around the soil.
  const inner = { ...b, w: Math.max(0.1, o.w - 0.3), d: Math.max(0.1, o.d - 0.3) };
  return (
    <g>
      <polygon points={pts(boxCorners(b))} className="gf-ym-frame" />
      <polygon points={pts(boxCorners(inner))} className={cls} />
    </g>
  );
}

export default function YardMap({ yard, latitude, mode = "hours", grid = null, moment = null, fit = null, season = "season", spots = [], selected = null, onSelect, onYard, onSpot, onAction, editable = false, units = "us", label, showSun = true }) {
  const svg = useRef(null);
  const world = useRef(null);
  const [drag, setDrag] = useState(null);
  const [view, setView] = useState({ zoom: 1, px: 0, py: 0 });
  const turn = yard.turn ?? 0;
  const zoom = view.zoom;
  const size = (E * 2) / zoom;
  const vb = [view.px - size / 2, view.py - size / 2, size, size];

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page.
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const onWheel = e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setView(v => withZoom(v, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const heat = useMemo(() => {
    if (mode === "fit" && grid && fit) return layers(grid.n, grid.cell, i => (Number.isNaN(grid.hours[i]) ? null : ["no", "ok", "best"][fit[i]]));
    if (mode === "hours" && grid) return layers(grid.n, grid.cell, i => (Number.isNaN(grid.hours[i]) ? null : lightFor(grid.hours[i])));
    if (mode === "moment" && moment) return layers(moment.n, moment.cell, i => (Number.isNaN(moment.lit[i]) || moment.lit[i] > 0.9 ? null : moment.lit[i] < 0.3 ? "dark" : "dapple"));
    return {};
  }, [mode, grid, fit, moment]);

  // The sun's path through a typical day of the season, around the edge.
  const sunPath = useMemo(() => {
    if (latitude == null || !showSun) return [];
    const doy = seasonDay(season, latitude);
    const out = [];
    for (let h = 4; h <= 20; h++) {
      const { alt, az } = sunPosition(latitude, doy, h);
      if (alt < 10) continue;
      const r = E - 1;
      out.push({ h, alt, x: Math.sin((az * Math.PI) / 180) * r, y: Math.cos((az * Math.PI) / 180) * r });
    }
    return out;
  }, [latitude, season, showSun]);

  const toMap = e => {
    const m = world.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: -p.y };
  };

  // What the yard (or a spot) looks like with the drag in progress.
  const live = useMemo(() => (drag?.at ? result(yard, drag) : { yard, spot: null }), [yard, drag]);
  const shown = live.yard;

  const start = (target, part) => e => {
    if (!editable || e.button > 0) return;
    e.stopPropagation();
    if (part === "move") onSelect?.(target.id);
    const at = toMap(e);
    if (!at) return;
    svg.current.setPointerCapture(e.pointerId);
    setDrag({ target, part, ox: at.x - target.x, oy: at.y - target.y, at: null });
  };
  const startPan = e => {
    if (!editable || e.button > 0) return;
    const w = svg.current.getBoundingClientRect().width || 1;
    svg.current.setPointerCapture(e.pointerId);
    setDrag({ part: "pan", sx: e.clientX, sy: e.clientY, px: view.px, py: view.py, ratio: size / w, moved: false });
  };
  const move = e => {
    if (!drag) return;
    if (drag.part === "pan") {
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!drag.moved) setDrag(d => ({ ...d, moved: true }));
      if (zoom > 1) setView(v => clampView({ ...v, px: drag.px - dx * drag.ratio, py: drag.py - dy * drag.ratio }));
      return;
    }
    const at = toMap(e);
    if (at) setDrag(d => ({ ...d, at }));
  };
  const drop = () => {
    if (!drag) return;
    if (drag.part === "pan") {
      if (!drag.moved) onSelect?.(null);
    } else if (drag.at) {
      const r = result(yard, drag);
      if (r.spot) onSpot?.(r.spot.id, r.spot.x, r.spot.y);
      else onYard?.(r.yard);
    }
    setDrag(null);
  };

  const keys = target => e => {
    if (!editable) return;
    const step = e.shiftKey ? 2 : 0.25;
    // Arrow keys move along the screen, whichever way the map is turned.
    const screen = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (screen) {
      e.preventDefault();
      const a = (turn * Math.PI) / 180;
      const dx = (screen[0] * Math.cos(a) + screen[1] * Math.sin(a)) * step;
      const dy = (-screen[0] * Math.sin(a) + screen[1] * Math.cos(a)) * step;
      const r = result(yard, { target, part: "move", ox: 0, oy: 0, at: { x: target.x + dx, y: target.y + dy } });
      if (r.spot) onSpot?.(r.spot.id, r.spot.x, r.spot.y);
      else onYard?.(r.yard);
    } else if ((e.key === "Delete" || e.key === "Backspace") && target.kind !== "house") {
      e.preventDefault();
      onAction?.("delete", target.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && target.kind !== "house" && target.kind !== "spot") {
      e.preventDefault();
      onAction?.("duplicate", target.id);
    } else if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      const r = result(yard, { target, part: "rotate", key: e.key === "]" ? 15 : -15 });
      onYard?.(r.yard);
    }
  };

  const objProps = (target, name) =>
    editable
      ? {
          tabIndex: 0,
          role: "button",
          "aria-label": `${name}. Drag to move; arrow keys nudge it`,
          "aria-pressed": selected === target.id,
          onPointerDown: start(target, "move"),
          onKeyDown: keys(target),
          onFocus: () => onSelect?.(target.id),
          className: `gf-ym-obj${selected === target.id ? " is-selected" : ""}`,
        }
      : { className: "gf-ym-obj" };
  const upright = (x, y) => `rotate(${turn} ${x} ${-y})`;

  const houseTarget = { id: "house", kind: "house", x: shown.cx ?? 0, y: shown.cy ?? 0, angle: shown.facing, w: shown.width, d: shown.depth };
  const houseBox = { cx: houseTarget.x, cy: houseTarget.y, w: shown.width, d: shown.depth, angle: shown.facing };
  const door = worldPoint(houseTarget, shown.depth / 2, 0);
  const ground = shown.objects.filter(o => isBoxKind(o.kind) && OBJECT_GROUND.has(o.kind));
  const plants = shown.objects.filter(o => o.kind === "plant");
  const fences = shown.objects.filter(o => o.kind === "fence");
  const blocks = shown.objects.filter(o => o.kind === "shed" || o.kind === "wing");
  const trees = shown.objects.filter(o => isTreeKind(o.kind));
  const sel = selected === "house" ? houseTarget : shown.objects.find(o => o.id === selected) ?? null;
  const hs = 0.42 * Math.max(0.6, 1.4 / zoom); // handle radius, about the same size on screen
  const scale = scaleBar(size, units);
  const labelsOn = zoom >= 1.5;

  return (
    <div className={`gf-ym-wrap${editable ? " is-editable" : ""}`}>
      <svg
        ref={svg}
        className={`gf-yardmap gf-ym-mode--${mode}${editable ? " is-editable" : ""}${zoom > 1 ? " is-zoomed" : ""}${drag ? " is-dragging" : ""}`}
        viewBox={vb.map(n => n.toFixed(3)).join(" ")}
        role="img"
        aria-label={label ?? "Plan of your yard, colored by hours of direct sun"}
        onPointerMove={move}
        onPointerUp={drop}
        onPointerCancel={() => setDrag(null)}
        onPointerDown={startPan}
      >
        <defs>
          <pattern id="gf-pat-lawn" width="0.6" height="0.6" patternUnits="userSpaceOnUse">
            <rect width="0.6" height="0.6" className="gf-ym-lawn-bg" />
            <path d="M0.1 0.5 l0.05 -0.22 M0.35 0.25 l0.05 -0.2 M0.45 0.58 l0.04 -0.2" className="gf-ym-lawn-blade" />
          </pattern>
          <pattern id="gf-pat-soil" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <rect width="0.5" height="0.5" className="gf-ym-soil-bg" />
            <circle cx="0.12" cy="0.15" r="0.035" className="gf-ym-soil-dot" />
            <circle cx="0.36" cy="0.38" r="0.03" className="gf-ym-soil-dot" />
          </pattern>
          <pattern id="gf-pat-mulch" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <rect width="0.5" height="0.5" className="gf-ym-mulch-bg" />
            <path d="M0.05 0.1 l0.12 0.05 M0.3 0.3 l0.1 -0.06 M0.15 0.4 l0.1 0.03 M0.38 0.08 l0.06 0.1" className="gf-ym-mulch-chip" />
          </pattern>
          <pattern id="gf-pat-rocks" width="0.9" height="0.9" patternUnits="userSpaceOnUse">
            <rect width="0.9" height="0.9" className="gf-ym-rocks-bg" />
            <ellipse cx="0.22" cy="0.25" rx="0.17" ry="0.13" className="gf-ym-rock" />
            <ellipse cx="0.62" cy="0.55" rx="0.2" ry="0.15" className="gf-ym-rock" />
            <ellipse cx="0.2" cy="0.7" rx="0.12" ry="0.09" className="gf-ym-rock" />
          </pattern>
          <pattern id="gf-pat-patio" width="1" height="1" patternUnits="userSpaceOnUse">
            <rect width="1" height="1" className="gf-ym-patio-bg" />
            <path d="M0 0 H1 M0 0 V1 M0.5 0 V0.5 M0 0.5 H1" className="gf-ym-patio-joint" />
          </pattern>
          <filter id="gf-soft" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.22" />
          </filter>
          <filter id="gf-lift" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0.15" dy="0.2" stdDeviation="0.2" floodColor="#2b2a20" floodOpacity="0.35" />
          </filter>
          <clipPath id="gf-lot">
            <rect x={-E} y={-E} width={E * 2} height={E * 2} />
          </clipPath>
        </defs>

        <rect x={vb[0] - 1} y={vb[1] - 1} width={vb[2] + 2} height={vb[3] + 2} className="gf-ym-outside" />
        <g ref={world} transform={`rotate(${-turn})`}>
          <rect x={-E} y={-E} width={E * 2} height={E * 2} className="gf-ym-base" />

          {ground.map(o => (
            <g key={o.id} {...objProps(o, OBJECT_NAMES[o.kind])}>
              <Ground o={o} />
            </g>
          ))}

          <g className={`gf-ym-heat gf-ym-heat--${mode}`} clipPath="url(#gf-lot)" filter={mode === "fit" ? undefined : "url(#gf-soft)"}>
            {Object.entries(heat).map(([k, d]) => (
              <path key={k} d={d} className={`gf-ym-cell gf-ym-cell--${k}`} />
            ))}
          </g>

          {sunPath.map(s => (
            <g key={s.h} className="gf-ym-sun" transform={`translate(${s.x.toFixed(2)} ${(-s.y).toFixed(2)})`}>
              <circle r={0.26 + (s.alt / 90) * 0.3} />
              {(s.h === 6 || s.h === 12 || s.h === 18) && (
                <text y={-0.8} transform={`rotate(${turn})`}>
                  {s.h === 12 ? "noon" : s.h === 6 ? "6am" : "6pm"}
                </text>
              )}
            </g>
          ))}

          {plants.map(o => {
            const p = plantsById.get(o.plantId);
            return (
              <g key={o.id} {...objProps(o, p?.name ?? "Plant")}>
                <circle cx={o.x} cy={-o.y} r={Math.max(0.2, o.r)} className="gf-ym-plant" style={{ "--c": p?.color ?? "#5c8f45" }} />
                <circle cx={o.x} cy={-o.y} r={Math.max(0.08, o.r * 0.35)} className="gf-ym-plant-heart" />
                {(labelsOn || selected === o.id) && p && (
                  <text x={o.x} y={-o.y + Math.max(0.2, o.r) + 0.75} transform={upright(o.x, o.y)} className="gf-ym-label">
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}

          {fences.map(o => {
            const [a, b] = fenceEnds(o);
            return (
              <g key={o.id} {...objProps(o, "Fence")}>
                <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} className="gf-ym-hit" />
                <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} className="gf-ym-fence" />
                <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} className="gf-ym-posts" />
              </g>
            );
          })}

          <g filter="url(#gf-lift)">
            {blocks.map(o => (
              <g key={o.id} {...objProps(o, o.kind === "wing" ? "House wing" : "Shed")}>
                <Roof b={{ cx: o.x, cy: o.y, w: o.w, d: o.d, angle: o.angle }} className={o.kind === "wing" ? "gf-ym-house" : "gf-ym-shed"} />
              </g>
            ))}
            <g {...objProps(houseTarget, "House")}>
              <Roof b={houseBox} className="gf-ym-house" />
              <circle cx={door[0]} cy={-door[1]} r={0.5} className="gf-ym-door" />
            </g>
          </g>
          <text x={houseTarget.x} y={-houseTarget.y + 0.4} transform={upright(houseTarget.x, houseTarget.y)} className="gf-ym-house-label">
            House
          </text>

          {trees.map(o => (
            <g key={o.id} {...objProps(o, o.kind === "evergreen" ? "Evergreen tree" : "Leafy tree")}>
              <path d={crownPath(o)} className={`gf-ym-crown gf-ym-crown--${o.kind}`} />
              {o.kind === "evergreen" ? (
                <g className="gf-ym-needles">
                  {Array.from({ length: 8 }, (_, i) => {
                    const t = (i / 8) * Math.PI * 2;
                    return <line key={i} x1={o.x} y1={-o.y} x2={o.x + Math.sin(t) * o.r * 0.8} y2={-(o.y + Math.cos(t) * o.r * 0.8)} />;
                  })}
                </g>
              ) : (
                <circle cx={o.x - o.r * 0.22} cy={-(o.y + o.r * 0.22)} r={o.r * 0.5} className="gf-ym-crown-light" />
              )}
              <circle cx={o.x} cy={-o.y} r={Math.min(0.35, o.r * 0.15)} className="gf-ym-trunk" />
            </g>
          ))}

          {spots.map((raw, i) => {
            if (raw.x == null || raw.y == null) return null;
            const s = live.spot?.id === raw.id ? { ...raw, ...live.spot } : raw;
            const target = { id: s.id, kind: "spot", x: s.x, y: s.y };
            return (
              <g key={s.id} {...objProps(target, `Spot ${s.name}`)}>
                <g transform={`translate(${s.x} ${-s.y}) rotate(${turn})`}>
                  <circle r={0.8} className={`gf-ym-pin gf-ym-pin--${s.light}`} />
                  <text y={0.3} className="gf-ym-pin-num">
                    {i + 1}
                  </text>
                </g>
              </g>
            );
          })}

          {editable && sel && <Handles o={sel} hs={hs} start={start} />}
        </g>

        <g className="gf-ym-scale" transform={`translate(${vb[0] + size * 0.04} ${vb[1] + size * 0.95})`} aria-hidden="true">
          <path d={`M0 ${-size * 0.012} V0 H${scale.len} V${-size * 0.012}`} style={{ strokeWidth: size * 0.004 }} />
          <text x={scale.len / 2} y={-size * 0.02} style={{ fontSize: size * 0.026 }}>
            {scale.text}
          </text>
        </g>
      </svg>

      <div className="gf-ym-controls" role="group" aria-label="Map view">
        <button type="button" className="gf-ym-compass" onClick={() => onYard?.({ ...yard, turn: 0 })} disabled={!editable} title={turn ? "Put north back at the top" : "North is at the top"} aria-label={`North arrow. ${turn ? "Put north back at the top" : "North is at the top"}`}>
          <span style={{ transform: `rotate(${-turn}deg)` }}>
            <svg viewBox="-6 -8 12 16" aria-hidden="true">
              <path d="M0 -7 L4 4 L0 2 L-4 4 Z" />
            </svg>
            <b>N</b>
          </span>
        </button>
        <button type="button" onClick={() => setView(v => withZoom(v, v.zoom * 1.4))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => setView(v => withZoom(v, v.zoom / 1.4))} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out">
          <Minus size={16} />
        </button>
        {zoom > 1 && (
          <button type="button" onClick={() => setView({ zoom: 1, px: 0, py: 0 })} aria-label="Show the whole yard" title="Show the whole yard">
            <Maximize2 size={15} />
          </button>
        )}
        {editable && (
          <>
            <button type="button" onClick={() => onYard?.({ ...yard, turn: snap(turn - 15, 15) })} aria-label="Turn the map left" title="Turn the map left">
              <RotateCcw size={15} />
            </button>
            <button type="button" onClick={() => onYard?.({ ...yard, turn: snap(turn + 15, 15) })} aria-label="Turn the map right" title="Turn the map right">
              <RotateCw size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const OBJECT_GROUND = new Set(["lawn", "bed", "raised", "mulch", "rocks", "patio"]);
const OBJECT_NAMES = { lawn: "Lawn", bed: "Garden bed", raised: "Raised bed", mulch: "Mulch", rocks: "Rocks", patio: "Patio or path" };

function withZoom(v, z) {
  return clampView({ ...v, zoom: Math.max(1, Math.min(MAX_ZOOM, z)) });
}
function clampView(v) {
  const room = E - E / v.zoom;
  return { ...v, px: Math.max(-room, Math.min(room, v.px)), py: Math.max(-room, Math.min(room, v.py)) };
}

// A scale bar about a fifth of the view wide, in round numbers.
function scaleBar(size, units) {
  const want = size / 5;
  if (units === "metric") {
    const m = [1, 2, 5, 10, 20].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    return { len: m, text: `${m} m` };
  }
  const ft = [5, 10, 20, 40, 60].reduce((a, b) => (Math.abs(b / FT - want) < Math.abs(a / FT - want) ? b : a));
  return { len: ft / FT, text: `${ft} ft` };
}

// Edit handles: corner to resize, a knob out front to turn, ends for fences,
// an edge knob for the spread of trees and plants.
function Handles({ o, hs, start }) {
  const knob = (x, y, part, label, cls = "") => <circle cx={x} cy={-y} r={hs} className={`gf-ym-handle ${cls}`} onPointerDown={start(o, part)} aria-label={label} />;
  if (o.kind === "fence") {
    const [a, b] = fenceEnds(o);
    return (
      <g className="gf-ym-handles">
        {knob(a[0], a[1], "end0", "Drag to move this end")}
        {knob(b[0], b[1], "end1", "Drag to move this end")}
      </g>
    );
  }
  if (o.kind === "spot") return null;
  if (isTreeKind(o.kind) || o.kind === "plant") {
    return (
      <g className="gf-ym-handles">
        <circle cx={o.x} cy={-o.y} r={o.r} className="gf-ym-select" />
        {knob(o.x + o.r, o.y, "radius", "Drag to change the spread", "is-size")}
      </g>
    );
  }
  const b = { cx: o.x, cy: o.y, w: o.w, d: o.d, angle: o.angle };
  const corner = worldPoint(o, o.d / 2, o.w / 2);
  const front = worldPoint(o, o.d / 2, 0);
  const knobAt = worldPoint(o, o.d / 2 + hs * 4, 0);
  return (
    <g className="gf-ym-handles">
      <polygon points={pts(boxCorners(b))} className="gf-ym-select" />
      <line x1={front[0]} y1={-front[1]} x2={knobAt[0]} y2={-knobAt[1]} className="gf-ym-handle-stem" />
      {knob(knobAt[0], knobAt[1], "rotate", "Drag to turn it", "is-turn")}
      {knob(corner[0], corner[1], "size", "Drag to resize", "is-size")}
    </g>
  );
}

// The yard after a drag (or keyboard turn), and a moved spot if that's what moved.
function result(yard, d) {
  const t = d.target;
  const at = d.at;
  if (t.kind === "spot") return { yard, spot: { id: t.id, x: clampMap(at.x - d.ox), y: clampMap(at.y - d.oy) } };
  if (t.kind === "house") {
    if (d.part === "move") return { yard: moveHouse(yard, at.x - d.ox, at.y - d.oy) };
    if (d.part === "rotate") return { yard: turnHouse(yard, d.key != null ? yard.facing + d.key : snap(bearing(yard.cx ?? 0, yard.cy ?? 0, at.x, at.y))) };
    if (d.part === "size") {
      const { u, v } = localPoint({ x: yard.cx ?? 0, y: yard.cy ?? 0, angle: yard.facing }, at.x, at.y);
      return { yard: { ...yard, width: lim(2 * Math.abs(v), 3, 40), depth: lim(2 * Math.abs(u), 3, 40) } };
    }
    return { yard };
  }
  const o = yard.objects.find(x => x.id === t.id);
  if (!o) return { yard };
  let next = o;
  if (d.part === "move") next = { ...o, x: clampMap(at.x - d.ox), y: clampMap(at.y - d.oy) };
  else if (d.part === "rotate") next = { ...o, angle: d.key != null ? snap((o.angle ?? 0) + d.key) : snap(bearing(o.x, o.y, at.x, at.y)) };
  else if (d.part === "size") {
    const { u, v } = localPoint(o, at.x, at.y);
    next = { ...o, w: lim(2 * Math.abs(v), 0.3, 40), d: lim(2 * Math.abs(u), 0.3, 40) };
  } else if (d.part === "radius") next = { ...o, r: lim(Math.hypot(at.x - o.x, at.y - o.y), 0.15, 15) };
  else if (d.part === "end0" || d.part === "end1") {
    const [a, b] = fenceEnds(o);
    const p = [clampMap(at.x), clampMap(at.y)];
    next = { ...o, ...fenceFromEnds(d.part === "end0" ? p : a, d.part === "end0" ? b : p) };
  }
  return { yard: { ...yard, objects: yard.objects.map(x => (x.id === o.id ? next : x)) } };
}

const lim = (n, a, b) => Math.round(Math.max(a, Math.min(b, n)) * 100) / 100;
