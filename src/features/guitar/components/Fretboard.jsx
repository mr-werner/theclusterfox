// A guitar neck seen from the front, high e on top like tab. Shows where
// each finger goes for what you are playing now (solid, numbered) and what
// comes next (outlined). Muted strings get an X, open strings an O.
import { STRING_NAMES } from "../data/chords";
import { fingerColor } from "./colors";

const MARKERS = [3, 5, 7, 9, 15];

export default function Fretboard({ now, next, lefty = false, frets: fretCount }) {
  const used = [...(now?.notes ?? []), ...(next?.notes ?? [])].map(n => n.fret);
  const maxUsed = Math.max(0, ...used);
  const frets = fretCount ?? (maxUsed > 12 ? 15 : maxUsed > 9 ? 12 : 9);
  const W = 640;
  const H = 150;
  const nut = 34;
  const right = W - 10;
  const top = 18;
  const bottom = H - 24;
  const fretX = f => nut + ((right - nut) * f) / frets;
  const rowY = s => top + ((bottom - top) * (5 - s)) / 5; // high e on top
  const noteX = f => (f === 0 ? nut - 15 : (fretX(f - 1) + fretX(f)) / 2);
  const flip = x => (lefty ? W - x : x);

  const shape = now?.shape;
  const nowNotes = now?.kind === "strum" && shape ? shapeAll(shape) : now?.notes ?? [];
  const nextNotes = next?.kind === "strum" && next.shape ? shapeAll(next.shape) : next?.notes ?? [];
  const muted = now?.kind === "strum" && shape ? shape.frets.map((f, s) => (f < 0 ? s : null)).filter(s => s != null) : [];

  return (
    <svg className="ff-neck" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(now)}>
      <defs>
        <linearGradient id="ff-wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a2418" />
          <stop offset="1" stopColor="#24150e" />
        </linearGradient>
      </defs>
      <rect x={flip(lefty ? right : nut)} y={top - 8} width={right - nut} height={bottom - top + 16} rx="4" fill="url(#ff-wood)" />
      {MARKERS.filter(m => m <= frets).map(m => (
        <circle key={m} cx={flip((fretX(m - 1) + fretX(m)) / 2)} cy={(top + bottom) / 2} r="5" fill="rgba(239,230,214,0.18)" />
      ))}
      {frets >= 12 && [2.5, 7.5].map(k => <circle key={k} cx={flip((fretX(11) + fretX(12)) / 2)} cy={top + ((bottom - top) * k) / 10} r="5" fill="rgba(239,230,214,0.18)" />)}
      {Array.from({ length: frets + 1 }, (_, f) => (
        <line key={f} x1={flip(fretX(f))} x2={flip(fretX(f))} y1={top - 8} y2={bottom + 8} stroke={f === 0 ? "#efe6d6" : "rgba(220,200,170,0.45)"} strokeWidth={f === 0 ? 5 : 1.6} />
      ))}
      {Array.from({ length: frets }, (_, f) => (
        <text key={f} x={flip((fretX(f) + fretX(f + 1)) / 2)} y={H - 6} className="ff-neck-num">
          {f + 1}
        </text>
      ))}
      {STRING_NAMES.map((name, s) => (
        <g key={name + s}>
          <line x1={flip(nut)} x2={flip(right)} y1={rowY(s)} y2={rowY(s)} stroke="#d9cbb2" strokeWidth={0.8 + (5 - s) * 0.32} opacity="0.8" />
          <text x={flip(8)} y={rowY(s) + 4} className="ff-neck-str">
            {name}
          </text>
        </g>
      ))}
      {shape?.barre && now?.kind === "strum" && (
        <rect
          x={flip(noteX(shape.barre.fret)) - 9}
          y={rowY(shape.barre.to) - 10}
          width="18"
          height={rowY(shape.barre.from) - rowY(shape.barre.to) + 20}
          rx="9"
          fill={fingerColor(1)}
          opacity="0.55"
        />
      )}
      {nextNotes.map(n => (
        <circle key={`n${n.string}-${n.fret}`} cx={flip(noteX(n.fret))} cy={rowY(n.string)} r="11" fill="none" stroke={fingerColor(n.finger)} strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
      ))}
      {muted.map(s => (
        <text key={`x${s}`} x={flip(nut - 15)} y={rowY(s) + 5} className="ff-neck-x">
          ×
        </text>
      ))}
      {nowNotes.map(n => (
        <g key={`c${n.string}-${n.fret}`}>
          {n.fret === 0 ? (
            <circle cx={flip(noteX(0))} cy={rowY(n.string)} r="9" fill="#1a1210" stroke={fingerColor(0)} strokeWidth="2.5" />
          ) : (
            <>
              <circle cx={flip(noteX(n.fret))} cy={rowY(n.string)} r="12" fill={fingerColor(n.finger)} />
              <text x={flip(noteX(n.fret))} y={rowY(n.string) + 5} className="ff-neck-finger">
                {n.finger}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function shapeAll(shape) {
  return shape.frets.map((fret, string) => ({ string, fret, finger: shape.fingers[string] })).filter(n => n.fret >= 0);
}

function describe(e) {
  if (!e) return "Guitar neck";
  if (e.kind === "strum") return `Chord ${e.chord}`;
  return e.notes.map(n => `${STRING_NAMES[n.string]} string fret ${n.fret}, finger ${n.finger || "open"}`).join("; ");
}
