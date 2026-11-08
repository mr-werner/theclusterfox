import { useRef } from "react";
import { Canvas, At, Num, Pills, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp, tidy } from "./helpers";

const W = 820, H = 380;
const X0 = 110, X1 = 710, BY = 190;

export default function BeamDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const L = v.L > 0 ? v.L : 1;
  const xa = X0 + clamp(v.a / L, 0, 1) * (X1 - X0);
  const isPoint = v.load === "point";
  const vis = output.visual;
  const drag = useDrag(svgRef, ({ x }) => set("a", tidy(clamp((x - X0) / (X1 - X0), 0, 1) * L)));
  const nudge = keyNudge((s) => set("a", tidy(clamp(v.a + (s * L) / 100, 0, L))));

  // Deflected shape, exaggerated so the biggest sag is 46 px.
  let shape = null;
  let maxPt = null;
  if (vis?.pts) {
    const maxY = Math.max(...vis.pts.map((p) => Math.abs(p.y))) || 1;
    const sy = (y) => BY + (y / maxY) * 46;
    shape = vis.pts.map((p, i) => `${i ? "L" : "M"}${(X0 + (p.x / L) * (X1 - X0)).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
    maxPt = { x: X0 + (vis.xMaxY / L) * (X1 - X0), y: sy(vis.maxY) };
  }
  const num = (key, label, dim) => <Num label={label} dim={dim} value={v[key]} unit={unit(dim)} onValue={(x) => set(key, x)} onUnit={(u) => setUnit(dim, u)} />;

  const svg = (
    <>
      {/* Loads */}
      {isPoint ? (
        <g className="dg-load">
          <line x1={xa} x2={xa} y1={92} y2={BY - 14} />
          <path d={`M${xa - 8},${BY - 24} L${xa},${BY - 9} L${xa + 8},${BY - 24} Z`} />
          <circle cx={xa} cy={92} r="13" className="dg-handle" {...drag} {...nudge} aria-label="Load position" aria-valuenow={v.a} />
          <path d={`M${xa - 5},92 h10 M${xa - 5},88 l-4,4 l4,4 M${xa + 5},88 l4,4 l-4,4`} className="dg-handle-glyph" />
        </g>
      ) : (
        <g className="dg-load">
          <rect x={X0} y={112} width={X1 - X0} height="14" className="dg-udl" />
          {Array.from({ length: 13 }, (_, i) => {
            const x = X0 + ((X1 - X0) * i) / 12;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={126} y2={BY - 14} />
                <path d={`M${x - 6},${BY - 22} L${x},${BY - 9} L${x + 6},${BY - 22} Z`} />
              </g>
            );
          })}
        </g>
      )}

      {/* Beam and supports */}
      <rect x={X0} y={BY - 8} width={X1 - X0} height="16" rx="3" className="dg-beam" />
      {v.support === "ss" && (
        <>
          <path d={`M${X0},${BY + 8} l-16,26 h32 Z`} className="dg-support" />
          <circle cx={X1} cy={BY + 21} r="13" className="dg-support" />
          <line x1={X1 - 22} x2={X1 + 22} y1={BY + 36} y2={BY + 36} className="dg-ground" />
          <line x1={X0 - 22} x2={X0 + 22} y1={BY + 36} y2={BY + 36} className="dg-ground" />
        </>
      )}
      {(v.support === "cant" || v.support === "fixed") && <Wall x={X0} side={-1} />}
      {v.support === "fixed" && <Wall x={X1} side={1} />}

      {/* Deflected shape */}
      {shape && <path d={shape} className="dg-deflected" />}
      {maxPt && (
        <g className="dg-callout">
          <circle cx={maxPt.x} cy={maxPt.y} r="4" />
          <text x={maxPt.x} y={maxPt.y + 22} textAnchor="middle">
            δ max {show(Math.abs(vis.maxY), "smallLength", unit("smallLength"))}
          </text>
        </g>
      )}

      {/* Reactions */}
      {vis && (
        <g className="dg-reaction">
          <text x={X0} y={BY + 66} textAnchor="middle">
            R {show(vis.RA, "force", unit("force"))}
          </text>
          {v.support !== "cant" && (
            <text x={X1} y={BY + 66} textAnchor="middle">
              R {show(vis.RB, "force", unit("force"))}
            </text>
          )}
          {vis.MA ? (
            <text x={X0} y={BY + 84} textAnchor="middle">
              M {show(Math.abs(vis.MA), "moment", unit("moment"))}
            </text>
          ) : null}
        </g>
      )}

      {/* Dimensions */}
      {isPoint && v.a > 0 && <DimLine x1={X0} y1={300} x2={xa} y2={300} />}
      <DimLine x1={X0} y1={348} x2={X1} y2={348} />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Beam with its supports, load and deflected shape">
      <At x={14} y={14} anchor="tl">
        <Pills label="Supports" value={v.support} onChange={(x) => set("support", x)} options={[{ value: "ss", label: "Simply supported" }, { value: "cant", label: "Cantilever" }, { value: "fixed", label: "Fixed ends" }]} />
      </At>
      <At x={W - 14} y={14} anchor="tr">
        <Pills label="Load" value={v.load} onChange={(x) => set("load", x)} options={[{ value: "point", label: "Point load" }, { value: "udl", label: "Uniform" }]} />
      </At>
      {isPoint ? (
        <At x={clamp(xa, 150, W - 150)} y={74} anchor="b">
          {num("P", "Load", "force")}
        </At>
      ) : (
        <At x={(X0 + X1) / 2} y={102} anchor="b">
          {num("w", "Load per length", "linearLoad")}
        </At>
      )}
      {isPoint && (
        <At x={clamp((X0 + xa) / 2, 150, W - 150)} y={300} anchor="c">
          {num("a", "Distance", "length")}
        </At>
      )}
      <At x={(X0 + X1) / 2} y={348} anchor="c">
        {num("L", "Span", "length")}
      </At>
    </Canvas>
  );
}

function Wall({ x, side }) {
  const x0 = side < 0 ? x - 18 : x;
  return (
    <g className="dg-support">
      <rect x={x0} y={BY - 44} width="18" height="88" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={side < 0 ? x0 : x0 + 18} y1={BY - 40 + i * 16} x2={side < 0 ? x0 - 10 : x0 + 28} y2={BY - 30 + i * 16} className="dg-hatch" />
      ))}
    </g>
  );
}
