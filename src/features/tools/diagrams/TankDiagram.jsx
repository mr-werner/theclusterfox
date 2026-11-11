import { useRef } from "react";
import { Canvas, At, Num, Pills, Badge, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";

const W = 720, H = 420;
const CX = 360, CY = 215;
const BOX_W = 380, BOX_H = 250;

export default function TankDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const { shape } = v;
  // Real width and height of the drawing, then fit them in the box with a sane aspect.
  const real = { hcyl: [v.L, v.D], vcyl: [v.D, v.H], rect: [v.L, v.H], sphere: [v.D, v.D] }[shape];
  const ratio = clamp(real[0] / real[1] || 1, 0.45, 2.8);
  const dw = Math.min(BOX_W, BOX_H * ratio);
  const dh = dw / ratio;
  const left = CX - dw / 2, top = CY - dh / 2, bottom = CY + dh / 2, right = CX + dw / 2;
  const height = real[1];
  const frac = clamp(v.h / height, 0, 1);
  const levelY = bottom - frac * dh;

  const drag = useDrag(svgRef, ({ y }) => set("h", tidy(clamp((bottom - y) / dh, 0, 1) * height)), { field: "h" });
  const nudge = keyNudge((s) => set("h", tidy(clamp(v.h + (s * height) / 100, 0, height))));
  const num = (key, label, dim = "length") => <Num field={key} label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;

  const outlineShape =
    shape === "sphere" ? (
      <ellipse cx={CX} cy={CY} rx={dw / 2} ry={dh / 2} />
    ) : shape === "hcyl" ? (
      <rect x={left} y={top} width={dw} height={dh} rx={Math.min(dh / 2, dw / 2)} />
    ) : (
      <rect x={left} y={top} width={dw} height={dh} rx={shape === "vcyl" ? 16 : 4} />
    );

  const pct = output.results.find((r) => r.id === "pct");
  const fill = output.results.find((r) => r.id === "fill");
  const total = output.results.find((r) => r.id === "total");

  const svg = (
    <>
      <defs>
        <clipPath id="dg-tank-clip">{outlineShape}</clipPath>
        <linearGradient id="dg-liquid" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--tf-cat)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--tf-cat)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <g clipPath="url(#dg-tank-clip)">
        <rect x={left - 10} y={levelY} width={dw + 20} height={bottom - levelY + 10} fill="url(#dg-liquid)" />
        <path d={`M${left},${levelY} q${dw / 8},-5 ${dw / 4},0 t${dw / 4},0 t${dw / 4},0 t${dw / 4},0`} className="dg-wave" />
      </g>
      <g className="dg-tank">{outlineShape}</g>
      {shape === "vcyl" && <ellipse cx={CX} cy={top + 2} rx={dw / 2} ry="9" className="dg-tank-top" />}
      {shape === "rect" && <path d={`M${left},${top} l26,-20 h${dw} l-26,20 M${right},${top} l26,-20 v${dh} l-26,20`} className="dg-tank-3d" />}
      {shape === "hcyl" && <ellipse cx={left + dh / 2 - 2} cy={CY} rx="10" ry={dh / 2} className="dg-tank-top" />}

      {/* Level handle */}
      <line x1={left - 20} x2={right + 30} y1={levelY} y2={levelY} className="dg-level" />
      <g {...drag} {...nudge} aria-label="Liquid level" aria-valuenow={v.h}>
        <rect x={right + 30} y={levelY - 13} width="26" height="26" rx="8" className="dg-handle" />
        <path d={`M${right + 37},${levelY - 3} l6,-6 l6,6 M${right + 37},${levelY + 3} l6,6 l6,-6`} className="dg-handle-glyph" />
      </g>

      {/* Dimensions */}
      <DimLine x1={left} y1={bottom + 34} x2={right} y2={bottom + 34} />
      {shape !== "sphere" && <DimLine x1={left - 44} y1={top} x2={left - 44} y2={bottom} />}
      <DimLine x1={right + 100} y1={levelY} x2={right + 100} y2={bottom} />
    </>
  );

  const widthField = shape === "hcyl" || shape === "rect" ? num("L", "Length") : num("D", "Diameter");
  const heightField = shape === "hcyl" ? num("D", "Diameter") : shape === "sphere" ? null : num("H", "Height");

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label={`Tank ${Math.round(frac * 100)}% full`}>
      <At x={14} y={14} anchor="tl">
        <Pills
          label="Tank shape"
          value={shape}
          onChange={(x) => set("shape", x)}
          options={[
            { value: "hcyl", label: "Horizontal" },
            { value: "vcyl", label: "Vertical" },
            { value: "rect", label: "Box" },
            { value: "sphere", label: "Sphere" },
          ]}
        />
      </At>
      <At x={CX} y={bottom + 34} anchor="c">
        {widthField}
      </At>
      {heightField && (
        <At x={left - 44} y={CY} anchor="c">
          {heightField}
        </At>
      )}
      {shape === "rect" && (
        <At x={right + 14} y={top - 26} anchor="bl">
          {num("W", "Width")}
        </At>
      )}
      <At x={Math.min(right + 100, W - 70)} y={clamp((levelY + bottom) / 2, top + 20, bottom)} anchor="c">
        {num("h", "Level")}
      </At>
      {pct && fill && (
        <At x={CX} y={clamp(levelY + 30, top + 30, bottom - 28)} anchor="c">
          <Badge strong label={`${Math.round(pct.value * 100)}% full`}>
            {show(fill.value, "volume", unit("volume"))}
          </Badge>
        </At>
      )}
      {total && (
        <At x={W - 14} y={14} anchor="tr">
          <Badge label="Capacity">{show(total.value, "volume", unit("volume"))}</Badge>
        </At>
      )}
    </Canvas>
  );
}
