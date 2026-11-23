// Every chord FretFox uses, with fingers, and the strum patterns: the whole
// toolbox without having to open a song first.
import { useRef } from "react";
import { Play } from "lucide-react";
import { CHORDS, CHORD_GROUPS, TUNING, chordShape } from "../data/chords";
import { STRUM_LIBRARY, slotsPerBar } from "../data/strums";
import { createSynth } from "../../../lib/music/synth.js";
import ChordDiagram from "./ChordDiagram";

function useSynth() {
  const s = useRef(null);
  return () => (s.current ??= createSynth({ voice: "pluck", volume: 0.7 }));
}
const midisOf = shape => shape.frets.map((f, s) => (f >= 0 ? TUNING[s] + f : null)).filter(m => m != null);

export function ChordsTab() {
  const synth = useSynth();
  return (
    <section className="frx-chordlib">
      <p className="frx-intro">Tap a chord to hear it. Dot colors are fingers: blue index, green middle, amber ring, pink pinky. On Easy, the barre chords swap for the shapes under Easy swaps.</p>
      {CHORD_GROUPS.map(g => (
        <div key={g.name}>
          <h2>{g.name}</h2>
          <div className="frx-chordgrid">
            {g.chords.map(name => (
              <ChordDiagram key={name} shape={chordShape(name)} name={name} onClick={() => {
                const s = synth();
                s.strum(midisOf(CHORDS[name]), s.now(), { down: true, dur: 1.6 });
              }} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function StrumsTab() {
  const synth = useSynth();
  const demo = p => {
    const s = synth();
    const chord = p.sig === "4/4" ? "G" : "Am";
    const shape = CHORDS[chord];
    const notes = midisOf(shape);
    const slot = 60 / 90 / 2;
    const t0 = s.now() + 0.1;
    const slots = slotsPerBar(p.sig);
    for (let bar = 0; bar < 2; bar++)
      for (let i = 0; i < slots; i++) {
        const t = t0 + (bar * slots + i) * slot;
        if (i % 2 === 0) s.click(t, i === 0);
        if (p.slots) {
          const m = p.slots[i];
          if (m !== ".") s.strum(m === "U" ? notes.slice(-4) : notes, t, { down: m === "D", dur: 0.5, vel: m === "U" ? 0.45 : 0.65 });
        } else {
          const want = p.pick[i];
          const midi = want === "B" ? notes[0] : TUNING[6 - want] + shape.frets[6 - want];
          s.playNote(midi, 0.6, t, 0.7);
        }
      }
  };
  return (
    <section className="frx-strumlib">
      <p className="frx-intro">Strum patterns are counted in eighth notes: "1 & 2 & 3 & 4 &". Down strums land on the numbers, ups on the "&". Keep your hand moving even where there's a gap.</p>
      <div className="frx-strumgrid">
        {STRUM_LIBRARY.map(p => {
          const slots = slotsPerBar(p.sig);
          return (
            <article key={p.id} className="frx-strumcard">
              <header>
                <h3>{p.name}</h3>
                <span>{p.sig}</span>
                <button type="button" className="frx-btn frx-btn-sm" onClick={() => demo(p)}>
                  <Play size={13} aria-hidden="true" /> Hear it
                </button>
              </header>
              <div className="frx-pattern" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
                {Array.from({ length: slots }, (_, i) => {
                  const mark = p.slots ? p.slots[i] : p.pick[i];
                  return (
                    <div key={i} className={`frx-slot ${mark === "." ? "is-rest" : ""}`}>
                      <b>{p.slots ? (mark === "D" ? "↓" : mark === "U" ? "↑" : "·") : mark === "B" ? "T" : mark}</b>
                      <small>{p.sig === "6/8" ? i + 1 : i % 2 ? "&" : i / 2 + 1}</small>
                    </div>
                  );
                })}
              </div>
              <p>{p.tip}</p>
              {p.pick && <p className="frx-small">T = thumb on the bass string. Numbers are strings: 1 is the thin high e, 6 the thick low E.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
