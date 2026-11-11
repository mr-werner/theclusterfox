import { useMemo, useRef, useState } from "react";
import { EXTENT, SEASONS, boxCorners, fenceEnds } from "../model/yard";
import { sunPosition, lightFor } from "../model/sun";

// A top-down map of the yard, north up. Each patch of ground is colored by
// how much direct sun it gets (or, for a plant, how well it fits), with the
// house, sheds, fences and trees drawn on top. Map meters: x east, y north;
// SVG y runs down, so a point (x, y) is drawn at (x, -y).

const E = EXTENT;
const FT = 3.28084;

// One SVG path per class, with runs of equal cells merged into strips.
function layers(grid, classOf) {
  const out = {};
  const { n, cell } = grid;
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

export default function YardMap({ yard, grid, latitude, season = "season", fit = null, spots = [], selected = null, onSelect, onMove, editable = false, units = "us", label }) {
  const svg = useRef(null);
  const [drag, setDrag] = useState(null); // { id, x, y }

  const heat = useMemo(() => {
    if (!grid) return {};
    if (fit) return layers(grid, i => (Number.isNaN(grid.hours[i]) ? null : ["no", "ok", "best"][fit[i]]));
    return layers(grid, i => (Number.isNaN(grid.hours[i]) ? null : lightFor(grid.hours[i])));
  }, [grid, fit]);

  // Where the sun is through a typical day of the season, around the edge.
  const sunPath = useMemo(() => {
    if (latitude == null) return [];
    const days = SEASONS[season].days(latitude >= 0);
    const doy = days[Math.floor(days.length / 2)];
    const out = [];
    for (let h = 4; h <= 20; h++) {
      const { alt, az } = sunPosition(latitude, doy, h);
      if (alt < 10) continue;
      const r = E - 0.9;
      out.push({ h, alt, x: Math.sin((az * Math.PI) / 180) * r, y: Math.cos((az * Math.PI) / 180) * r });
    }
    return out;
  }, [latitude, season]);

  const toMap = e => {
    const m = svg.current.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const clamp = v => Math.max(-E + 0.3, Math.min(E - 0.3, Math.round(v * 10) / 10));
    return { x: clamp(p.x), y: clamp(-p.y) };
  };
  const grab = o => e => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(o.id);
    const at = toMap(e);
    if (!at) return;
    svg.current.setPointerCapture(e.pointerId);
    // Keep the grab point under the finger instead of jumping the center to it.
    setDrag({ id: o.id, x: o.x, y: o.y, ox: at.x - o.x, oy: at.y - o.y, moved: false });
  };
  const move = e => {
    if (!drag) return;
    const at = toMap(e);
    const clamp = v => Math.max(-E + 0.3, Math.min(E - 0.3, Math.round(v * 10) / 10));
    if (at) setDrag(d => ({ ...d, x: clamp(at.x - d.ox), y: clamp(at.y - d.oy), moved: true }));
  };
  const drop = () => {
    if (drag?.moved) onMove?.(drag.id, drag.x, drag.y);
    setDrag(null);
  };
  const nudge = id => e => {
    const step = e.shiftKey ? 2 : 0.5;
    const d = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (!d || !editable) return;
    e.preventDefault();
    const o = yard.objects.find(x => x.id === id) ?? spots.find(x => x.id === id);
    if (o) onMove?.(id, Math.max(-E, Math.min(E, o.x + d[0])), Math.max(-E, Math.min(E, o.y + d[1])));
  };
  const at = o => (drag?.id === o.id ? { ...o, x: drag.x, y: drag.y } : o);
  const handle = (o, name) =>
    editable
      ? {
          tabIndex: 0,
          role: "button",
          "aria-label": `${name}. Drag to move, or use the arrow keys`,
          "aria-pressed": selected === o.id,
          onPointerDown: grab(o),
          onKeyDown: nudge(o.id),
          onFocus: () => onSelect?.(o.id),
          className: `gf-ym-obj${selected === o.id ? " is-selected" : ""}`,
        }
      : { className: "gf-ym-obj" };

  const house = { cx: 0, cy: 0, w: yard.width, d: yard.depth, angle: yard.facing };
  const a = (yard.facing * Math.PI) / 180;
  const front = [Math.sin(a) * (yard.depth / 2), Math.cos(a) * (yard.depth / 2)];
  const ridge = boxCorners({ ...house, w: yard.width - 1, d: 0.01 });
  const scale = units === "metric" ? { len: 5, text: "5 m" } : { len: 20 / FT, text: "20 ft" };

  return (
    <svg
      ref={svg}
      className={`gf-yardmap${editable ? " is-editable" : ""}${fit ? " is-fit" : ""}`}
      viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`}
      role="img"
      aria-label={label ?? "Map of your yard, north up, colored by hours of direct sun"}
      onPointerMove={move}
      onPointerUp={drop}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={() => editable && onSelect?.(null)}
    >
      <rect x={-E} y={-E} width={E * 2} height={E * 2} className="gf-ym-ground" />
      {Object.entries(heat).map(([k, d]) => (
        <path key={k} d={d} className={`gf-ym-cell gf-ym-cell--${k}`} />
      ))}

      {sunPath.map(s => (
        <g key={s.h} className="gf-ym-sun" transform={`translate(${s.x.toFixed(2)} ${(-s.y).toFixed(2)})`}>
          <circle r={0.28 + (s.alt / 90) * 0.32} />
          {(s.h === 6 || s.h === 12 || s.h === 18) && (
            <text y={s.y > E - 3 ? 1.5 : -0.9}>{s.h === 12 ? "noon" : s.h === 6 ? "6am" : "6pm"}</text>
          )}
        </g>
      ))}

      {/* House */}
      <g className="gf-ym-house">
        <polygon points={pts(boxCorners(house))} />
        <polyline points={pts(ridge)} className="gf-ym-ridge" />
        <circle cx={front[0]} cy={-front[1]} r={0.55} className="gf-ym-door" />
        <text x={0} y={0.5}>House</text>
      </g>

      {yard.objects.map(raw => {
        const o = at(raw);
        if (o.kind === "shed" || o.kind === "wing")
          return (
            <g key={o.id} {...handle(o, o.kind === "wing" ? "House wing" : "Shed")}>
              <polygon points={pts(boxCorners({ cx: o.x, cy: o.y, w: o.w, d: o.d, angle: o.angle }))} className={o.kind === "wing" ? "gf-ym-wing" : "gf-ym-shed"} />
            </g>
          );
        if (o.kind === "fence") {
          const [p, q] = fenceEnds(o);
          return (
            <g key={o.id} {...handle(o, "Fence")}>
              <line x1={p[0]} y1={-p[1]} x2={q[0]} y2={-q[1]} className="gf-ym-hit" />
              <line x1={p[0]} y1={-p[1]} x2={q[0]} y2={-q[1]} className="gf-ym-fence" />
            </g>
          );
        }
        return (
          <g key={o.id} {...handle(o, o.kind === "evergreen" ? "Evergreen tree" : "Leafy tree")}>
            <circle cx={o.x} cy={-o.y} r={o.r} className={`gf-ym-tree gf-ym-tree--${o.kind}`} />
            <circle cx={o.x} cy={-o.y} r={0.3} className="gf-ym-trunk" />
          </g>
        );
      })}

      {spots.map((raw, i) => {
        if (raw.x == null || raw.y == null) return null;
        const s = at(raw);
        return (
          <g key={s.id} {...handle(s, `Spot ${s.name}`)} transform={`translate(${s.x} ${-s.y})`}>
            <circle r={0.85} className={`gf-ym-pin gf-ym-pin--${s.light}`} />
            <text y={0.32}>{i + 1}</text>
          </g>
        );
      })}

      <g className="gf-ym-north" transform={`translate(${-E + 1.6} ${-E + 1.9})`} aria-hidden="true">
        <path d="M0 -1.2 L0.7 0.8 L0 0.4 L-0.7 0.8 Z" />
        <text y={2}>N</text>
      </g>
      <g className="gf-ym-scale" transform={`translate(${-E + 1} ${E - 1})`} aria-hidden="true">
        <path d={`M0 -0.3 V0 H${scale.len} V-0.3`} />
        <text x={scale.len / 2} y={-0.6}>{scale.text}</text>
      </g>
    </svg>
  );
}
