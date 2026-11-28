import { memo, useMemo } from "react";
import { keySignature, layoutStaff } from "../model/notation";

// A grand staff that slides under a fixed playhead. The parent moves
// groupRef every frame; this component only re-renders when the visible
// window (win) changes, so long songs stay smooth.

const SP = 10; // one staff space in px
const TREBLE_BOTTOM = 92;
const BASS_BOTTOM = TREBLE_BOTTOM + 96;
export const SHEET_HEIGHT = BASS_BOTTOM + 52;
export const WINDOW_PX = 1400;
const yOf = (clef, pos) => (clef === "bass" ? BASS_BOTTOM : TREBLE_BOTTOM) - (pos * SP) / 2;
const ACC = { 1: "♯", "-1": "♭", 0: "♮" };

function Rest({ x, value, clef }) {
  const mid = yOf(clef, 4);
  if (value >= 4) return <rect x={x - 6} y={yOf(clef, 6)} width={12} height={5} className="ks-rest" />;
  if (value >= 2) return <rect x={x - 6} y={mid - 5} width={12} height={5} className="ks-rest" />;
  if (value >= 1)
    return <path d={`M${x - 2} ${mid - 14} l6 7 l-5 6 l5 6 c-5 -2 -8 1 -4 6`} className="ks-rest-line" />;
  const dots = value >= 0.5 ? 1 : 2;
  return (
    <g className="ks-rest">
      <path d={`M${x + 4} ${mid - 6} L${x - 1} ${mid + 10 + (dots - 1) * 6}`} className="ks-rest-line" />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} cx={x - 1 + i * -1.5} cy={mid - 5 + i * 7} r={2.6} />
      ))}
    </g>
  );
}

function Staff({ layout, clef, from, to, dim, fingers }) {
  const heads = layout.heads.filter(h => h.x >= from && h.x <= to);
  const stems = layout.stems.filter(s => s.x >= from && s.x <= to);
  const rests = layout.rests.filter(r => r.x >= from && r.x <= to);
  const ties = layout.ties.filter(t => t.x2 >= from && t.x1 <= to);
  const ledgers = layout.ledgers.filter(l => l.x >= from && l.x <= to);
  return (
    <g className={`ks-staff ks-staff--${clef}${dim ? " is-dim" : ""}`}>
      {ledgers.map((l, i) => (
        <line key={i} x1={l.x - 9} x2={l.x + 9} y1={yOf(clef, l.pos)} y2={yOf(clef, l.pos)} className="ks-ledger" />
      ))}
      {ties.map((t, i) => {
        const y = yOf(clef, t.pos) + (t.pos >= 4 ? -7 : 7);
        const bend = t.pos >= 4 ? -6 : 6;
        return <path key={i} d={`M${t.x1 + 6} ${y} Q${(t.x1 + t.x2) / 2} ${y + bend} ${t.x2 - 6} ${y}`} className="ks-tie" />;
      })}
      {stems.map((s, i) => {
        const x = s.up ? s.x + 5.2 : s.x - 5.2;
        const y1 = yOf(clef, s.from);
        const y2 = yOf(clef, s.to);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y1} y2={y2} className="ks-stem" />
            {Array.from({ length: s.flags }, (_, f) => {
              const y = y2 + (s.up ? f * 7 : -f * 7);
              const d = s.up ? `M${x} ${y} c2 6 9 8 7 17 c0 -6 -3 -9 -7 -11` : `M${x} ${y} c2 -6 9 -8 7 -17 c0 6 -3 9 -7 11`;
              return <path key={f} d={d} className="ks-flag" />;
            })}
          </g>
        );
      })}
      {heads.map(h => {
        const y = yOf(clef, h.pos);
        return (
          <g key={h.id} data-n={h.noteId} className="ks-head-g">
            <ellipse cx={h.x} cy={y} rx={6.2} ry={4.4} transform={`rotate(-22 ${h.x} ${y})`} className={h.filled ? "ks-head" : "ks-head is-open"} />
            {h.dot && <circle cx={h.x + 10} cy={h.pos % 2 === 0 ? y - 4 : y} r={1.8} className="ks-dot" />}
            {h.alter !== null && (
              <text x={h.x - 11} y={y + 5} className="ks-acc" textAnchor="middle">
                {ACC[h.alter]}
              </text>
            )}
            {fingers && h.finger && (
              <text x={h.x} y={clef === "treble" ? Math.min(y - 14, yOf(clef, 10)) : Math.max(y + 22, yOf(clef, -3))} className="ks-finger" textAnchor="middle">
                {h.finger}
              </text>
            )}
          </g>
        );
      })}
      {rests.map((r, i) => (
        <Rest key={i} x={r.x} value={r.value} clef={clef} />
      ))}
    </g>
  );
}

