// Sheet music and tab together, scrolling under a fixed playhead: chord
// names on top, standard notation (guitar treble clef, sounding an octave
// lower than written), six-line tab, and the strum row with its count
// ("1 & 2 &") so you can see and follow the strum pattern.
import { useEffect, useMemo, useRef } from "react";
import { fingerColor } from "./colors";

const PPB = 64; // pixels per beat
const LETTER_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C C# D D# E F F# G G# A A# B
const SHARP = new Set([1, 3, 6, 8, 10]);

function staffStep(midi) {
  const written = midi + 12;
  const octave = Math.floor(written / 12) - 1;
  return octave * 7 + LETTER_STEP[written % 12] - (4 * 7 + 2); // 0 = E4, the bottom line
}

export default function ScoreStrip({ timeline, player, staff: staffPref = true, onSeek }) {
  const group = useRef(null);
  const wrap = useRef(null);
  const head = useRef(140);
  const startX = 30;
  const { events, bars, start, end, barLen, sig } = timeline;
  // Notation only when there are single notes to write (strums use chord names and arrows).
  const staff = staffPref && events.some(e => e.kind !== "strum");
  const width = startX + (end - start) * PPB + 400;

  const rows = useMemo(() => {
    const chordY = 16;
    const staffTop = 40;
    const staffGap = 8;
    const tabTop = staff ? staffTop + staffGap * 4 + 52 : 36;
    const tabGap = 12;
    const strumY = tabTop + tabGap * 5 + 26;
    return { chordY, staffTop, staffGap, tabTop, tabGap, strumY, height: strumY + 26 };
  }, [staff]);

  useEffect(() => {
    const measure = () => {
      head.current = Math.min(180, (wrap.current?.clientWidth ?? 400) * 0.28);
    };
    measure();
    window.addEventListener("resize", measure);
    const unsub = player.subscribe(beat => {
      if (group.current) group.current.setAttribute("transform", `translate(${head.current - startX - (beat - start) * PPB} 0)`);
    });
    return () => {
      unsub();
      window.removeEventListener("resize", measure);
    };
  }, [player, start]);

  const xOf = t => startX + (t - start) * PPB;
  const { chordY, staffTop, staffGap, tabTop, tabGap, strumY, height } = rows;
  const stringY = s => tabTop + tabGap * (5 - s);
  const lineY = step => staffTop + staffGap * 4 - (step * staffGap) / 2;
  const slotLen = 0.5;

  // Chord names where they change.
  const chordMarks = [];
  for (const bar of bars) for (const c of bar.chords) if (!chordMarks.length || chordMarks[chordMarks.length - 1].name !== c.name || c.beat === bar.start) chordMarks.push({ name: c.name, t: c.beat });

  const staffNotes = events.filter(e => e.kind !== "strum").flatMap(e => e.notes.map(n => ({ ...n, t: e.t, d: e.d, id: e.id })));

  return (
    <div
      className="frx-score"
      ref={wrap}
      onClick={e => {
        if (!onSeek) return;
        const r = wrap.current.getBoundingClientRect();
        const dx = e.clientX - r.left - head.current;
        onSeek(player.beatRef.current + dx / PPB);
      }}
    >
      <svg width="100%" height={height} role="img" aria-label="Notation and tab">
        <g ref={group}>
          {/* Bars */}
          {bars.map(b => (
            <g key={b.index}>
              <line x1={xOf(b.start) - 6} x2={xOf(b.start) - 6} y1={staff ? staffTop : tabTop} y2={stringY(0)} className="frx-bar" />
              <text x={xOf(b.start) - 2} y={(staff ? staffTop : tabTop) - 4} className="frx-barnum">
                {b.index + 1}
              </text>
            </g>
          ))}
          <line x1={xOf(end) - 6} x2={xOf(end) - 6} y1={staff ? staffTop : tabTop} y2={stringY(0)} className="frx-bar frx-bar-end" />
          {chordMarks.map((c, i) => (
            <text key={i} x={xOf(c.t)} y={chordY} className="frx-chordname">
              {c.name}
            </text>
          ))}

          {staff && (
            <g>
              {[0, 1, 2, 3, 4].map(i => (
                <line key={i} x1={0} x2={width} y1={staffTop + i * staffGap} y2={staffTop + i * staffGap} className="frx-staffline" />
              ))}
              {staffNotes.map((n, i) => {
                const step = staffStep(n.midi);
                const y = lineY(step);
                const x = xOf(n.t) + 6;
                const ledgers = [];
                for (let s = -2; s >= step; s -= 2) ledgers.push(lineY(s));
                for (let s = 10; s <= step; s += 2) ledgers.push(lineY(s));
                const hollow = n.d >= 2;
                const up = step < 4;
                return (
                  <g key={`${n.id}-${i}`}>
                    {ledgers.map(ly => (
                      <line key={ly} x1={x - 8} x2={x + 8} y1={ly} y2={ly} className="frx-staffline" />
                    ))}
                    {SHARP.has((n.midi + 12) % 12) && (
                      <text x={x - 15} y={y + 4} className="frx-acc">
                        ♯
                      </text>
                    )}
                    <ellipse cx={x} cy={y} rx="5.2" ry="4" transform={`rotate(-20 ${x} ${y})`} fill={hollow ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.4" className="frx-head" />
                    {n.d < 4 && <line x1={up ? x + 4.6 : x - 4.6} x2={up ? x + 4.6 : x - 4.6} y1={y} y2={up ? y - 26 : y + 26} stroke="currentColor" strokeWidth="1.2" className="frx-head" />}
                    {n.d <= 0.5 && <path d={up ? `M${x + 4.6} ${y - 26} q 7 6 5 14` : `M${x - 4.6} ${y + 26} q 7 -6 5 -14`} fill="none" stroke="currentColor" strokeWidth="1.4" className="frx-head" />}
                    {[0.75, 1.5, 3].includes(n.d) && <circle cx={x + 9} cy={y} r="1.6" fill="currentColor" className="frx-head" />}
                  </g>
                );
              })}
            </g>
          )}

          {/* Tab */}
          {[0, 1, 2, 3, 4, 5].map(s => (
            <line key={s} x1={0} x2={width} y1={stringY(s)} y2={stringY(s)} className="frx-tabline" />
          ))}
          <text x={4} y={tabTop + tabGap * 2.6} className="frx-tabclef">
            T
          </text>
          <text x={4} y={tabTop + tabGap * 3.6} className="frx-tabclef">
            A
          </text>
          <text x={4} y={tabTop + tabGap * 4.6} className="frx-tabclef">
            B
          </text>
          {events.map(e =>
            e.kind === "strum"
              ? null
              : e.notes.map(n => (
                  <g key={`${e.id}-${n.string}`}>
                    <rect x={xOf(e.t) - 1} y={stringY(n.string) - 7} width={n.fret > 9 ? 16 : 10} height="14" rx="3" className="frx-tabbg" />
                    <text x={xOf(e.t) + (n.fret > 9 ? 7 : 4)} y={stringY(n.string) + 4.5} className="frx-tabnum" style={{ fill: n.fret === 0 ? "#1a1210" : fingerColor(n.finger) }}>
                      {n.fret}
                    </text>
                  </g>
                ))
          )}
          {/* Strummed chords as stacked frets, the way tab writes them. */}
          {events
            .filter(e => e.kind === "strum")
            .map(e => (
              <g key={e.id}>
                {e.notes.map(n => (
                  <text key={n.string} x={xOf(e.t) + 4} y={stringY(n.string) + 4} className="frx-tabnum frx-tabnum-dim">
                    {n.fret}
                  </text>
                ))}
                <text x={xOf(e.t) + 4} y={strumY} className={`frx-arrow ${e.dir === "U" ? "is-up" : ""}`}>
                  {e.dir === "U" ? "↑" : "↓"}
                </text>
              </g>
            ))}
          {/* The count, so the strum pattern is followable. */}
          {Array.from({ length: Math.ceil((end - start) / slotLen) }, (_, i) => {
            const t = start + i * slotLen;
            const inBar = (((t % barLen) + barLen) % barLen) / slotLen;
            const label = sig === "6/8" ? String(Math.round(inBar) + 1) : inBar % 2 === 0 ? String(inBar / 2 + 1) : "&";
            return (
              <text key={i} x={xOf(t) + 4} y={strumY + 17} className={`frx-count ${label === "&" ? "is-and" : ""}`}>
                {label}
              </text>
            );
          })}
        </g>
      </svg>
      <div className="frx-playhead" style={{ left: "min(180px, 28%)" }} aria-hidden="true" />
    </div>
  );
}
