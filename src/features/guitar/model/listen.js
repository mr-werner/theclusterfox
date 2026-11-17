// Did you play it? Compares what the microphone or a MIDI guitar heard
// with what a timeline event asks for. Pure functions, easy to test.
import { notesPresent } from "../../../lib/music/pitch.js";
import { chordPitchClasses } from "../data/chords.js";

/** Pitch classes that stand out in a frame's chroma. */
export function strongPitchClasses(chroma, min = 0.4) {
  const out = new Set();
  if (!chroma) return out;
  for (let i = 0; i < 12; i++) if (chroma[i] >= min) out.add(i);
  return out;
}

/**
 * True when a heard frame matches the event.
 * frame: a mic frame from startMic, or { midis: [..] } from a MIDI guitar.
 */
export function frameMatches(event, frame) {
  if (!frame) return false;
  const want = event.notes.map(n => n.midi);
  if (frame.midis) {
    const heard = new Set(frame.midis.map(m => m % 12));
    const pcs = new Set(want.map(m => m % 12));
    let hit = 0;
    for (const pc of pcs) if (heard.has(pc)) hit++;
    return event.kind === "strum" ? hit >= Math.min(2, pcs.size) : hit >= Math.ceil(pcs.size * 0.6);
  }
  if ((frame.level ?? 0) < 0.006) return false;
  if (event.kind === "strum") {
    const pcs = chordPitchClasses(event.chord) ?? [...new Set(want.map(m => m % 12))];
    const strong = strongPitchClasses(frame.chroma);
    let hit = 0;
    for (const pc of pcs) if (strong.has(pc)) hit++;
    // An up strum only catches a few strings; a down strum should show most of the chord.
    return hit >= (event.dir === "U" ? 2 : Math.min(3, Math.ceil(pcs.length * 0.66)));
  }
  const heard = notesPresent(frame, want);
  return heard.size >= Math.ceil(want.length * 0.6);
}
