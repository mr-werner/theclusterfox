import { Canvas, At, Num, Pills, Badge, DimLine } from "./kit";
import { show } from "./helpers";
import { SectionShape } from "../components/Visuals";
import { sectionOutline } from "../model/structures";

const W = 760, H = 480;
const CX = 330, CY = 278, BOX = 220;

const SHAPES = [
  { value: "rect", label: "Rectangle" },
  { value: "round", label: "Round" },
  { value: "tube", label: "Tube" },
  { value: "rhs", label: "Box tube" },
  { value: "ibeam", label: "I-beam" },
  { value: "tee", label: "Tee" },
  { value: "channel", label: "Channel" },
  { value: "angle", label: "Angle" },
  { value: "triangle", label: "Triangle" },
  { value: "hex", label: "Hex bar" },
];

export default function SectionDiagram({ values: v, set, output, unit, setUnit }) {
  const { shape } = v;
  const num = (key, label) => <Num label={label} dim="smallLength" value={v[key]} unit={unit("smallLength")} onValue={(x) => set(key, x)} onUnit={(u) => setUnit("smallLength", u)} />;
  const o = sectionOutline(shape, v);
  const ok = o.w > 0 && o.h > 0;
  const k = ok ? BOX / Math.max(o.w, o.h) : 1;
  const w = ok ? o.w * k : BOX, h = ok ? o.h * k : BOX;
  const L = CX - w / 2, T = CY - h / 2, R = CX + w / 2, B = CY + h / 2;
  // Real (x, y) from the bottom-left of the shape → drawing.
  const X = (x) => L + x * k;
  const Y = (y) => B - y * k;
  const thick = (x) => Math.max(1.5, (x || 0) * k);

  const widthKey = { round: "D", tube: "D", rhs: "B", hex: null }[shape] ?? "b";
  const heightKey = { rhs: "H", hex: "s", round: null, tube: null }[shape] ?? (shape === "rect" || shape === "ibeam" || shape === "tee" || shape === "channel" || shape === "angle" || shape === "triangle" ? "h" : null);
  // Callouts on the right: [key, label, point on the shape (drawing coords), y of the label].
  const callouts = [];
  if (shape === "ibeam" || shape === "tee" || shape === "channel") {
    callouts.push(["tf", "Flange", [R, Y(v.h - v.tf / 2)], T + thick(v.tf) / 2 - 6]);
    const webX = shape === "channel" ? X(v.tw) : X(v.b / 2 + v.tw / 2);
    callouts.push(["tw", "Web", [webX, CY + 40], CY + 58]);
  }
  if (shape === "tube") callouts.push(["t", "Wall", [R - thick(v.t) / 2, CY], CY - 70]);
  if (shape === "rhs") callouts.push(["t", "Wall", [R - thick(v.t) / 2, CY - 50], CY - 70]);
  if (shape === "angle") callouts.push(["t", "Thickness", [R, Y(v.t / 2)], B - 30]);

  const res = (id) => output.results.find((r) => r.id === id);
  const Ix = res("Ix"), Sx = res("Sx"), A = res("A"), wt = res("wt"), Imin = res("Imin");

  const svg = (
    <>
      {ok && <SectionShape shape={shape} dims={v} cx={CX} cy={CY} size={BOX} className="dg-section-path" axes={w / 2 + 36} />}
      {widthKey && <DimLine x1={L} y1={B + 56} x2={R} y2={B + 56} />}
      {heightKey && <DimLine x1={L - 56} y1={T} x2={L - 56} y2={B} />}
      {shape === "hex" && (
        <>
          <line x1={L - 66} x2={X(o.w / 4)} y1={T} y2={T} className="dg-leader" />
          <line x1={L - 66} x2={X(o.w / 4)} y1={B} y2={B} className="dg-leader" />
        </>
      )}
      {callouts.map(([key, , [px, py], ly]) => (
        <path key={key} d={`M${px},${py} L${R + 30},${ly} H${R + 50}`} className="dg-leader" fill="none" />
      ))}
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Cross-section with its dimensions">
      <At x={14} y={14} anchor="tl">
        <div style={{ maxWidth: 520 }}>
          <Pills label="Shape" value={shape} onChange={(x) => set("shape", x)} options={SHAPES} />
        </div>
      </At>
      {widthKey && (
        <At x={CX} y={B + 56} anchor="c">
          {num(widthKey, shape === "round" || shape === "tube" ? "Diameter" : "Width")}
        </At>
      )}
      {heightKey && (
        <At x={L - 56} y={CY} anchor="c">
          {num(heightKey, shape === "hex" ? "Across flats" : "Height")}
        </At>
      )}
      {callouts.map(([key, label, , ly]) => (
        <At key={key} x={R + 54} y={ly} anchor="l">
          {num(key, label)}
        </At>
      ))}
      <At x={W - 14} y={H - 14} anchor="br">
        <div className="dg-stack">
          {Ix && <Badge strong label="Iₓ">{show(Ix.value, "inertia", unit("inertia"))}</Badge>}
          {Sx && <Badge label="Sₓ">{show(Sx.value, "sectionModulus", unit("sectionModulus"))}</Badge>}
          {Imin && <Badge label="I min (principal)">{show(Imin.value, "inertia", unit("inertia"))}</Badge>}
          {A && <Badge label="Area">{show(A.value, "smallArea", unit("smallArea"))}</Badge>}
          {wt && <Badge label="Weight">{show(wt.value, "linearMass", unit("linearMass"))}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}
