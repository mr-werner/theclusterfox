import { Canvas, At, Num, Badge } from "./kit";
import { show, clamp } from "./helpers";

// A motor turning a shaft. The shaft spins faster at higher speed, and the
// end view shows the smallest solid shaft that carries the torque.

const W = 860, H = 380;
const CY = 180;

export default function TorqueDiagram({ values: v, set, output, unit, setUnit }) {
  const num = (key, label, dim) => <Num label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;
  const res = (id) => output.results.find((r) => r.id === id);
  const T = res("T"), d = res("d");
  // One turn every 60/rpm seconds is too fast to see; show it slowed to a readable spin.
  const spin = v.n > 0 ? clamp(24 / v.n, 0.35, 12) : 0;
  const shaftR = 16;

  const svg = (
    <>
      {/* Motor */}
      <rect x="90" y={CY - 80} width="210" height="160" rx="22" className="dg-motor" />
      {Array.from({ length: 7 }, (_, k) => (
        <line key={k} x1={110 + k * 28} x2={110 + k * 28} y1={CY - 80} y2={CY + 80} className="dg-fin" />
      ))}
      <rect x="300" y={CY - 46} width="26" height="92" rx="6" className="dg-motor" />
      <rect x="120" y={CY + 80} width="150" height="18" rx="4" className="dg-support" />
      {/* Shaft with moving stripes */}
      <rect x="326" y={CY - shaftR} width="300" height={shaftR * 2} rx="4" className="dg-shaft" />
      <g clipPath="url(#dg-shaft-clip)">
        <line x1="326" x2="626" y1={CY} y2={CY} className="dg-shaft-stripes" style={{ animationDuration: spin ? `${spin}s` : "0s" }} />
      </g>
      <defs>
        <clipPath id="dg-shaft-clip">
          <rect x="326" y={CY - shaftR} width="300" height={shaftR * 2} />
        </clipPath>
      </defs>
      {/* Turning arrow around the shaft */}
      <path d={`M${600},${CY - 34} A14,34 0 1,1 ${600},${CY + 34}`} className="dg-turn" />
      <path d={`M${594},${CY + 30} l10,6 l-9,6`} className="dg-turn" />
      {/* End view: the minimum shaft diameter */}
      <g transform={`translate(${720} ${CY})`}>
        <circle r="44" className="dg-section-path" />
        <g className="dg-spin" style={{ animationDuration: spin ? `${spin}s` : "0s" }}>
          <line x1="0" y1="0" x2="0" y2="-40" className="dg-needle" />
        </g>
        <line x1="-44" x2="44" y1="64" y2="64" className="dg-leader" />
      </g>
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Motor driving a shaft" minWidth={640}>
      <At x={195} y={CY} anchor="c">
        {num("P", "Power", "power")}
      </At>
      <At x={476} y={CY - 66} anchor="c">
        {num("n", "Speed", "rotation")}
      </At>
      <At x={476} y={CY + 70} anchor="c">
        {T ? (
          <Badge strong label="Torque">
            {show(T.value, "torque", unit("torque"))}
          </Badge>
        ) : (
          <Badge label="Torque">—</Badge>
        )}
      </At>
      <At x={720} y={CY - 60} anchor="b">
        {d && <Badge label="Min. shaft diameter">{show(d.value, "smallLength", unit("smallLength"))}</Badge>}
      </At>
      <At x={720} y={CY + 76} anchor="t">
        {num("tau", "Allowable shear", "stress")}
      </At>
    </Canvas>
  );
}
