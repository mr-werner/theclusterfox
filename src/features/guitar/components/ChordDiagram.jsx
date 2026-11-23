// A classic chord box: strings up and down, frets across, colored and
// numbered dots for each finger, O for open and X for muted strings.
import { fingerColor } from "./colors";

export default function ChordDiagram({ shape, name, size = 120, onClick }) {
  if (!shape) return null;
  const played = shape.frets.filter(f => f > 0);
  const low = Math.min(...(played.length ? played : [1]));
  const high = Math.max(...(played.length ? played : [1]));
  const base = high > 4 ? low : 1;
  const W = 100;
  const H = 128;
  const left = 16;
  const right = 86;
  const top = 34;
  const rows = 4;
  const fretH = 20;
  const sx = s => left + ((right - left) * s) / 5;
  const fy = f => top + (f - base + 0.5) * fretH;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className="frx-diagram" onClick={onClick} style={{ width: size }} aria-label={`${name ?? shape.name} chord`}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        <text x={W / 2} y="12" className="frx-diagram-name">
          {name ?? shape.name}
        </text>
        {base === 1 ? <rect x={left} y={top - 3} width={right - left} height="3.5" fill="#efe6d6" /> : <text x={right + 4} y={top + 13} className="frx-diagram-base">{base}fr</text>}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={i} x1={left} x2={right} y1={top + i * fretH} y2={top + i * fretH} stroke="rgba(239,230,214,0.4)" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s} x1={sx(s)} x2={sx(s)} y1={top} y2={top + rows * fretH} stroke="rgba(239,230,214,0.6)" strokeWidth={1.4 - s * 0.12} />
        ))}
        {shape.barre && (
          <rect x={sx(shape.barre.from) - 6} y={fy(shape.barre.fret) - 6} width={sx(shape.barre.to) - sx(shape.barre.from) + 12} height="12" rx="6" fill={fingerColor(1)} />
        )}
        {shape.frets.map((f, s) =>
          f < 0 ? (
            <text key={s} x={sx(s)} y={top - 7} className="frx-diagram-mark">
              ×
            </text>
          ) : f === 0 ? (
            <circle key={s} cx={sx(s)} cy={top - 10} r="3.6" fill="none" stroke="#efe6d6" strokeWidth="1.4" />
          ) : (
            <g key={s}>
              <circle cx={sx(s)} cy={fy(f)} r="6.6" fill={fingerColor(shape.fingers[s])} />
              <text x={sx(s)} y={fy(f) + 3.4} className="frx-diagram-finger">
                {shape.fingers[s]}
              </text>
            </g>
          )
        )}
      </svg>
    </Tag>
  );
}
