// Note names, numbers and frequencies shared by the music apps.
// MIDI note numbers throughout: 60 is middle C (C4), 69 is A4 = 440 Hz.

const SHARPS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLATS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

/** "C4", "F♯3"; flats: true spells black keys with ♭. */
export function noteName(midi, { octave = true, flats = false } = {}) {
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const name = (flats ? FLATS : SHARPS)[pc];
  return octave ? `${name}${Math.floor(m / 12) - 1}` : name;
}

/** The pitch class, 0 = C ... 11 = B. */
export const pitchClass = midi => ((Math.round(midi) % 12) + 12) % 12;

export const isBlack = midi => BLACK.has(pitchClass(midi));

export const midiToFreq = midi => 440 * 2 ** ((midi - 69) / 12);

/** Nearest MIDI number (fractional when round is false) for a frequency in Hz. */
export function freqToMidi(freq, round = true) {
  if (!(freq > 0)) return null;
  const m = 69 + 12 * Math.log2(freq / 440);
  return round ? Math.round(m) : m;
}

/** Cents a frequency sits away from the nearest note (−50 … +50). */
export function centsOff(freq) {
  const m = freqToMidi(freq, false);
  return m == null ? null : Math.round((m - Math.round(m)) * 100);
}

/** Parse "C4", "F#3", "Bb2", "c♯5" into a MIDI number, or null. */
export function parseNote(text) {
  const m = /^\s*([A-Ga-g])\s*([#♯b♭]*)\s*(-?\d+)\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  let acc = 0;
  for (const ch of m[2]) acc += ch === "#" || ch === "♯" ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/** Piano range: A0 (21) to C8 (108). */
export const PIANO_LOW = 21;
export const PIANO_HIGH = 108;
