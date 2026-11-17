// Sheet music layout for KeysFox. Notes are spaced by time (one beat is
// always the same width), so the sheet lines up with the falling notes and
// slides under a fixed playhead. Treble staff for the right hand, bass staff
// for the left. Positions are in half staff-spaces from the bottom line.
import { barBeats, barStart, barCount, songBeats } from "./song.js";

const SHARP_SPELL = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const FLAT_SPELL = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/** Letter alterations the key signature gives: letter index -> −1 / 0 / +1. */
export function keyAlters(fifths = 0) {
  const alt = [0, 0, 0, 0, 0, 0, 0];
  if (fifths > 0) for (const l of SHARP_ORDER.slice(0, fifths)) alt[l] = 1;
  if (fifths < 0) for (const l of FLAT_ORDER.slice(0, -fifths)) alt[l] = -1;
  return alt;
}

/** Key signature symbols to draw: [{ letter, alter, pos }] for a clef. */
export function keySignature(fifths, clef) {
  const trebleSharps = [8, 5, 9, 6, 3, 7, 4];
  const trebleFlats = [4, 7, 3, 6, 2, 5, 1];
  const list = fifths > 0 ? trebleSharps.slice(0, fifths) : trebleFlats.slice(0, -fifths);
  return list.map(pos => ({ alter: fifths > 0 ? 1 : -1, pos: clef === "bass" ? pos - 2 : pos }));
}

/** Spell a note in a key: { letter, octave, alter, diatonic }. */
export function spell(midi, fifths = 0) {
  const pc = ((midi % 12) + 12) % 12;
  const [letter, alter] = (fifths < 0 ? FLAT_SPELL : SHARP_SPELL)[pc];
  const octave = Math.floor(midi / 12) - 1;
  return { letter, octave, alter, diatonic: octave * 7 + letter };
}

// Bottom-line diatonic number: E4 for treble, G2 for bass.
const BOTTOM = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };
export const staffPos = (diatonic, clef) => diatonic - BOTTOM[clef];

const VALUES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
/** Split a length into written note values (greedy), e.g. 2.5 -> [2, 0.5]. */
export function splitValue(len) {
  const out = [];
  let left = Math.round(len * 1000) / 1000;
  while (left > 0.06) {
    const v = VALUES.find(x => x <= left + 1e-6) ?? left;
    out.push(v);
    left = Math.round((left - v) * 1000) / 1000;
  }
  return out.length ? out : [0.125];
}
const REST_VALUES = [4, 2, 1, 0.5, 0.25];

const glyphOf = v => {
  const dot = [3, 1.5, 0.75, 0.375].includes(v);
  const base = dot ? v / 1.5 : v;
  return { filled: base < 2, stem: base < 4, flags: base >= 1 ? 0 : base >= 0.5 ? 1 : base >= 0.25 ? 2 : 3, dot };
};

/**
 * Lay out one hand. Returns
 *   { clef, width, heads, stems, rests, bars, ties, ledgers }
 * heads: [{ id, x, pos, alter (shown accidental or null), filled, dot, midi, finger, noteId }]
 * stems: [{ x, from, to, up, flags }] (positions), rests: [{ x, value, pos }],
 * bars: [{ x, number }], ties: [{ x1, x2, pos }], ledgers: [{ x, pos }].
 */
