// The KeysFox song: every note timed in quarter-note beats and given to a hand.
//   { id, title, composer, source, bpm, timeSig: [n, d], key (fifths, −7…7), pickup (beats),
//     notes: [{ midi, t, d, hand: "R" | "L", vel, finger? }] }
// Built-in songs are written in a compact text form (see parseVoice);
// imported files come in through fromImport.
import { parseNote, PIANO_HIGH, PIANO_LOW } from "../../../lib/music/theory.js";

export const HANDS = ["R", "L"];

/** Length of one bar in quarter-note beats. */
export const barBeats = song => (song.timeSig[0] * 4) / song.timeSig[1];

/** Total length in beats, rounded up to a whole bar. */
export function songBeats(song) {
  const end = song.notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
  const bar = barBeats(song);
  const pickup = song.pickup || 0;
  return pickup + Math.ceil(Math.max(0, end - pickup) / bar - 1e-6) * bar;
}

/** The bar a beat falls in (0 = pickup bar when there is one, else bar 1 = index 0). */
export function barStart(song, index) {
  const pickup = song.pickup || 0;
  if (!pickup) return index * barBeats(song);
  return index === 0 ? 0 : pickup + (index - 1) * barBeats(song);
}
export function barCount(song) {
  const pickup = song.pickup || 0;
  return (pickup ? 1 : 0) + Math.round((songBeats(song) - pickup) / barBeats(song));
}
/** 1-based bar number shown to people for a beat (a pickup bar is bar 0). */
export function barAt(song, beat) {
  const pickup = song.pickup || 0;
  if (beat < pickup) return 0;
  return Math.floor((beat - pickup) / barBeats(song) + 1e-9) + 1;
}

/**
 * Parse one hand of a built-in song.
 * Tokens, space separated: "C4" (a quarter note), "C4/2" (two beats),
 * "[C3 E3 G3]/4" (a chord), "r/1" (rest), "C4/.5:3" (finger 3),
 * "|" (bar line, ignored, for readability). A bare duration carries over:
 * "E4/.5 D4 C4" are all eighth notes.
 */
export function parseVoice(text, hand, { bar = 0, pickup = 0 } = {}) {
  const notes = [];
  let t = 0;
  let lastDur = 1;
  const re = /\[([^\]]+)\]((?:\/[\d.]+)?(?::\d)?)|([A-Ga-gr][#b♯♭]*-?\d*)((?:\/[\d.]+)?(?::\d)?)|\|/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[0] === "|") {
      // Bar lines double as a check that every bar adds up.
      if (bar && Math.abs((((t - pickup) % bar) + bar) % bar) > 1e-6 && Math.abs(((((t - pickup) % bar) + bar) % bar) - bar) > 1e-6) {
        throw new Error(`Bar line at beat ${t} doesn't fall on a bar (${hand} hand, near "${text.slice(Math.max(0, m.index - 30), m.index)}")`);
      }
      continue;
    }
    const pitches = m[1] ? m[1].trim().split(/\s+/) : [m[3]];
    const suffix = m[2] ?? m[4] ?? "";
    const dm = /\/([\d.]+)/.exec(suffix);
    const fm = /:(\d)/.exec(suffix);
    const d = dm ? Number(dm[1]) : lastDur;
    if (!(d > 0)) throw new Error(`Bad duration in "${m[0]}"`);
    lastDur = d;
    for (const p of pitches) {
      if (p === "r") continue;
      const midi = parseNote(p);
      if (midi == null) throw new Error(`Bad note "${p}"`);
      const note = { midi, t, d, hand, vel: 0.75 };
      if (fm) note.finger = Number(fm[1]);
      notes.push(note);
    }
    t += d;
  }
  return notes;
}

