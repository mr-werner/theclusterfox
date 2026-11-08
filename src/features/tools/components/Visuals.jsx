import Chart from "./Chart";
import { frictionFactor } from "../model/math";
import { fromSI, unitLabel, fmt, defaultUnit } from "../model/units";

// Pictures that go with some calculators.

export default function Visual({ visual, system }) {
  if (!visual) return null;
  switch (visual.type) {
    case "moody":
      return <Moody {...visual} />;
    case "line":
      return (
        <section className="tf-card tf-visual">
          <Chart
            series={[{ points: visual.points }]}
            x={{ ...visual.x, unit: defaultUnit(visual.x.dim, system) }}
            y={{ ...visual.y, unit: defaultUnit(visual.y.dim, system) }}
            marker={visual.marker}
          />
        </section>
      );
    case "beam":
      return <Beam v={visual} system={system} />;
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
      <Chart series={series} x={{ label: "Reynolds number", min: 600, max: 1e8 }} y={{ label: "Friction factor f", min: 0.006, max: 0.1 }} logX logY marker={{ x: Re, y: f }} />
    </section>
  );
}

function Beam({ v, system }) {
  const { pts, L, support, load, a } = v;
  const W = 640, H = 120, pad = 34;
  const sx = (x) => pad + (x / L) * (W - 2 * pad);
  const plot = (key, color, unitDim, label) => {
    const unit = defaultUnit(unitDim, system);
    const vals = pts.map((p) => fromSI(p[key], unitDim, unit));
    const max = Math.max(...vals.map(Math.abs)) || 1;
    const sy = (val) => H / 2 - (val / max) * (H / 2 - 24) * (key === "y" ? -1 : 1);
    const d = `M${sx(0)},${H / 2} ` + pts.map((p, i) => `L${sx(p.x).toFixed(1)},${sy(vals[i]).toFixed(1)}`).join(" ") + ` L${sx(L)},${H / 2} Z`;
    const iMax = vals.reduce((best, val, i) => (Math.abs(val) > Math.abs(vals[best]) ? i : best), 0);
    return (
      <div className="tf-beam-row">
        <span className="tf-beam-label">{label}</span>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} diagram`}>
          <line x1={sx(0)} x2={sx(L)} y1={H / 2} y2={H / 2} className="tf-axis" />
          <path d={d} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={sx(pts[iMax].x)} cy={sy(vals[iMax])} r="3.5" fill={color} />
          <text x={Math.min(Math.max(sx(pts[iMax].x), 60), W - 60)} y={sy(vals[iMax]) + (sy(vals[iMax]) < H / 2 ? -7 : 19)} textAnchor="middle" className="tf-beam-val">
            {fmt(Math.abs(vals[iMax]), 3)} {unitLabel(unitDim, unit)}
          </text>
        </svg>
      </div>
    );
  };
  const beamY = 46;
  return (
    <section className="tf-card tf-visual tf-beam">
      <svg viewBox={`0 0 ${W} 86`} className="tf-beam-sketch" role="img" aria-label="Beam and loading">
        <rect x={sx(0)} y={beamY - 5} width={sx(L) - sx(0)} height="10" rx="2" className="tf-beam-body" />
        {support === "cant" || support === "fixed" ? <Wall x={sx(0)} y={beamY} side={-1} /> : <Pin x={sx(0)} y={beamY + 5} />}
        {support === "fixed" ? <Wall x={sx(L)} y={beamY} side={1} /> : support === "ss" ? <Roller x={sx(L)} y={beamY + 5} /> : null}
        {load === "point" ? (
          <Arrow x={sx(a)} y={beamY - 6} />
        ) : (
          <g>
            <rect x={sx(0)} y={beamY - 30} width={sx(L) - sx(0)} height="10" className="tf-udl" />
            {Array.from({ length: 11 }, (_, i) => <Arrow key={i} x={sx((L * i) / 10)} y={beamY - 6} small />)}
          </g>
        )}
      </svg>
      {plot("V", "#5cc8ff", "force", "Shear")}
      {plot("M", "#c6a6ff", "moment", "Moment")}
      {plot("y", "#7be0c3", "smallLength", "Deflection")}
    </section>
  );
}

const Arrow = ({ x, y, small }) => (
  <g className="tf-load">
    <line x1={x} x2={x} y1={y - (small ? 24 : 36)} y2={y - 6} />
    <path d={`M${x - 5},${y - 9} L${x},${y} L${x + 5},${y - 9} Z`} />
  </g>
);
const Pin = ({ x, y }) => <path d={`M${x},${y} L${x - 10},${y + 16} L${x + 10},${y + 16} Z`} className="tf-support" />;
const Roller = ({ x, y }) => (
  <g className="tf-support">
    <circle cx={x} cy={y + 8} r="8" />
    <line x1={x - 14} x2={x + 14} y1={y + 18} y2={y + 18} />
  </g>
);
const Wall = ({ x, y, side }) => (
  <g className="tf-support">
    <rect x={side < 0 ? x - 10 : x} y={y - 26} width="10" height="52" />
  </g>
);

function Section({ v }) {
  const { shape, dims } = v;
  const S = 220;
  let w, h, body;
  if (shape === "round" || shape === "tube") w = h = dims.D;
  else if (shape === "rhs") (w = dims.B), (h = dims.H);
  else (w = dims.b), (h = dims.h);
  const k = (S - 40) / Math.max(w, h);
  const cx = S / 2, cy = S / 2;
  const W = w * k, Hh = h * k;
  if (shape === "rect") body = <rect x={cx - W / 2} y={cy - Hh / 2} width={W} height={Hh} />;
  if (shape === "round") body = <circle cx={cx} cy={cy} r={W / 2} />;
  if (shape === "tube") body = <path fillRule="evenodd" d={`M${cx - W / 2},${cy} a${W / 2},${W / 2} 0 1,0 ${W},0 a${W / 2},${W / 2} 0 1,0 ${-W},0 Z M${cx - W / 2 + dims.t * k},${cy} a${W / 2 - dims.t * k},${W / 2 - dims.t * k} 0 1,0 ${W - 2 * dims.t * k},0 a${W / 2 - dims.t * k},${W / 2 - dims.t * k} 0 1,0 ${-(W - 2 * dims.t * k)},0 Z`} />;
  if (shape === "rhs") {
    const t = dims.t * k;
    body = <path fillRule="evenodd" d={`M${cx - W / 2},${cy - Hh / 2} h${W} v${Hh} h${-W} Z M${cx - W / 2 + t},${cy - Hh / 2 + t} v${Hh - 2 * t} h${W - 2 * t} v${-(Hh - 2 * t)} Z`} />;
  }
  if (shape === "ibeam") {
    const tf = dims.tf * k, tw = dims.tw * k;
    body = <path d={`M${cx - W / 2},${cy - Hh / 2} h${W} v${tf} h${-(W - tw) / 2} v${Hh - 2 * tf} h${(W - tw) / 2} v${tf} h${-W} v${-tf} h${(W - tw) / 2} v${-(Hh - 2 * tf)} h${-(W - tw) / 2} Z`} />;
  }
  return (
    <section className="tf-card tf-visual tf-centered">
      <svg viewBox={`0 0 ${S} ${S}`} className="tf-section" role="img" aria-label="Cross-section">
        <g className="tf-section-body">{body}</g>
        <line x1="8" x2={S - 8} y1={cy} y2={cy} className="tf-section-axis" />
        <line y1="8" y2={S - 8} x1={cx} x2={cx} className="tf-section-axis" />
        <text x={S - 10} y={cy - 6} textAnchor="end" className="tf-tick">x</text>
        <text x={cx + 6} y="16" className="tf-tick">y</text>
      </svg>
    </section>
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
