// Open and barre chord shapes FretFox teaches. frets and fingers run from
// the low E string to the high e string; -1 is a string you don't play,
// 0 an open string. fingers: 1 index, 2 middle, 3 ring, 4 pinky.
// barre: { fret, from, to } when the index lies across several strings.
// easy: the shape to use instead on the Easy level (fewer, simpler fingers).

export const CHORDS = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], easy: "C" },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], easy: "D" },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 }, easy: "Fmaj7" },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 }, easy: "Bm7" },
  Bm7: { frets: [-1, 2, 0, 2, 0, 2], fingers: [0, 1, 0, 2, 0, 3] },
  "F#m": { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 2, from: 0, to: 5 }, easy: "F#m7" },
  "F#m7": { frets: [-1, -1, 4, 2, 2, 0], fingers: [0, 0, 3, 1, 2, 0] },
  Bb: { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, from: 1, to: 5 }, easy: "Bbmaj7" },
  Bbmaj7: { frets: [-1, 1, 3, 2, 3, -1], fingers: [0, 1, 3, 2, 4, 0] },
};

export const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];

/** The shape to play for a chord name at a level (easy swaps hard shapes). */
export function chordShape(name, level = "medium") {
  const c = CHORDS[name];
  if (!c) return null;
  if (level === "easy" && c.easy && CHORDS[c.easy]) return { name: c.easy, ...CHORDS[c.easy] };
  return { name, ...c };
}

/** The sounding notes of a shape, low string first: [{ string, fret, finger, midi }]. */
export function shapeNotes(shape, tuning = TUNING) {
  const out = [];
  shape.frets.forEach((fret, string) => {
    if (fret >= 0) out.push({ string, fret, finger: shape.fingers[string] ?? 0, midi: tuning[string] + fret });
  });
  return out;
}

/** Groups for the chord library page. */
export const CHORD_GROUPS = [
  { name: "First chords", chords: ["Em", "E", "Am", "A", "D", "G", "C"] },
  { name: "Minor and seventh", chords: ["Dm", "Em7", "Am7", "E7", "A7", "D7", "G7", "C7", "B7"] },
  { name: "Easy swaps", chords: ["Fmaj7", "Bm7", "F#m7", "Cmaj7", "Bbmaj7", "Dsus4"] },
  { name: "Barre chords", chords: ["F", "Bm", "F#m", "Bb"] },
];

const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const QUALITY = { "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7] };

/** Pitch classes of a chord name ("F#m7" -> [6, 9, 1, 4]), or null. */
export function chordPitchClasses(name) {
  const m = /^([A-G](?:#|b)?)(m7|maj7|m|7|sus4)?$/.exec(name ?? "");
  if (!m || !(m[1] in PC)) return null;
  return QUALITY[m[2] ?? ""].map(i => (PC[m[1]] + i) % 12);
}

/** Root pitch class of a chord name. */
export const chordRoot = name => PC[/^([A-G](?:#|b)?)/.exec(name ?? "")?.[1]] ?? null;
