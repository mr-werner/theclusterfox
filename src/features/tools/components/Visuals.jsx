import Chart from "./Chart";
import BeamPlots from "./BeamPlots";
import ZoomPan from "./ZoomPan";
import { section, sectionOutline } from "../model/structures";
import { frictionFactor } from "../model/math";
import { fmt, defaultUnit } from "../model/units";

// Pictures that go with some calculators.

export default function Visual({ visual, system, unit = (dim) => defaultUnit(dim, system) }) {
  if (!visual) return null;
  switch (visual.type) {
    case "moody":
      return <Moody {...visual} />;
    case "line":
      return (
        <section className="tf-card tf-visual">
          <ZoomPan label="chart">
            <Chart
              series={[{ points: visual.points }]}
              x={{ ...visual.x, unit: defaultUnit(visual.x.dim, system) }}
              y={{ ...visual.y, unit: defaultUnit(visual.y.dim, system) }}
              marker={visual.marker}
            />
          </ZoomPan>
        </section>
      );
    case "beam":
      return <BeamPlots v={visual} unit={unit} />;
    case "section":
      return <Section v={visual} />;
    case "tank":
      return <Tank v={visual} />;
    case "resistor":
      return <Resistor v={visual} />;
    default:
      return null;
  }
}

const MOODY_RELS = [0, 1e-5, 1e-4, 5e-4, 1e-3, 5e-3, 0.01, 0.05];
const MOODY_COLORS = ["#5cc8ff", "#62d6c9", "#7be0a0", "#b6e06a", "#f5d25c", "#ffab5c", "#ff7f6b", "#ff6fa8"];

function Moody({ Re, f, rel }) {
  const series = MOODY_RELS.map((r, k) => {
    const pts = [];
    for (let e = Math.log10(4000); e <= 8; e += 0.05) pts.push({ x: 10 ** e, y: frictionFactor(10 ** e, r) });
    return { points: pts, color: MOODY_COLORS[k], label: r === 0 ? "Smooth" : `ε/D ${r}`, width: 1.6 };
  });
  series.push({ points: [600, 1000, 1500, 2300].map((x) => ({ x, y: 64 / x })), color: "#ffffff", label: "Laminar 64/Re", width: 1.6 });
  return (
    <section className="tf-card tf-visual">
      <h3 className="tf-visual-title">Moody chart · your pipe at ε/D = {fmt(rel, 3)}</h3>
      <ZoomPan label="Moody chart">
        <Chart series={series} x={{ label: "Reynolds number", min: 600, max: 1e8 }} y={{ label: "Friction factor f", min: 0.006, max: 0.1 }} logX logY marker={{ x: Re, y: f }} />
      </ZoomPan>
    </section>
  );
}

function Section({ v }) {
  const S = 220;
  return (
    <section className="tf-card tf-visual tf-centered">
      <svg viewBox={`0 0 ${S} ${S}`} className="tf-section" role="img" aria-label="Cross-section">
        <SectionShape shape={v.shape} dims={v.dims} cx={S / 2} cy={S / 2} size={S - 40} className="tf-section-body" axes={S / 2 - 8} />
      </svg>
    </section>
  );
}

/** A section outline drawn to scale, centered on its bounding box, with optional centroidal axes. */
export function SectionShape({ shape, dims, cx, cy, size, className, axes, minWall = 1.5 }) {
  const o = sectionOutline(shape, dims);
  if (!(o.w > 0 && o.h > 0)) return null;
  const k = size / Math.max(o.w, o.h);
  const X = (x) => cx + (x - o.w / 2) * k;
  const Y = (y) => cy - (y - o.h / 2) * k;
  let d = (o.polys || []).map((poly) => "M" + poly.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(" L") + " Z").join(" ");
  for (const c of o.circles || []) {
    const r = c.hole ? Math.min(c.r * k, Math.max(0, (o.w / 2) * k - minWall)) : c.r * k;
    if (r <= 0) continue;
    d += ` M${X(c.cx) - r},${Y(c.cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
  }
  const props = section(shape, dims);
  const gx = X(props?.xc ?? o.w / 2), gy = Y(props?.yc ?? o.h / 2);
  return (
    <g>
      <path d={d} fillRule="evenodd" className={className} />
      {axes && (
        <g className="tf-section-axes">
          <line x1={gx - axes} x2={gx + axes} y1={gy} y2={gy} className="tf-section-axis" />
          <line x1={gx} x2={gx} y1={gy - axes} y2={gy + axes} className="tf-section-axis" />
          <circle cx={gx} cy={gy} r="4" className="tf-centroid" />
          <text x={gx + axes - 2} y={gy - 6} textAnchor="end" className="tf-tick">x</text>
          <text x={gx + 6} y={gy - axes + 10} className="tf-tick">y</text>
        </g>
      )}
    </g>
  );
}

function Tank({ v }) {
  const { shape, frac } = v;
  const pct = Math.round(frac * 100);
  const W = 260, H = 170;
  const level = (top, bottom) => bottom - (bottom - top) * frac;
  let outline, clip;
  if (shape === "hcyl") {
    outline = <rect x="20" y="25" width="220" height="120" rx="60" />;
    clip = <rect x="20" y="25" width="220" height="120" rx="60" />;
  } else if (shape === "sphere") {
    outline = <circle cx="130" cy="85" r="70" />;
    clip = <circle cx="130" cy="85" r="70" />;
  } else if (shape === "vcyl") {
    outline = <rect x="80" y="10" width="100" height="150" rx="14" />;
    clip = <rect x="80" y="10" width="100" height="150" rx="14" />;
  } else {
    outline = <rect x="40" y="25" width="180" height="125" rx="4" />;
    clip = <rect x="40" y="25" width="180" height="125" rx="4" />;
  }
  const bounds = { hcyl: [25, 145], sphere: [15, 155], vcyl: [10, 160], rect: [25, 150] }[shape];
  const y = level(...bounds);
  return (
    <section className="tf-card tf-visual tf-centered">
      <svg viewBox={`0 0 ${W} ${H}`} className="tf-tank" role="img" aria-label={`Tank ${pct}% full`}>
        <defs>
          <clipPath id="tankclip">{clip}</clipPath>
        </defs>
        <rect x="0" y={y} width={W} height={H} clipPath="url(#tankclip)" className="tf-tank-liquid" />
        <g className="tf-tank-outline">{outline}</g>
        <text x={W / 2} y={Math.max(y - 8, 20)} textAnchor="middle" className="tf-tank-label">{pct}%</text>
      </svg>
    </section>
  );
}

function Resistor({ v }) {
  const { colors, names } = v;
  const xs = colors.length === 5 ? [86, 108, 130, 152, 196] : [92, 116, 140, 196];
  return (
    <section className="tf-card tf-visual tf-centered">
      <svg viewBox="0 0 300 90" className="tf-resistor" role="img" aria-label={`Bands: ${names.join(", ")}`}>
        <line x1="0" x2="300" y1="45" y2="45" className="tf-lead" />
        <path d="M60,22 Q60,14 72,14 L228,14 Q240,14 240,22 L240,68 Q240,76 228,76 L72,76 Q60,76 60,68 Z" className="tf-resistor-body" />
        {colors.map((c, i) => (
          <rect key={i} x={xs[i]} y="14" width="12" height="62" fill={c} />
        ))}
      </svg>
      <p className="tf-muted tf-small">{names.join(" · ")}</p>
    </section>
  );
}
