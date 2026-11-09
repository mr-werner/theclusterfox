import { Canvas, At, Num, Badge, DimLine } from "./kit";
import { show, clamp } from "./helpers";
import { fmt } from "../model/units";

// A coil spring drawn to scale, unloaded on the left and under the load on the
// right. Only the free length is made up (a typical pitch); wire size, coil
// diameter and the deflection are true to scale.

const W = 860, H = 500;
const BASE = 450, MAX_H = 270;

function coil(cx, bottom, height, R, n, wire) {
  const turns = Math.max(1, n);
  const steps = Math.round(turns * 24);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * 2 * Math.PI;
    pts.push(`${(cx + R * Math.sin(a)).toFixed(1)},${(bottom - wire / 2 - t * (height - wire)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

export default function SpringDiagram({ values: v, set, output, unit, setUnit }) {
  const num = (key, label, dim) => <Num label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const res = (id) => output.results.find((r) => r.id === id);
  const k = res("k"), x = res("x"), tau = res("tau"), C = res("C");
  const d = v.d > 0 ? v.d : 0.002, Dm = v.Dm > 0 ? v.Dm : 0.016, Na = v.Na > 0 ? v.Na : 1;
  const free = (Na + 2) * (d + 0.35 * Dm);
  const solid = (Na + 2) * d;
  const defl = x ? x.value : 0;
  const scale = Math.min(150 / Dm, MAX_H / free);
  const R = (Dm / 2) * scale, wire = clamp(d * scale, 1.5, 30);
  const loadedH = Math.max(solid, free - Math.max(0, defl)) * scale;
  const freeH = free * scale;
  const bottomed = free - defl <= solid;
  const L1 = 220, L2 = 560;

  const svg = (
    <>
      <line x1="60" x2={W - 60} y1={BASE + 2} y2={BASE + 2} className="dg-ground" />
      {/* Free spring */}
      <path d={coil(L1, BASE, freeH, R, Na + 2, wire)} className="dg-coil is-free" style={{ strokeWidth: wire }} />
      <text x={L1} y={BASE + 30} textAnchor="middle" className="dg-axis-label">
        Unloaded
      </text>
      {/* Loaded spring */}
      <path d={coil(L2, BASE, loadedH, R, Na + 2, wire)} className={`dg-coil ${bottomed ? "is-solid" : ""}`} style={{ strokeWidth: wire }} />
      <rect x={L2 - R - 24} y={BASE - loadedH - 12} width={2 * R + 48} height="12" rx="3" className="dg-support" />
      <g className="dg-load">
        <line x1={L2} x2={L2} y1={BASE - loadedH - 90} y2={BASE - loadedH - 26} />
        <path d={`M${L2 - 9},${BASE - loadedH - 30} l9,16 l9,-16 Z`} />
      </g>
      <text x={L2} y={BASE + 30} textAnchor="middle" className="dg-axis-label">
        Under load
      </text>
      {/* Deflection between the two tops */}
      <line x1={L1 + R + 10} x2={L2 + R + 60} y1={BASE - freeH} y2={BASE - freeH} className="dg-leader" />
      <DimLine x1={L2 + R + 50} y1={BASE - freeH} x2={L2 + R + 50} y2={BASE - loadedH - 12} />
      {/* Coil diameter across the free spring */}
      <DimLine x1={L1 - R} y1={BASE - freeH - 36} x2={L1 + R} y2={BASE - freeH - 36} />
      {/* Wire leader */}
      <path d={`M${L1 + R},${BASE - freeH / 2} L${L1 + R + 60},${BASE - freeH / 2 + 30}`} className="dg-leader" />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Coil spring, unloaded and under load" minWidth={660}>
      <At x={L1} y={BASE - freeH - 36} anchor="c">
        {num("Dm", "Mean coil diameter", "smallLength")}
      </At>
      <At x={L1 + R + 64} y={BASE - freeH / 2 + 30} anchor="l">
        {num("d", "Wire diameter", "smallLength")}
      </At>
      <At x={L1 - R - 24} y={BASE - 40} anchor="r">
        {num("Na", "Active coils", "none")}
      </At>
      <At x={L2 + 16} y={BASE - loadedH - 74} anchor="l">
        {num("F", "Load", "force")}
      </At>
      <At x={L2 + R + 64} y={(2 * BASE - freeH - loadedH - 12) / 2} anchor="l">
        {x && <Badge label="Deflection">{show(x.value, "smallLength", unit("smallLength"))}</Badge>}
      </At>
      <At x={14} y={14} anchor="tl">
        <div className="dg-stack is-row is-nowrap">
          {k && <Badge strong label="Spring rate">{show(k.value, "springRate", unit("springRate"))}</Badge>}
          {tau && <Badge label="Shear stress">{show(tau.value, "stress", unit("stress"))}</Badge>}
          {C && <Badge label="Spring index D/d">{fmt(C.value, 3)}</Badge>}
        </div>
      </At>
      {bottomed && (
        <At x={L2} y={BASE - loadedH - 110} anchor="b">
          <span className="dg-chip is-warn">The spring would be fully squashed at this load</span>
        </At>
      )}
    </Canvas>
  );
}