let seq = 0;
const tidy = notes =>
  notes
    .filter(n => n.midi >= PIANO_LOW && n.midi <= PIANO_HIGH && n.d > 0)
    .map(n => ({ ...n, t: Math.round(n.t * 1000) / 1000, d: Math.round(n.d * 1000) / 1000 }))
    .sort((a, b) => a.t - b.t || a.midi - b.midi)
    .map((n, i) => ({ ...n, id: i }));

/** A built-in song from { right, left } text (or ready notes). */
export function makeSong({ id, title, composer, bpm, timeSig = [4, 4], key = 0, pickup = 0, right = "", left = "", notes = null, level = 1, tags = [], about = "" }) {
  const bar = (timeSig[0] * 4) / timeSig[1];
  const all = notes ?? [...parseVoice(right, "R", { bar, pickup }), ...parseVoice(left, "L", { bar, pickup })];
  return { id, title, composer, source: "built-in", bpm, timeSig, key, pickup, level, tags, about, notes: tidy(all) };
}

/** Round a beat to the nearest 1/grid (grid 4 = sixteenth notes). */
const snap = (beat, grid = 4) => Math.round(beat * grid) / grid;

/**
 * Turn an import (midi.js / musicXml.js / audioToNotes.js shape) into a song.
 * tracks: which track indexes to keep (default all). Hands come from staves
 * when the file has them, from two tracks (higher one is the right hand),
 * or from a split at middle C.
 */
