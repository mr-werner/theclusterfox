// Piano keyboard geometry shared by the falling notes and the keys.
import { isBlack } from "../../../lib/music/theory.js";

/** Key rectangles for midi lo..hi across width w: Map midi -> { x, w, black }. */
export function keyLayout(lo, hi, width) {
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const ww = width / whites.length;
  const bw = ww * 0.6;
  const keys = new Map();
  let wi = 0;
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) keys.set(m, { x: wi * ww - bw / 2, w: bw, black: true });
    else keys.set(m, { x: wi++ * ww, w: ww, black: false });
  }
  return { keys, ww, bw, whites: whites.length };
}

/** Which key is under x, y (y as a share of key height, black keys cover the top 62%). */
export function keyAt(layout, x, yShare) {
  if (yShare < 0.62) {
    for (const [m, k] of layout.keys) if (k.black && x >= k.x && x < k.x + k.w) return m;
  }
  for (const [m, k] of layout.keys) if (!k.black && x >= k.x && x < k.x + k.w) return m;
  return null;
}

// Computer keys: a row of white keys on A S D F G H J K L ; and black keys above.
const ROW = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17 };
/** MIDI for a computer key with the row starting at `base` (a C), or null. */
export const computerKey = (key, base = 60) => (key in ROW ? base + ROW[key] : null);
export const COMPUTER_LABELS = Object.fromEntries(Object.entries(ROW).map(([k, v]) => [v, k.toUpperCase()]));
