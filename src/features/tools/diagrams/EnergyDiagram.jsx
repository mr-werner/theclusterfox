import { useRef } from "react";
import { Canvas, At, Num, Badge, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";
import { G } from "../model/units";

// A mass raised above the ground and moving sideways. Drag it up or down to
// change the height; the bars compare kinetic and potential energy.

const W = 860, H = 440;
const GROUND = 380, X = 260, MAX_UP = 270;

export default function EnergyDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const num = (key, label, dim) => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const h = Number.isFinite(v.h) ? v.h : 0;
  const top = Math.max(1, Math.abs(h) * 1.25, 10);
  const sy = (z) => GROUND - (clamp(z, 0, top) / top) * MAX_UP;
  const by = sy(h);
  const drag = useDrag(svgRef, ({ y }) => set("h", tidy(((GROUND - clamp(y, GROUND - MAX_UP, GROUND)) / MAX_UP) * top)), { field: "h" });
  const nudge = keyNudge((k) => set("h", tidy(Math.max(0, h + (k * top) / 100))));
  const res = (id) => output.results.find((r) => r.id === id);
  const KE = res("KE"), PE = res("PE"), vf = res("vf");
  const ke = KE?.value || 0, pe = Math.max(0, PE?.value || 0);
  const big = Math.max(ke, pe, 1);
  const arrow = 30 + 150 * clamp((v.v || 0) / Math.max(v.v || 0, Math.sqrt(2 * G * Math.max(h, 0)), 1), 0, 1);
  const BX = 620, BW = 200;

  const svg = (
    <>
      <line x1="40" x2="560" y1={GROUND} y2={GROUND} className="dg-ground" />
      {Array.from({ length: 13 }, (_, k) => (
        <line key={k} x1={50 + k * 40} y1={GROUND} x2={40 + k * 40} y2={GROUND + 12} className="dg-hatch" />
      ))}
      {/* Drop path */}
      {h > 0 && <line x1={X} x2={X} y1={by + 30} y2={GROUND} className="dg-leader" />}
      {/* Velocity arrow */}
      {v.v > 0 && (
        <g className="dg-velocity">
          <line x1={X + 40} x2={X + 40 + arrow} y1={by} y2={by} />
          <path d={`M${X + 40 + arrow - 12},${by - 9} l14,9 l-14,9 Z`} />
        </g>
      )}
      {/* The mass, draggable */}
      <g {...drag} {...nudge} aria-label="Height" aria-valuenow={h}>
        <rect x={X - 38} y={by - 30} width="76" height="60" rx="10" className="dg-mass" />
        <path d={`M${X - 16},${by - 8} h32 M${X - 16},${by} h32 M${X - 16},${by + 8} h32`} className="dg-mass-glyph" />
      </g>
      <DimLine x1={X - 110} y1={by} x2={X - 110} y2={GROUND} />
      {/* Energy bars */}
      <text x={BX} y="132" className="dg-axis-label">Kinetic</text>
      <rect x={BX} y="142" width={BW} height="22" rx="6" className="dg-bar-bg" />
      <rect x={BX} y="142" width={(BW * ke) / big} height="22" rx="6" className="dg-bar is-ke" />
      <text x={BX} y="200" className="dg-axis-label">Potential</text>
      <rect x={BX} y="210" width={BW} height="22" rx="6" className="dg-bar-bg" />
      <rect x={BX} y="210" width={(BW * pe) / big} height="22" rx="6" className="dg-bar is-pe" />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Mass at a height, moving sideways" minWidth={660}>
      <At x={X} y={by - 40} anchor="b">
        {num("m", "Mass", "mass")}
      </At>
      <At x={X + 50 + arrow} y={by} anchor="l">
        {num("v", "Speed", "velocity")}
      </At>
      <At x={X - 110} y={(by + GROUND) / 2} anchor="c">
        {num("h", "Height", "length")}
      </At>
      <At x={BX} y={100} anchor="bl">
        <div className="dg-stack is-row">
          {KE && <Badge strong label="Kinetic energy">{show(KE.value, "energy", unit("energy"))}</Badge>}
          {PE && <Badge label="Potential energy">{show(PE.value, "energy", unit("energy"))}</Badge>}
        </div>
      </At>
      <At x={BX} y={270} anchor="tl">
        {vf && h > 0 && <Badge label="Speed after the drop">{show(vf.value, "velocity", unit("velocity"))}</Badge>}
      </At>
    </Canvas>
  );
}
