// Loops in bar terms. A loop is { a, b }: the first and last bar to repeat,
// as numbered on the sheet (bar 1 is the first full bar; a pickup bar is
// bar 0 and is never looped on its own).
import { barAt, barCount, barStart } from "./song.js";

/** The bar index (as barStart takes it) a beat falls in, kept inside the song. */
export function barIndexAt(song, beat) {
  const n = barCount(song);
  const i = barAt(song, Math.max(0, beat)) - (song.pickup ? 0 : 1);
  return Math.max(0, Math.min(n - 1, i));
}

/** The bar number people see for a bar index. */
export const barNumber = (song, index) => (song.pickup ? index : index + 1);

/** The highest bar number a loop can end on. */
export const lastBar = song => barNumber(song, barCount(song) - 1);

/** A loop covering every bar from one bar index to another, either way round. */
export function loopFromBars(song, i, j) {
  const lo = Math.max(1, barNumber(song, Math.min(i, j)));
  const hi = Math.max(lo, Math.min(lastBar(song), barNumber(song, Math.max(i, j))));
  return { a: lo, b: hi };
}

/** A loop covering every bar a drag between two beats touched. */
export const loopFromBeats = (song, from, to) => loopFromBars(song, barIndexAt(song, from), barIndexAt(song, to));

/** The loop's start and end in beats, for the engine. */
export function loopBeats(song, { a, b }) {
  const index = n => (song.pickup ? n : n - 1);
  return { a: barStart(song, index(a)), b: barStart(song, index(b) + 1) };
}
