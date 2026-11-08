import { Canvas, At, Num, Pills, Badge, DimLine } from "./kit";
import { show } from "./helpers";

const W = 720, H = 460;
const CX = 340, CY = 240, BOX = 250;

export default function SectionDiagram({ values: v, set, output, unit, setUnit }) {
  const { shape } = v;
  const num = (key, label) => <Num label={label} dim="smallLength" value={v[key]} unit={unit("smallLength")} onValue={(x) => set(key, x)} onUnit={(u) => setUnit("smallLength", u)} />;
  const [rw, rh] = shape === "round" || shape === "tube" ? [v.D, v.D] : shape === "rhs" ? [v.B, v.H] : [v.b, v.h];
  const k = BOX / Math.max(rw || 1, rh || 1);
  const w = rw * k, h = rh * k;
  const L = CX - w / 2, T = CY - h / 2, R = CX + w / 2, B = CY + h / 2;
  const t = (x) => Math.max(1.5, (x || 0) * k);

  let body;
  if (shape === "rect") body = <rect x={L} y={T} width={w} height={h} />;
  if (shape === "round") body = <circle cx={CX} cy={CY} r={w / 2} />;
  if (shape === "tube") {
    const ri = Math.max(0, w / 2 - t(v.t));
    body = <path fillRule="evenodd" d={`M${CX - w / 2},${CY} a${w / 2},${w / 2} 0 1,0 ${w},0 a${w / 2},${w / 2} 0 1,0 ${-w},0 Z M${CX - ri},${CY} a${ri},${ri} 0 1,0 ${2 * ri},0 a${ri},${ri} 0 1,0 ${-2 * ri},0 Z`} />;
  }
  if (shape === "rhs") {
    const tt = t(v.t);
    body = <path fillRule="evenodd" d={`M${L},${T} h${w} v${h} h${-w} Z M${L + tt},${T + tt} v${h - 2 * tt} h${w - 2 * tt} v${-(h - 2 * tt)} Z`} />;
  }
  if (shape === "ibeam") {
    const tf = t(v.tf), tw = t(v.tw);
    body = <path d={`M${L},${T} h${w} v${tf} h${-(w - tw) / 2} v${h - 2 * tf} h${(w - tw) / 2} v${tf} h${-w} v${-tf} h${(w - tw) / 2} v${-(h - 2 * tf)} h${-(w - tw) / 2} Z`} />;
  }

  const res = (id) => output.results.find((r) => r.id === id);
  const Ix = res("Ix"), Sx = res("Sx"), A = res("A"), wt = res("wt");

  const svg = (
    <>
      <g className="dg-section">{body}</g>
      <line x1={L - 30} x2={R + 30} y1={CY} y2={CY} className="dg-axis" />
      <line x1={CX} x2={CX} y1={T - 30} y2={B + 30} className="dg-axis" />
      <text x={R + 36} y={CY + 4} className="dg-axis-label">x</text>
      <text x={CX + 6} y={T - 34} className="dg-axis-label">y</text>
      {/* Width below, height to the left */}
      <DimLine x1={L} y1={B + 52} x2={R} y2={B + 52} />
      {(shape === "rect" || shape === "rhs" || shape === "ibeam") && <DimLine x1={L - 52} y1={T} x2={L - 52} y2={B} />}
      {shape === "ibeam" && (
        <>
          <line x1={R} x2={R + 50} y1={T + t(v.tf)} y2={T + t(v.tf)} className="dg-leader" />
          <line x1={CX + t(v.tw) / 2} x2={R + 50} y1={CY + 50} y2={CY + 50} className="dg-leader" />
        </>
      )}
      {(shape === "tube" || shape === "rhs") && <line x1={shape === "tube" ? CX + w / 2 - t(v.t) / 2 : R - t(v.t) / 2} x2={R + 50} y1={shape === "tube" ? CY - 30 : CY - 60} y2={CY - 60} className="dg-leader" />}
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Cross-section with its dimensions">
      <At x={14} y={14} anchor="tl">
        <Pills
          label="Shape"
          value={shape}
          onChange={(x) => set("shape", x)}
          options={[
            { value: "rect", label: "Rectangle" },
            { value: "round", label: "Round" },
            { value: "tube", label: "Tube" },
            { value: "rhs", label: "Box tube" },
            { value: "ibeam", label: "I-beam" },
          ]}
        />
      </At>
      <At x={CX} y={B + 52} anchor="c">
        {shape === "round" || shape === "tube" ? num("D", "Diameter") : shape === "rhs" ? num("B", "Width") : num("b", "Width")}
      </At>
      {(shape === "rect" || shape === "ibeam") && (
        <At x={L - 52} y={CY} anchor="c">
          {num("h", "Height")}
        </At>
      )}
      {shape === "rhs" && (
        <At x={L - 52} y={CY} anchor="c">
          {num("H", "Height")}
        </At>
      )}
      {shape === "ibeam" && (
        <>
          <At x={R + 54} y={T + t(v.tf)} anchor="l">
            {num("tf", "Flange")}
          </At>
          <At x={R + 54} y={CY + 50} anchor="l">
            {num("tw", "Web")}
          </At>
        </>
      )}
      {(shape === "tube" || shape === "rhs") && (
        <At x={R + 54} y={CY - 60} anchor="l">
          {num("t", "Wall")}
        </At>
      )}
      <At x={W - 14} y={H - 14} anchor="br">
        <div className="dg-stack">
          {Ix && <Badge strong label="Iₓ">{show(Ix.value, "inertia", unit("inertia"))}</Badge>}
          {Sx && <Badge label="Sₓ">{show(Sx.value, "sectionModulus", unit("sectionModulus"))}</Badge>}
          {A && <Badge label="Area">{show(A.value, "smallArea", unit("smallArea"))}</Badge>}
          {wt && <Badge label="Weight">{show(wt.value, "linearMass", unit("linearMass"))}</Badge>}
        </div>
      </At>
    </Canvas>
  );
}