export function layoutStaff(song, hand, { ppb = 64 } = {}) {
  const clef = hand === "L" ? "bass" : "treble";
  const keyAlt = keyAlters(song.key || 0);
  const bar = barBeats(song);
  const nBars = barCount(song);
  const width = songBeats(song) * ppb;
  const notes = song.notes.filter(n => n.hand === hand);
  const bars = [];
  for (let i = 0; i <= nBars; i++) bars.push({ x: barStart(song, i) * ppb, number: song.pickup ? i : i + 1 });

  // Cut each note at bar lines and into written values.
  const barOf = t => {
    const p = song.pickup || 0;
    return p && t < p - 1e-6 ? 0 : Math.floor((t - p) / bar + 1e-6) + (p ? 1 : 0);
  };
  const pieces = [];
  for (const n of notes) {
    let t = n.t;
    const end = n.t + n.d;
    let first = true;
    while (t < end - 1e-6) {
      const b = barOf(t);
      const barEnd = barStart(song, b + 1);
      const segEnd = Math.min(end, barEnd);
      for (const v of splitValue(segEnd - t)) {
        pieces.push({ note: n, t, v, first, last: false, bar: b });
        first = false;
        t += v;
      }
      t = segEnd;
    }
    pieces[pieces.length - 1].last = true;
  }
  pieces.sort((a, b) => a.t - b.t || a.note.midi - b.note.midi);

  const heads = [];
  const ties = [];
  const ledgers = [];
  const shownAlter = new Map(); // `${bar}:${diatonic}` -> alter
  const prevHead = new Map(); // note id -> last head
  for (const p of pieces) {
    const s = spell(p.note.midi, song.key || 0);
    const pos = staffPos(s.diatonic, clef);
    const k = `${p.bar}:${s.diatonic}`;
    const current = shownAlter.has(k) ? shownAlter.get(k) : keyAlt[s.letter];
    let alter = null;
    if (p.first && current !== s.alter) {
      alter = s.alter;
      shownAlter.set(k, s.alter);
    }
    const g = glyphOf(p.v);
    const head = { id: `${p.note.id}:${p.t}`, noteId: p.note.id, x: p.t * ppb, t: p.t, v: p.v, pos, alter, filled: g.filled, dot: g.dot, stem: g.stem, flags: g.flags, midi: p.note.midi, finger: p.first ? p.note.finger ?? null : null };
    heads.push(head);
    const prev = prevHead.get(p.note.id);
    if (prev) ties.push({ x1: prev.x, x2: head.x, pos });
    prevHead.set(p.note.id, head);
    for (let lp = -2; lp >= pos; lp -= 2) ledgers.push({ x: head.x, pos: lp });
    for (let lp = 10; lp <= pos; lp += 2) ledgers.push({ x: head.x, pos: lp });
  }

  // One stem per chord (same start and value).
  const groups = new Map();
  for (const h of heads) {
    if (!h.stem) continue;
    const k = `${h.t}:${h.v}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  }
  const stems = [];
  for (const g of groups.values()) {
    const lo = Math.min(...g.map(h => h.pos));
    const hi = Math.max(...g.map(h => h.pos));
    const up = (lo + hi) / 2 < 4;
    const to = up ? Math.max(hi + 7, 4) : Math.min(lo - 7, 4);
    stems.push({ x: g[0].x, from: up ? lo : hi, to, up, flags: g[0].flags });
  }

  // Rests fill the gaps in each bar.
  const rests = [];
  for (let b = 0; b < nBars; b++) {
    const a = barStart(song, b);
    const z = barStart(song, b + 1);
    const inBar = pieces.filter(p => p.bar === b).map(p => [p.t, p.t + p.v]).sort((x, y) => x[0] - y[0]);
    if (!inBar.length) {
      rests.push({ x: (a + (z - a) / 2) * ppb, value: 4, pos: 6, whole: true });
      continue;
    }
    let cur = a;
    const gaps = [];
    for (const [s, e] of inBar) {
      if (s > cur + 1e-6) gaps.push([cur, s]);
      cur = Math.max(cur, e);
    }
    if (z > cur + 1e-6) gaps.push([cur, z]);
    for (const [s, e] of gaps) {
      let t = s;
      while (e - t > 0.2) {
        const v = REST_VALUES.find(x => x <= e - t + 1e-6 && Math.abs(((t - a) / x) % 1) < 1e-6) ?? REST_VALUES.find(x => x <= e - t + 1e-6);
        if (!v) break;
        rests.push({ x: t * ppb, value: v, pos: v >= 2 ? 5 : 4 });
        t += v;
      }
    }
  }

  return { clef, width, heads, stems, rests, bars, ties, ledgers };
}
