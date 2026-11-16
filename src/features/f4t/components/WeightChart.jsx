import { LBS_PER_KG, weightTrend } from "../model/body.js";
import { dayLabel } from "../model/planner.js";

const W = 640;
const H = 220;
const PAD = { l: 44, r: 14, t: 14, b: 26 };
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;

// Weigh-ins as dots, the smoothed trend as a line, and the goal dashed.
export default function WeightChart({ weights, goalLbs, unit }) {
  if (weights.length < 2) {
    return <p className="fp-chart-empty">Your chart appears after two weigh-ins.</p>;
  }
  const conv = v => (unit === "kg" ? v / LBS_PER_KG : v);
  const points = weightTrend(weights.slice(-120)).map(p => ({ ...p, lbs: conv(p.lbs), trend: conv(p.trend) }));
  const goal = goalLbs ? conv(goalLbs) : null;
  const values = points.flatMap(p => [p.lbs, p.trend]);
  const near = goal && Math.abs(goal - points.at(-1).trend) < (Math.max(...values) - Math.min(...values) + 4) * 2;
  if (near) values.push(goal);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x0 = dayNum(points[0].day);
  const x1 = Math.max(dayNum(points.at(-1).day), x0 + 1);
  const x = d => PAD.l + ((dayNum(d) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const step = Math.max(1, Math.round((hi - lo) / 4));
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const trendPath = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.trend).toFixed(1)}`).join(" ");
  const label = `Weight from ${dayLabel(points[0].day)} to ${dayLabel(points.at(-1).day)}: ${points[0].lbs.toFixed(1)} to ${points.at(-1).lbs.toFixed(1)} ${unit}, trend ${points.at(-1).trend.toFixed(1)}.`;

  return (
    <figure className="fp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="fp-chart-grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fp-chart-axis">{v}</text>
          </g>
        ))}
        {near && <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} className="fp-chart-goal" />}
        <path d={trendPath} className="fp-chart-trend" />
        {points.map(p => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.lbs)} r="3.2" className="fp-chart-dot" />
        ))}
        <text x={PAD.l} y={H - 6} className="fp-chart-axis">{dayLabel(points[0].day, { month: "short", day: "numeric" })}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fp-chart-axis">{dayLabel(points.at(-1).day, { month: "short", day: "numeric" })}</text>
      </svg>
      <figcaption>
        <span><i className="is-dot" /> Weigh-ins</span>
        <span><i className="is-trend" /> Trend</span>
        {near && <span><i className="is-goal" /> Goal</span>}
      </figcaption>
    </figure>
  );
}