export function fromImport(parsed, { title, tracks: keep = null, quantize = true } = {}) {
  const chosen = parsed.tracks.filter((_, i) => !keep || keep.includes(i));
  if (!chosen.length) throw new Error("No notes to play in that file.");
  const hasStaves = chosen.some(tr => tr.notes.some(n => n.staff === 2));
  const avg = tr => tr.notes.reduce((s, n) => s + n.midi, 0) / (tr.notes.length || 1);
  const twoTracks = !hasStaves && chosen.length === 2;
  const upper = twoTracks ? (avg(chosen[0]) >= avg(chosen[1]) ? 0 : 1) : 0;
  const notes = [];
  chosen.forEach((tr, ti) => {
    for (const n of tr.notes) {
      let hand;
      if (hasStaves) hand = (n.staff ?? 1) >= 2 ? "L" : "R";
      else if (twoTracks) hand = ti === upper ? "R" : "L";
      else hand = n.midi >= 60 ? "R" : "L";
      const t = quantize ? snap(n.beat) : n.beat;
      const end = quantize ? snap(n.beat + n.beats) : n.beat + n.beats;
      notes.push({ midi: n.midi, t, d: Math.max(0.25, end - t), hand, vel: n.vel ?? 0.75 });
    }
  });
  // Drop exact duplicates (same key, same time) that layered tracks create.
  const seen = new Set();
  const unique = notes.filter(n => {
    const k = `${n.midi}@${n.t}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Start on the first note's bar.
  const timeSig = parsed.timeSig ?? [4, 4];
  const bar = (timeSig[0] * 4) / timeSig[1];
  const first = Math.min(...unique.map(n => n.t));
  const shift = Math.floor(first / bar) * bar;
  for (const n of unique) n.t -= shift;
  if (unique.length > 8000) unique.length = 8000;
  return {
    id: `u${Date.now().toString(36)}${(seq++).toString(36)}`,
    title: (title || parsed.title || "Imported song").slice(0, 80),
    composer: "",
    source: "import",
    bpm: Math.round(Math.min(240, Math.max(30, parsed.tempo || 100))),
    timeSig,
    key: Number.isInteger(parsed.key) ? parsed.key : guessKey(unique),
    pickup: 0,
    level: 2,
    tags: [],
    notes: tidy(unique),
  };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** Key signature (fifths) that fits the most notes. */
export function guessKey(notes) {
  let best = 0;
  let bestScore = -1;
  for (let fifths = -6; fifths <= 6; fifths++) {
    const tonic = (((fifths * 7) % 12) + 12) % 12;
    const scale = new Set(MAJOR.map(s => (tonic + s) % 12));
    let score = 0;
    for (const n of notes) if (scale.has(n.midi % 12)) score += n.d;
    score -= Math.abs(fifths) * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = fifths;
    }
  }
  return best;
}

// --- Easy / Medium / Hard --------------------------------------------------

export const LEVELS = [
  { id: "easy", name: "Easy", hint: "Melody and one bass note per bar" },
  { id: "medium", name: "Medium", hint: "Up to two notes per hand" },
  { id: "hard", name: "Hard", hint: "Everything as written" },
];

/** Group notes of a hand by start time. */
function onsets(notes) {
  const map = new Map();
  for (const n of notes) {
    if (!map.has(n.t)) map.set(n.t, []);
    map.get(n.t).push(n);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

/** A playable arrangement of a song at a difficulty. */
export function arrange(song, level = "hard") {
  if (level === "hard") return song;
  const R = song.notes.filter(n => n.hand === "R");
  const L = song.notes.filter(n => n.hand === "L");
  const out = [];
  if (level === "medium") {
    for (const [, group] of onsets(R)) {
      const sorted = [...group].sort((a, b) => b.midi - a.midi);
      out.push(sorted[0]);
      if (sorted.length > 2) out.push(sorted[sorted.length - 1]);
      else if (sorted[1]) out.push(sorted[1]);
    }
    // Left hand: keep the bass note, plus the top note of big chords; skip
    // very fast left-hand runs (shorter than an eighth).
    for (const [, group] of onsets(L)) {
      const sorted = [...group].sort((a, b) => a.midi - b.midi);
      if (sorted[0].d < 0.5 && group.length === 1) {
        const onBeat = Math.abs(sorted[0].t - Math.round(sorted[0].t)) < 1e-6;
        if (!onBeat) continue;
      }
      out.push(sorted[0]);
      if (sorted.length >= 3) out.push(sorted[sorted.length - 1]);
    }
  } else {
    // Easy: the top line in the right hand, on an eighth-note grid.
    let lastEnd = -1;
    for (const [t, group] of onsets(R)) {
      if (t < lastEnd - 1e-6 && t - Math.floor(t * 2) / 2 > 1e-6) continue;
      const top = group.reduce((a, b) => (b.midi > a.midi ? b : a));
      out.push(top);
      lastEnd = t + top.d;
    }
    // One bass note at the start of each bar (the lowest sounding there), held for the bar.
    const bar = barBeats(song);
    const total = songBeats(song);
    const pickup = song.pickup || 0;
    for (let start = pickup; start < total - 1e-6; start += bar) {
      const inBar = L.filter(n => n.t >= start - 1e-6 && n.t < start + bar - 1e-6);
      if (!inBar.length) continue;
      const firstT = Math.min(...inBar.map(n => n.t));
      const low = inBar.filter(n => n.t === firstT).reduce((a, b) => (b.midi < a.midi ? b : a));
      out.push({ ...low, t: start, d: bar });
    }
  }
  return { ...song, level, notes: tidy(out.map(n => ({ ...n }))) };
}

/** Notes for practice with one hand or both. */
export const notesFor = (song, hands) => song.notes.filter(n => hands === "both" || n.hand === hands);

/** The lowest and highest key worth showing, widened to whole octaves C..C (min two octaves). */
export function keyRange(song) {
  if (!song.notes.length) return [48, 84];
  let lo = Math.min(...song.notes.map(n => n.midi));
  let hi = Math.max(...song.notes.map(n => n.midi));
  lo = Math.max(PIANO_LOW, lo - (lo % 12) - (lo % 12 === 0 ? 0 : 0));
  hi = Math.min(PIANO_HIGH, hi + ((12 - (hi % 12)) % 12));
  while (hi - lo < 24) {
    if (lo - 12 >= PIANO_LOW && hi - 60 > 60 - lo) lo -= 12;
    else if (hi + 12 <= PIANO_HIGH) hi += 12;
    else lo -= 12;
  }
  return [lo, hi];
}
