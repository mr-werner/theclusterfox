import { fmtNum } from "../engine/frac.js";
import { Tex } from "./Tex";

// Number line for inequality answers.
export function NumberLine({ data }) {
  const { ints } = data;
  const W = 640;
  const H = 70;
  const ends = ints.flatMap(I => [I.lo, I.hi]).filter(Number.isFinite);
  let lo = ends.length ? Math.min(...ends) : -5;
  let hi = ends.length ? Math.max(...ends) : 5;
  const span = Math.max(hi - lo, 4);
  lo -= span * 0.4;
  hi += span * 0.4;
  const sx = x => 20 + ((x - lo) / (hi - lo)) * (W - 40);
  const marks = [...new Set(ends)].sort((a, b) => a - b);
  return (
    <div className="mf-numline">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Number line">
        <line x1={10} x2={W - 10} y1={30} y2={30} className="mf-numline__axis" />
        <path d={`M${W - 10} 30 l-8 -5 v10 z`} className="mf-numline__arrow" />
        <path d="M10 30 l8 -5 v10 z" className="mf-numline__arrow" />
        {ints.map((I, i) => {
          const a = Number.isFinite(I.lo) ? sx(I.lo) : 14;
          const b = Number.isFinite(I.hi) ? sx(I.hi) : W - 14;
          return <line key={i} x1={a} x2={b} y1={30} y2={30} className="mf-numline__on" />;
        })}
        {ints.flatMap((I, i) =>
          [
            Number.isFinite(I.lo) ? { x: I.lo, closed: I.loIn, k: `l${i}` } : null,
            Number.isFinite(I.hi) && I.hi !== I.lo ? { x: I.hi, closed: I.hiIn, k: `h${i}` } : null,
          ]
            .filter(Boolean)
            .map(p => <circle key={p.k} cx={sx(p.x)} cy={30} r={6.5} className={p.closed ? "mf-numline__dot is-closed" : "mf-numline__dot"} />)
        )}
        {marks.map(m => (
          <text key={m} x={sx(m)} y={58} textAnchor="middle" className="mf-numline__label">
            {fmtNum(m, 5)}
          </text>
        ))}
      </svg>
      <p className="mf-muted mf-small">Filled dot: included. Open dot: not included.</p>
    </div>
  );
}

// Box plot plus dots for statistics.
export function BoxPlot({ stats }) {
  const { values, min, max, median, q1, q3, mean } = stats;
  const W = 640;
  const H = 120;
  const pad = (max - min || 1) * 0.08;
  const lo = min - pad;
  const hi = max + pad;
  const sx = x => 20 + ((x - lo) / (hi - lo)) * (W - 40);
  const counts = new Map();
  return (
    <div className="mf-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Box plot of the data">
        {q1 !== null && q3 !== null && (
          <g className="mf-box__plot">
            <line x1={sx(min)} x2={sx(q1)} y1={40} y2={40} />
            <line x1={sx(q3)} x2={sx(max)} y1={40} y2={40} />
            <line x1={sx(min)} x2={sx(min)} y1={30} y2={50} />
            <line x1={sx(max)} x2={sx(max)} y1={30} y2={50} />
            <rect x={sx(q1)} y={24} width={Math.max(1, sx(q3) - sx(q1))} height={32} rx={4} />
            <line x1={sx(median)} x2={sx(median)} y1={24} y2={56} className="mf-box__median" />
          </g>
        )}
        <line x1={sx(mean)} x2={sx(mean)} y1={14} y2={66} className="mf-box__mean" />
        {values.map((v, i) => {
          const c = counts.get(v) ?? 0;
          counts.set(v, c + 1);
          return <circle key={i} cx={sx(v)} cy={84 + c * 9} r={4} className="mf-box__dot" />;
        })}
        <text x={sx(min)} y={H - 4} textAnchor="middle" className="mf-numline__label">
          {fmtNum(min, 5)}
        </text>
        <text x={sx(max)} y={H - 4} textAnchor="middle" className="mf-numline__label">
          {fmtNum(max, 5)}
        </text>
      </svg>
      <p className="mf-muted mf-small">
        Box: middle half of the data (Q1 to Q3). Solid line: median. Dashed line: mean. Dots: each value.
      </p>
    </div>
  );
}

export function FactTable({ facts }) {
  return (
    <dl className="mf-facts">
      {facts.map(f => (
        <div key={f.label} className="mf-fact">
          <dt>{f.label}</dt>
          <dd>
            <Tex tex={f.tex} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
