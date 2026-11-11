import { useRef } from "react";
import { Canvas, At, Num, Pills, Pick, Badge, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";
import { fmt } from "../model/units";

// A bar fixed to a wall and pulled (or pushed) at the free end. The bar stretches
// on the drawing, its colour heats up toward yield, and a stress–strain curve
// shows where it sits.

const W = 900, H = 420;
const X0 = 120, LEN = 400, CY = 190, ROD = 30;

export default function AxialDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const svgRef = useRef(null);
  const Fy = (v.Sy || 1) * (v.A || 1);
  const ratio = Math.abs(v.F) / Fy;
  const tension = !(v.F < 0);
  const strain = v.E > 0 && v.A > 0 ? v.F / v.A / v.E : 0;
  const ey = v.E > 0 ? v.Sy / v.E : 1;
  // Stretch is exaggerated: reaching yield moves the end 46 px.
  const stretch = clamp((strain / (ey || 1)) * 46, -70, 90);
  const X1 = X0 + LEN + stretch;
  const arrow = 34 + 110 * clamp(ratio, 0, 1.6) / 1.6;
  // The arrow starts past the furthest the bar can stretch, so dragging doesn't fight the stretch.
  const BASE = X0 + LEN + 96;
  const tip = BASE + arrow;
  const drag = useDrag(svgRef, ({ x }) => set("F", (tension ? 1 : -1) * tidy((clamp(x - 14 - BASE - 34, 0, 110) / 110) * 1.6 * Fy)), { field: "F" });
  const nudge = keyNudge((k) => set("F", tidy(v.F + (tension ? 1 : -1) * k * Fy * 0.02)));
  const hue = 170 - 170 * clamp(ratio, 0, 1);
  const rodColor = ratio > 1 ? "#ff5a5a" : `hsl(${hue} 70% 58%)`;
  const num = (key, label, dim) => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const res = (id) => output.results.find((r) => r.id === id);
  const s = res("s"), dL = res("dL"), fos = res("fos");
  const mat = calc.inputs.find((i) => i.id === "mat");

  const svg = (
    <>
      {/* Wall */}
      <rect x={X0 - 22} y={CY - 70} width="22" height="140" className="dg-support" />
      {Array.from({ length: 8 }, (_, k) => (
        <line key={k} x1={X0 - 22} y1={CY - 64 + k * 17} x2={X0 - 34} y2={CY - 54 + k * 17} className="dg-hatch" />
      ))}
      {/* Original length, then the bar as loaded */}
      <rect x={X0} y={CY - ROD / 2} width={LEN} height={ROD} className="dg-ghost" />
      <rect x={X0} y={CY - ROD / 2} width={Math.max(20, X1 - X0)} height={ROD} rx="3" fill={rodColor} fillOpacity="0.85" className="dg-rod" />
      <line x1={X0 + LEN} x2={X0 + LEN} y1={CY - 34} y2={CY + 34} className="dg-leader" />
      {Math.abs(stretch) > 3 && <path d={`M${X0 + LEN},${CY - 40} H${X1}`} className="dg-stretch" />}
      {/* End plate and load arrow */}
      <rect x={X1} y={CY - 26} width="12" height="52" rx="2" className="dg-support" />
      <g className="dg-load">
        {tension ? (
          <>
            <line x1={X1 + 14} x2={tip - 12} y1={CY} y2={CY} />
            <path d={`M${tip - 14},${CY - 9} L${tip},${CY} L${tip - 14},${CY + 9} Z`} />
          </>
        ) : (
          <>
            <line x1={X1 + 26} x2={tip} y1={CY} y2={CY} />
            <path d={`M${X1 + 28},${CY - 9} L${X1 + 13},${CY} L${X1 + 28},${CY + 9} Z`} />
          </>
        )}
      </g>
      <g {...drag} {...nudge} aria-label="Axial force" aria-valuenow={v.F}>
        <circle cx={tip + 14} cy={CY} r="13" className="dg-handle" />
        <path d={`M${tip + 9},${CY} h10 M${tip + 9},${CY - 4} l-3,4 l3,4 M${tip + 19},${CY - 4} l3,4 l-3,4`} className="dg-handle-glyph" />
      </g>
      {/* Cross-section callout */}
      <circle cx={X0 + 90} cy={CY - 92} r="18" fill={rodColor} fillOpacity="0.5" className="dg-section-path" />
      <path d={`M${X0 + 90},${CY - 74} L${X0 + 90},${CY - ROD / 2}`} className="dg-leader" />
      <DimLine x1={X0} y1={CY + 70} x2={X0 + LEN} y2={CY + 70} />
      <StressStrain x={W - 250} y={H - 190} w={220} h={140} strain={Math.abs(strain)} ey={ey} ratio={ratio} color={rodColor} />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label={`Bar ${tension ? "in tension" : "in compression"}, stretched ${fmt(strain * 100, 3)}%`} minWidth={680}>
      <At x={14} y={14} anchor="tl">
        <Pills label="Load direction" value={tension ? "t" : "c"} onChange={(x) => (x === "t") !== tension && set("F", -v.F)} options={[{ value: "t", label: "Tension (pull)" }, { value: "c", label: "Compression (push)" }]} />
      </At>
      <At x={Math.min(tip, W - 120)} y={CY - 26} anchor="b">
        {num("F", "Force", "force")}
      </At>
      <At x={X0 + 116} y={CY - 92} anchor="l">
        {num("A", "Cross-section area", "smallArea")}
      </At>
      <At x={X0 + LEN / 2} y={CY + 70} anchor="c">
        {num("L", "Length", "length")}
      </At>
      <At x={X0 - 30} y={H - 16} anchor="bl">
        <Pick label="Material" options={mat.options} value={presetValue("mat")} onPick={(l) => pick("mat", l)} />
      </At>
      <At x={W - 14} y={14} anchor="tr">
        <div className="dg-stack is-row is-nowrap">
          {s && <Badge strong label="Stress">{show(Math.abs(s.value), "stress", unit("stress"))}</Badge>}
          {dL && <Badge label={tension ? "Stretch" : "Shortening"}>{show(Math.abs(dL.value), "smallLength", unit("smallLength"))}</Badge>}
          {fos && <Badge label="Safety factor">{fmt(fos.value, 3)}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}

/** Elastic–perfectly-plastic stress–strain curve with the current point on it. */
function StressStrain({ x, y, w, h, strain, ey, ratio, color }) {
  const maxE = 2.4 * ey;
  const px = (e) => x + (clamp(e, 0, maxE) / maxE) * w;
  const py = (r) => y + h - (clamp(r, 0, 1.2) / 1.2) * h;
  const r = Math.min(ratio, 1);
  const e = ratio > 1 ? Math.min(maxE, ey * (1 + (ratio - 1) * 3)) : strain;
  return (
    <g className="dg-ss">
      <rect x={x - 12} y={y - 26} width={w + 26} height={h + 50} rx="10" className="dg-ss-bg" />
      <text x={x} y={y - 8} className="dg-ss-title">
        Stress–strain
      </text>
      <line x1={x} x2={x} y1={y} y2={y + h} className="dg-ss-axis" />
      <line x1={x} x2={x + w} y1={y + h} y2={y + h} className="dg-ss-axis" />
      <path d={`M${px(0)},${py(0)} L${px(ey)},${py(1)} H${px(maxE)}`} className="dg-ss-curve" />
      <line x1={x} x2={x + w} y1={py(1)} y2={py(1)} className="dg-leader" />
      <text x={x + w} y={py(1) - 6} textAnchor="end" className="dg-ss-label">
        yield
      </text>
      <circle cx={px(e)} cy={py(r)} r="6" fill={color} stroke="#0f1312" strokeWidth="2" />
      <text x={x + w} y={y + h + 16} textAnchor="end" className="dg-ss-label">
        strain →
      </text>
    </g>
  );
}
