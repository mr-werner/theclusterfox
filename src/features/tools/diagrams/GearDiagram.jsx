import { useRef } from "react";
import { Canvas, At, Num, Badge } from "./kit";
import { useDrag, keyNudge, show, clamp } from "./helpers";
import { fmt } from "../model/units";

// Two meshing gears drawn to their tooth counts. They turn in opposite
// directions at speeds set by the ratio.

const W = 880, H = 440;
const CY = 220;

function gearPath(r, teeth) {
  const n = clamp(Math.round(teeth), 6, 90);
  const depth = clamp(r * 0.12, 5, 11);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const step = (2 * Math.PI) / n;
    const at = (ang, rad) => `${(rad * Math.cos(ang)).toFixed(2)},${(rad * Math.sin(ang)).toFixed(2)}`;
    pts.push(at(a, r - depth), at(a + step * 0.12, r + depth * 0.2), at(a + step * 0.38, r + depth * 0.2), at(a + step * 0.5, r - depth));
  }
  return `M${pts.join(" L")} Z`;
}

export default function GearDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const num = (key, label, dim) => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const N1 = v.N1 > 0 ? v.N1 : 1, N2 = v.N2 > 0 ? v.N2 : 1;
  // Radii follow the tooth counts, kept inside the drawing.
  const big = Math.max(N1, N2);
  let k = 150 / big;
  if (Math.min(N1, N2) * k < 34) k = 34 / Math.min(N1, N2);
  const r1 = clamp(N1 * k, 34, 150), r2 = clamp(N2 * k, 34, 150);
  const gap = r1 + r2;
  const mid = W / 2 - 40;
  const c1 = mid - r2, c2 = c1 + gap;
  const i = N2 / N1;
  const p1 = v.n1 > 0 ? clamp(30 / v.n1, 0.6, 30) : 0;
  const p2 = p1 * i;
  // Drag a gear's rim in or out to change its tooth count (relative to where you grabbed it).
  const rim = (key, center) => [
    ({ x, y }, g) => g && set(key, clamp(Math.round((g.n * Math.hypot(x - g.cx, y - CY)) / g.d), 6, 200)),
    { field: key, onStart: (p) => ({ n: v[key] > 0 ? v[key] : 1, cx: center, d: Math.max(10, Math.hypot(p.x - center, p.y - CY)) }) },
  ];
  const drag1 = useDrag(svgRef, ...rim("N1", c1));
  const drag2 = useDrag(svgRef, ...rim("N2", c2));
  const nudge1 = keyNudge((s) => set("N1", clamp(Math.round(N1 + s), 6, 200)));
  const nudge2 = keyNudge((s) => set("N2", clamp(Math.round(N2 + s), 6, 200)));
  const res = (id) => output.results.find((r) => r.id === id);
  const n2 = res("n2"), T2 = res("T2"), P = res("P");

  const svg = (
    <>
      <g transform={`translate(${c1} ${CY})`}>
        <g className="dg-spin" style={{ animationDuration: p1 ? `${p1}s` : "0s" }}>
          <path d={gearPath(r1, N1)} className="dg-gear is-driver" />
          <circle r={Math.max(8, r1 * 0.18)} className="dg-gear-hub" />
          <line x1="0" y1="0" x2="0" y2={-(r1 - 14)} className="dg-gear-mark" />
        </g>
      </g>
      {/* Offset by half a tooth so the teeth mesh. */}
      <g transform={`translate(${c2} ${CY}) rotate(${180 + 180 / clamp(Math.round(N2), 6, 90)})`}>
        <g className="dg-spin is-reverse" style={{ animationDuration: p2 ? `${clamp(p2, 0.6, 120)}s` : "0s" }}>
          <path d={gearPath(r2, N2)} className="dg-gear" />
          <circle r={Math.max(8, r2 * 0.18)} className="dg-gear-hub" />
          <line x1="0" y1="0" x2="0" y2={-(r2 - 14)} className="dg-gear-mark" />
        </g>
      </g>
      <g {...drag1} {...nudge1} aria-label="Driver teeth: drag the rim in or out" aria-valuenow={N1}>
        <circle cx={c1} cy={CY + r1 + 4} r="12" className="dg-handle" />
        <path d={`M${c1 - 5},${CY + r1 + 2} l5,-5 l5,5 M${c1 - 5},${CY + r1 + 6} l5,5 l5,-5`} className="dg-handle-glyph" />
      </g>
      <g {...drag2} {...nudge2} aria-label="Driven teeth: drag the rim in or out" aria-valuenow={N2}>
        <circle cx={c2} cy={CY + r2 + 4} r="12" className="dg-handle" />
        <path d={`M${c2 - 5},${CY + r2 + 2} l5,-5 l5,5 M${c2 - 5},${CY + r2 + 6} l5,5 l5,-5`} className="dg-handle-glyph" />
      </g>
      <path d={`M${c1 - r1 - 22},${CY + 20} A${r1 + 22},${r1 + 22} 0 0,1 ${c1 - 20},${CY - r1 - 21}`} className="dg-turn" />
      <path d={`M${c2 + r2 + 22},${CY + 20} A${r2 + 22},${r2 + 22} 0 0,0 ${c2 + 20},${CY - r2 - 21}`} className="dg-turn is-out" />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label={`Gear pair, ratio ${fmt(i, 3)} to 1`} minWidth={660}>
      <At x={14} y={14} anchor="tl">
        <div className="dg-stack is-row">
          {num("n1", "Input speed", "rotation")}
          {num("T1", "Input torque", "torque")}
        </div>
      </At>
      <At x={c1} y={CY} anchor="c">
        {num("N1", "Driver teeth", "none")}
      </At>
      <At x={c2} y={CY} anchor="c">
        {num("N2", "Driven teeth", "none")}
      </At>
      <At x={W - 14} y={14} anchor="tr">
        <div className="dg-stack">
          {n2 && <Badge strong label="Output speed">{show(n2.value, "rotation", unit("rotation"))}</Badge>}
          {T2 && <Badge strong label="Output torque">{show(T2.value, "torque", unit("torque"))}</Badge>}
        </div>
      </At>
      <At x={W / 2 - 40} y={H - 14} anchor="b">
        <div className="dg-stack is-row">
          <Badge label="Ratio">{fmt(i, 4)} : 1</Badge>
          {P && <Badge label="Power">{show(P.value, "power", unit("power"))}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}
