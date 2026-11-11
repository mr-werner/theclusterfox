import { useRef } from "react";
import { Canvas, At, Num, Pick, Badge, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";
import { fmt } from "../model/units";

const W = 860, H = 400;
const X0 = 250, X1 = 660, CY = 190;

export default function PipeDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const svgRef = useRef(null);
  const r = (id) => output.results.find((x) => x.id === id);
  const dp = r("dp"), vel = r("v"), re = r("Re"), regime = r("regime"), f = r("f");
  // Pipe drawn thicker for bigger pipes (log scale), flow animates faster for faster flow.
  const half = clamp(22 + 14 * Math.log10((v.D || 0.05) / 0.01), 14, 52);
  const speed = vel ? clamp(3.2 / Math.max(vel.value, 0.05), 0.25, 20) : 0;
  const num = (key, label, dim) => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const presetInput = (id) => calc.inputs.find((i) => i.id === id);
  // Drag the top of the pipe up or down to change the bore: 80 px of drag is ten times the size.
  const drag = useDrag(svgRef, ({ y }, g) => g && set("D", tidy(clamp(g.D * 10 ** ((g.y - y) / 80), 1e-3, 3))), {
    field: "D",
    onStart: (p) => ({ D: v.D > 0 ? v.D : 0.05, y: p.y }),
  });
  const nudge = keyNudge((k) => set("D", tidy(Math.max(1e-4, (v.D || 0.05) * (1 + 0.02 * k)))));
  const gaugeAngle = dp ? clamp(Math.log10(1 + dp.value / 1000) / 3, 0, 1) * 220 - 110 : -110;

  const svg = (
    <>
      <defs>
        <linearGradient id="dg-pipe" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6b7774" />
          <stop offset="0.45" stopColor="#3a4341" />
          <stop offset="1" stopColor="#262c2b" />
        </linearGradient>
      </defs>
      {/* Pipe wall and bore */}
      <rect x={X0} y={CY - half - 9} width={X1 - X0} height={2 * half + 18} rx="6" fill="url(#dg-pipe)" />
      <rect x={X0} y={CY - half} width={X1 - X0} height={2 * half} className="dg-bore" />
      {[-0.55, 0, 0.55].map((k) => (
        <line key={k} x1={X0 + 4} x2={X1 - 4} y1={CY + k * half} y2={CY + k * half} className="dg-flow" style={{ animationDuration: `${speed}s`, opacity: k === 0 ? 1 : 0.6 }} />
      ))}
      <ellipse cx={X1} cy={CY} rx="9" ry={half} className="dg-pipe-end" />
      <g {...drag} {...nudge} aria-label="Pipe inside diameter" aria-valuenow={v.D}>
        <circle cx={X1} cy={CY - half} r="12" className="dg-handle" />
        <path d={`M${X1 - 5},${CY - half - 2} l5,-5 l5,5 M${X1 - 5},${CY - half + 2} l5,5 l5,-5`} className="dg-handle-glyph" />
      </g>
      {/* Inlet arrow */}
      <path d={`M${X0 - 70},${CY} h52 m-12,-10 l12,10 l-12,10`} className="dg-arrow" />

      {/* Gauges */}
      <Gauge x={X0 + 40} y={CY - half - 62} angle={110} />
      <Gauge x={X1 - 40} y={CY - half - 62} angle={-gaugeAngle} />
      <line x1={X0 + 40} x2={X0 + 40} y1={CY - half - 36} y2={CY - half - 9} className="dg-stem" />
      <line x1={X1 - 40} x2={X1 - 40} y1={CY - half - 36} y2={CY - half - 9} className="dg-stem" />

      {/* Dimensions */}
      <DimLine x1={X0} y1={CY + half + 70} x2={X1} y2={CY + half + 70} />
      <DimLine x1={X1 + 46} y1={CY - half} x2={X1 + 46} y2={CY + half} />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Pipe with flow, size and pressure drop" minWidth={620}>
      <At x={10} y={CY} anchor="l">
        {num("Q", "Flow", "flow")}
      </At>
      <At x={10} y={CY + half + 30} anchor="tl">
        <Pick label="Fluid" options={presetInput("fluid").options} value={presetValue("fluid")} onPick={(l) => pick("fluid", l)} />
      </At>
      <At x={X1 + 64} y={CY} anchor="l">
        {num("D", "Inside diameter", "smallLength")}
      </At>
      <At x={X1 + 64} y={CY - half - 44} anchor="l">
        <Pick label="Steel pipe" options={presetInput("pipe").options} value={presetValue("pipe")} onPick={(l) => pick("pipe", l)} />
      </At>
      <At x={(X0 + X1) / 2} y={CY + half + 70} anchor="c">
        {num("L", "Length", "length")}
      </At>
      <At x={(X0 + X1) / 2} y={H - 10} anchor="b">
        <Pick label="Pipe material" options={presetInput("mat").options} value={presetValue("mat")} onPick={(l) => pick("mat", l)} />
      </At>
      <At x={(X0 + X1) / 2} y={CY - half - 62} anchor="c">
        {dp ? (
          <Badge strong label="Pressure drop">
            {show(dp.value, "pressure", unit("pressure"))}
          </Badge>
        ) : (
          <Badge label="Pressure drop">—</Badge>
        )}
      </At>
      <At x={(X0 + X1) / 2} y={CY + half + 26} anchor="c" className="dg-inline-stats">
        {vel && (
          <span className="dg-chip">
            {show(vel.value, "velocity", unit("velocity"))} · {regime?.text} · Re {fmt(re?.value, 3)} · f {fmt(f?.value, 3)}
          </span>
        )}
      </At>
    </Canvas>
  );
}

function Gauge({ x, y, angle }) {
  return (
    <g className="dg-gauge" transform={`translate(${x} ${y})`}>
      <circle r="26" />
      <path d="M-18,10 A20,20 0 1,1 18,10" className="dg-gauge-arc" />
      <line x1="0" y1="0" x2="0" y2="-18" transform={`rotate(${angle})`} className="dg-needle" />
      <circle r="3" className="dg-needle-hub" />
    </g>
  );
}