function SheetView({ song, hands, ppb, win, groupRef, playX, width, loop, drafting }) {
  const right = useMemo(() => layoutStaff(song, "R", { ppb }), [song, ppb]);
  const left = useMemo(() => layoutStaff(song, "L", { ppb }), [song, ppb]);
  const from = (win - 1) * WINDOW_PX - 40;
  const to = (win + 3) * WINDOW_PX;
  const total = right.width;
  const lines = clef => [0, 2, 4, 6, 8].map(p => <line key={`${clef}${p}`} x1={-ppb * 2} x2={total + ppb * 2} y1={yOf(clef, p)} y2={yOf(clef, p)} className="ks-line" />);
  const keySig = clef =>
    keySignature(song.key || 0, clef).map((k, i) => (
      <text key={i} x={56 + i * 9} y={yOf(clef, k.pos) + 5} className="ks-acc ks-acc--key" textAnchor="middle">
        {ACC[k.alter]}
      </text>
    ));
  const ts = song.timeSig;
  const fingers = song.notes.some(n => n.finger);

  return (
    <div className="ks-sheet" style={{ height: SHEET_HEIGHT }}>
      <svg className="ks-sheet-svg" width={width} height={SHEET_HEIGHT} aria-label={`Sheet music for ${song.title}`} role="img">
        <g ref={groupRef}>
          {loop && <rect x={loop.a * ppb} y={yOf("treble", 14)} width={(loop.b - loop.a) * ppb} height={yOf("bass", -6) - yOf("treble", 14)} className={`ks-sheet-loop${drafting ? " is-draft" : ""}`} />}
          {lines("treble")}
          {lines("bass")}
          {right.bars
            .filter(b => b.x >= from && b.x <= to)
            .map(b => (
              <g key={b.x}>
                <line x1={b.x} x2={b.x} y1={yOf("treble", 8)} y2={yOf("bass", 0)} className="ks-bar" />
                {b.number > 0 && (
                  <text x={b.x + 3} y={yOf("treble", 8) - 8} className="ks-barnum">
                    {b.number}
                  </text>
                )}
              </g>
            ))}
          <Staff layout={right} clef="treble" from={from} to={to} dim={hands === "L"} fingers={fingers} />
          <Staff layout={left} clef="bass" from={from} to={to} dim={hands === "R"} fingers={fingers} />
        </g>
        {/* Clefs and key stay put on the left, over a fade. */}
        <rect x={0} y={0} width={playX - 24} height={SHEET_HEIGHT} className="ks-sheet-fade" />
        <g className="ks-sheet-head">
          {[0, 2, 4, 6, 8].map(p => (
            <g key={p}>
              <line x1={8} x2={playX - 30} y1={yOf("treble", p)} y2={yOf("treble", p)} className="ks-line" />
              <line x1={8} x2={playX - 30} y1={yOf("bass", p)} y2={yOf("bass", p)} className="ks-line" />
            </g>
          ))}
          <line x1={8} x2={8} y1={yOf("treble", 8)} y2={yOf("bass", 0)} className="ks-bar ks-bar--thick" />
          <text x={14} y={yOf("treble", 2) + 13} className="ks-clef">𝄞</text>
          <text x={16} y={yOf("bass", 6) + 12} className="ks-clef ks-clef--bass">𝄢</text>
          {keySig("treble")}
          {keySig("bass")}
          <g className="ks-time">
            {[
              ["treble", 6],
              ["bass", 6],
            ].map(([clef]) => (
              <g key={clef}>
                <text x={62 + Math.abs(song.key || 0) * 9 + 6} y={yOf(clef, 6) + 7} textAnchor="middle">
                  {ts[0]}
                </text>
                <text x={62 + Math.abs(song.key || 0) * 9 + 6} y={yOf(clef, 2) + 7} textAnchor="middle">
                  {ts[1]}
                </text>
              </g>
            ))}
          </g>
        </g>
        <line x1={playX} x2={playX} y1={yOf("treble", 12)} y2={yOf("bass", -4)} className="ks-playhead" />
      </svg>
    </div>
  );
}

export default memo(SheetView);
