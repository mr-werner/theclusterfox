import { useRef } from "react";
import { Canvas, At, Num, Badge, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";
import { fmt } from "../model/units";

const W = 720, H = 400;
const X0 = 110, Y0 = 320, MAX_RUN = 400, MAX_RISE = 250;

export default function SlopeDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const run = v.run > 0 ? v.run : 1;
  const rise = Number.isFinite(v.rise) ? Math.max(0, v.rise) : 0;
  const s = rise / run;
  const dRun = s * MAX_RUN > MAX_RISE ? MAX_RISE / s : MAX_RUN;
  const dRise = dRun * s;
  const X1 = X0 + dRun, Y1 = Y0 - dRise;
  // Dragging the top corner changes the rise; the run stays put.
  const drag = useDrag(svgRef, ({ y }) => set("rise", tidy(Math.max(0, ((Y0 - clamp(y, Y0 - MAX_RISE, Y0)) / dRun) * run))));
  const nudge = keyNudge((k) => set("rise", tidy(Math.max(0, rise + (k * run) / 100))));
  const num = (key, label) => <Num label={label} dim="length" value={v[key]} unit={unit("length")} onValue={(x) => set(key, x)} onUnit={(u) => setUnit("length", u)} />;
  const angle = Math.atan2(rise, run);
  const arcR = 54;
  const res = (id) => output.results.find((r) => r.id === id);
  const len = res("len");

  const svg = (
    <>
      <path d={`M${X0},${Y0} L${X1},${Y0} L${X1},${Y1} Z`} className="dg-slope" />
      <path d={`M${X1 - 16},${Y0} v-16 h16`} className="dg-right-angle" />
      <path d={`M${X0 + arcR},${Y0} A${arcR},${arcR} 0 0,0 ${X0 + arcR * Math.cos(angle)},${Y0 - arcR * Math.sin(angle)}`} className="dg-arc" />
      <DimLine x1={X0} y1={Y0 + 36} x2={X1} y2={Y0 + 36} />
      <DimLine x1={X1 + 40} y1={Y1} x2={X1 + 40} y2={Y0} />
      <g {...drag} {...nudge} aria-label="Rise" aria-valuenow={rise}>
        <circle cx={X1} cy={Y1} r="14" className="dg-handle" />
        <path d={`M${X1 - 5},${Y1 - 2} l5,-5 l5,5 M${X1 - 5},${Y1 + 2} l5,5 l5,-5`} className="dg-handle-glyph" />
      </g>
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Right triangle showing rise, run and angle">
      <At x={(X0 + X1) / 2} y={Y0 + 36} anchor="c">
        {num("run", "Run")}
      </At>
      <At x={X1 + 58} y={(Y0 + Y1) / 2} anchor="l">
        {num("rise", "Rise")}
      </At>
      <At x={X0 + arcR + 14} y={Y0 - 16} anchor="bl">
        <span className="dg-chip">{fmt((angle * 180) / Math.PI, 3)}°</span>
      </At>
      <At x={(X0 + X1) / 2 - 20} y={(Y0 + Y1) / 2 - 20} anchor="br">
        <Badge strong label="Grade">
          {fmt(s * 100, 3)}%
        </Badge>
      </At>
      <At x={14} y={14} anchor="tl">
        <div className="dg-stack is-row">
          <Badge label="Ratio">1 : {fmt(s > 0 ? 1 / s : Infinity, 3)}</Badge>
          <Badge label="Roof pitch">{fmt(s * 12, 3)} in 12</Badge>
          {len && <Badge label="Sloped length">{show(len.value, "length", unit("length"))}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}
