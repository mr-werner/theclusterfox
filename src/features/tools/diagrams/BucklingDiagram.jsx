import { Canvas, At, Num, Pills, Pick, Badge, DimLine } from "./kit";
import { show } from "./helpers";
import { fmt } from "../model/units";

// A column with its end conditions and the shape it buckles into.

const W = 820, H = 510;
const CX = 330, TOP = 140, BOT = 440, AMP = 54;

/** Buckled shape for each end condition, s = 0 at the base, 1 at the top; peak magnitude 1. */
function mode(ends, s) {
  if (ends === "1") return Math.sin(Math.PI * s);
  if (ends === "2") return 1 - Math.cos((Math.PI * s) / 2);
  if (ends === "0.5") return (1 - Math.cos(2 * Math.PI * s)) / 2;
  // Fixed base, pinned top: βL = 4.4934.
  const b = 4.4934;
  return (Math.sin(b * s) - b * s - Math.tan(b) * (Math.cos(b * s) - 1)) / 3.86;
}

const ENDS = [
  { value: "1", label: "Pinned–pinned" },
  { value: "2", label: "Fixed–free" },
  { value: "0.7", label: "Fixed–pinned" },
  { value: "0.5", label: "Fixed–fixed" },
];

export default function BucklingDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const num = (key, label, dim) => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const fixedBase = v.ends !== "1";
  const top = { 1: "pin", 2: "free", "0.7": "pin", "0.5": "fixed" }[v.ends];
  const n = 60;
  let peak = 0;
  for (let i = 0; i <= n; i++) peak = Math.max(peak, Math.abs(mode(v.ends, i / n)));
  const path = Array.from({ length: n + 1 }, (_, i) => {
    const s = i / n;
    return `${i ? "L" : "M"}${(CX + (AMP * mode(v.ends, s)) / (peak || 1)).toFixed(1)},${(BOT - s * (BOT - TOP)).toFixed(1)}`;
  }).join(" ");
  const topX = CX + (AMP * mode(v.ends, 1)) / (peak || 1);
  const res = (id) => output.results.find((r) => r.id === id);
  const P = res("P"), s = res("s"), lam = res("lam"), Le = res("Le");
  const mat = calc.inputs.find((i) => i.id === "mat");

  const svg = (
    <>
      {/* Straight column, then the buckled shape */}
      <rect x={CX - 9} y={TOP} width="18" height={BOT - TOP} className="dg-ghost" />
      <path d={path} className="dg-column" />
      {/* Base */}
      {fixedBase ? (
        <g className="dg-support">
          <rect x={CX - 50} y={BOT} width="100" height="20" />
          {Array.from({ length: 7 }, (_, k) => (
            <line key={k} x1={CX - 46 + k * 15} y1={BOT + 20} x2={CX - 54 + k * 15} y2={BOT + 32} className="dg-hatch" />
          ))}
        </g>
      ) : (
        <g>
          <path d={`M${CX},${BOT} l-18,28 h36 Z`} className="dg-support" />
          <line x1={CX - 30} x2={CX + 30} y1={BOT + 30} y2={BOT + 30} className="dg-ground" />
        </g>
      )}
      {/* Top */}
      {top === "pin" && (
        <g>
          <path d={`M${CX},${TOP} l-14,-20 h28 Z`} className="dg-support" />
          <line x1={CX - 34} x2={CX - 34} y1={TOP - 40} y2={TOP + 30} className="dg-ground" />
          <line x1={CX + 34} x2={CX + 34} y1={TOP - 40} y2={TOP + 30} className="dg-ground" />
        </g>
      )}
      {top === "fixed" && (
        <g className="dg-support">
          <rect x={CX - 50} y={TOP - 20} width="100" height="20" />
          <line x1={CX - 34} x2={CX - 34} y1={TOP - 40} y2={TOP - 20} className="dg-ground" />
          <line x1={CX + 34} x2={CX + 34} y1={TOP - 40} y2={TOP - 20} className="dg-ground" />
        </g>
      )}
      {top === "free" && <rect x={topX - 16} y={TOP - 8} width="32" height="8" rx="2" className="dg-support" />}
      {/* Load */}
      <g className="dg-load">
        <line x1={top === "free" ? topX : CX} x2={top === "free" ? topX : CX} y1={TOP - 96} y2={TOP - (top === "free" ? 20 : 34)} />
        <path d={`M${(top === "free" ? topX : CX) - 9},${TOP - (top === "free" ? 30 : 44)} l9,14 l9,-14 Z`} />
      </g>
      <DimLine x1={CX + 120} y1={TOP} x2={CX + 120} y2={BOT} />
      {/* Cross-section callout */}
      <rect x={CX - 190} y={(TOP + BOT) / 2 - 20} width="40" height="40" rx="4" className="dg-section-path" />
      <path d={`M${CX - 150},${(TOP + BOT) / 2} H${CX - 12}`} className="dg-leader" />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Column with its end supports and buckled shape">
      <At x={14} y={14} anchor="tl">
        <Pills label="End conditions" value={v.ends} onChange={(x) => set("ends", x)} options={ENDS} />
      </At>
      <At x={CX + 138} y={(TOP + BOT) / 2} anchor="l">
        {num("L", "Column length", "length")}
      </At>
      <At x={CX - 196} y={(TOP + BOT) / 2 - 30} anchor="br">
        {num("I", "Least I", "inertia")}
      </At>
      <At x={CX - 196} y={(TOP + BOT) / 2 + 30} anchor="tr">
        {num("A", "Area", "smallArea")}
      </At>
      <At x={14} y={H - 14} anchor="bl">
        <Pick label="Material" options={mat.options} value={presetValue("mat")} onPick={(l) => pick("mat", l)} />
      </At>
      <At x={CX + 34} y={TOP - 70} anchor="l">
        {P ? (
          <Badge strong label="Buckles at">
            {show(P.value, "force", unit("force"))}
          </Badge>
        ) : (
          <Badge label="Buckles at">—</Badge>
        )}
      </At>
      <At x={W - 14} y={H - 14} anchor="br">
        <div className="dg-stack">
          <Badge label="K">{v.ends}</Badge>
          {Le && <Badge label="Effective length KL">{show(Le.value, "length", unit("length"))}</Badge>}
          {lam && <Badge label="Slenderness KL/r">{fmt(lam.value, 3)}</Badge>}
          {s && <Badge label="Critical stress">{show(s.value, "stress", unit("stress"))}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}
