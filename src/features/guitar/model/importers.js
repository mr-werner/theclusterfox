// Bringing your own music into FretFox. Everything ends up in the same
// song shape as the built-in songs, so every part and level works on it:
//   - MIDI and MusicXML files (parsed by src/lib/music), and rough
//     transcriptions of recordings: the tune becomes the melody, and the
//     chords are worked out bar by bar from all the notes.
//   - Guitar tab pasted as text (the six-line e|---0--- kind).
//   - Chord sheets: chords over lyrics, or ChordPro [C]brackets.

import { chordPitchClasses } from "../data/chords.js";
import { barBeats, normalizeChord } from "./arrange.js";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const CANDIDATES = ROOTS.flatMap(r => [r, `${r}m`, `${r}7`]).map(name => ({ name, pcs: chordPitchClasses(name) })).filter(c => c.pcs);

export const newSongId = () => `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The time signature FretFox can show for a [num, den] pair. */
export function sigFrom([n, d] = [4, 4]) {
  if (d === 8 && n % 3 === 0) return "6/8";
  if (n === 3 || n === 6) return "3/4";
  return "4/4";
}

/** Best chord name for a pitch-class weight profile, or null when too thin. */
export function chordFromProfile(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const c of CANDIDATES) {
    let inside = 0;
    for (const pc of c.pcs) inside += weights[pc];
    const outside = total - inside;
    // Sevenths only win when the seventh is really there.
    const seventhPenalty = c.pcs.length === 4 ? (weights[c.pcs[3]] < total * 0.08 ? 1 : 0.05) * total : 0;
    const score = inside + weights[c.pcs[0]] * 0.5 - outside * 0.6 - seventhPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = c.name;
    }
  }
  return bestScore > total * 0.35 ? normalizeChord(best) : null;
}

/** The top line of a set of notes: one note per onset, the highest, never overlapping the next. */
export function topLine(notes, grid = 0.25) {
  const q = b => Math.round(b / grid) * grid;
  const byOnset = new Map();
  for (const n of notes) {
    const beat = q(n.beat);
    const prev = byOnset.get(beat);
    if (!prev || n.midi > prev.midi) byOnset.set(beat, { midi: n.midi, beat, beats: Math.max(grid, q(n.beats) || grid) });
  }
  const line = [...byOnset.values()].sort((a, b) => a.beat - b.beat);
  for (let i = 0; i < line.length - 1; i++) line[i].beats = Math.max(grid, Math.min(line[i].beats, line[i + 1].beat - line[i].beat));
  return line;
}

/**
 * Turn parsed note data ({ tempo, timeSig, title, tracks: [{ name, notes: [{ midi, beat, beats }] }] })
 * into a FretFox song. melodyTrack picks the tune; every track feeds the chords.
 */
export function songFromNoteData(parsed, { melodyTrack = 0, title, source = "midi", chords = true } = {}) {
  const tracks = (parsed.tracks ?? []).filter(t => t.notes?.length);
  if (!tracks.length) throw new Error("No notes found in that file.");
  const sig = sigFrom(parsed.timeSig);
  const len = barBeats(sig);
  const tune = tracks[Math.min(melodyTrack, tracks.length - 1)];
  let line = topLine(tune.notes.map(n => ({ midi: n.midi, beat: n.beat, beats: n.beats })));
  if (line.length > 3000) line = line.slice(0, 3000);
  // Start at the bar the music starts in.
  const first = Math.min(...tracks.flatMap(t => t.notes.map(n => n.beat)));
  const shift = Math.floor(first / len + 1e-6) * len;
  line = line.map(n => ({ ...n, beat: Math.round((n.beat - shift) * 1000) / 1000 }));
  const end = Math.max(...tracks.flatMap(t => t.notes.map(n => n.beat + n.beats))) - shift;
  const nBars = Math.min(400, Math.max(1, Math.ceil(end / len - 1e-6)));

  let chordText;
  if (chords) {
    const halves = len >= 4 ? 2 : 1;
    const bars = [];
    let last = null;
    for (let b = 0; b < nBars; b++) {
      const names = [];
      for (let h = 0; h < halves; h++) {
        const from = b * len + (h * len) / halves;
        const to = from + len / halves;
        const w = new Array(12).fill(0);
        for (const t of tracks)
          for (const n of t.notes) {
            const s = n.beat - shift;
            const overlap = Math.min(to, s + n.beats) - Math.max(from, s);
            // Bass notes count extra: they usually name the chord.
            if (overlap > 0) w[((n.midi % 12) + 12) % 12] += overlap * (n.midi < 52 ? 1.6 : 1);
          }
        names.push(chordFromProfile(w) ?? last ?? null);
        last = names[names.length - 1] ?? last;
      }
      const clean = names.map(n => n ?? last ?? "C");
      bars.push(clean.every(n => n === clean[0]) ? clean[0] : clean.join(" "));
    }
    chordText = bars.join(" | ");
  }
  return {
    id: newSongId(),
    title: (title || parsed.title || tune.name || "Imported song").slice(0, 120),
    by: source === "audio" ? "Your recording (rough transcription)" : "Imported",
    sig,
    bpm: Math.round(Math.min(260, Math.max(30, parsed.tempo || 100))),
    key: "",
    level: 2,
    source,
    addedAt: new Date().toISOString(),
    notes: line,
    ...(chordText ? { chords: chordText } : {}),
  };
}

/** Notes in seconds only (no beat fields)? Add beats from the tempo. */
export function withBeats(parsed) {
  const spb = 60 / (parsed.tempo || 120);
  return {
    ...parsed,
    tracks: (parsed.tracks ?? []).map(t => ({
      ...t,
      notes: t.notes.map(n => ({ ...n, beat: n.beat ?? n.start / spb, beats: n.beats ?? n.dur / spb })),
    })),
  };
}

const TAB_LINE = /^\s*([eBGDAEbgda])?\s*[|:]?([-0-9|hpbrsx\/\\~()<>*.^ ]{4,})\|?\s*$/;

/**
 * Six-line ASCII tab -> tab entries [string, fret, beat, beats]. Spacing
 * between numbers sets the rhythm (about four dashes to a beat), since
 * plain-text tab has no real rhythm in it. Throws when no tab is found.
 */
export function parseTabText(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks = [];
  for (let i = 0; i + 5 < lines.length; i++) {
    const six = lines.slice(i, i + 6);
    if (six.every(l => TAB_LINE.test(l) && /-/.test(l))) {
      blocks.push(six.map(l => l.replace(/^\s*[eBGDAEbgda]?\s*[|:]?/, "")));
      i += 5;
    }
  }
  if (!blocks.length) throw new Error("No six-line tab found. Paste lines that start like e|--- B|--- G|--- D|--- A|--- E|---.");
  const out = [];
  let beat = 0;
  for (const block of blocks) {
    const width = Math.max(...block.map(l => l.length));
    let lastCol = null;
    for (let col = 0; col < width; col++) {
      const hits = [];
      block.forEach((line, row) => {
        const ch = line[col];
        if (!/\d/.test(ch ?? "")) return;
        if (col > 0 && /\d/.test(line[col - 1])) return; // second digit of a two-digit fret
        let digits = ch;
        if (/\d/.test(line[col + 1] ?? "")) digits += line[col + 1];
        const fret = Number(digits);
        if (fret <= 24) hits.push([5 - row, fret]);
      });
      if (!hits.length) continue;
      if (lastCol != null) beat += Math.min(2, Math.max(0.25, Math.round(((col - lastCol) / 4) * 4) / 4));
      lastCol = col;
      for (const [string, fret] of hits) out.push([string, fret, beat, 0.5]);
    }
    beat += 1;
  }
  // Each note lasts until the next one.
  const onsets = [...new Set(out.map(t => t[2]))].sort((a, b) => a - b);
  for (const t of out) {
    const next = onsets.find(o => o > t[2]);
    t[3] = next != null ? Math.min(4, next - t[2]) : 1;
  }
  return out.slice(0, 3000);
}

const CHORD_TOKEN = /^[A-G](#|b)?(m|min|maj|dim|aug|sus|add|M)?\d*(sus\d|add\d|maj\d)?(\/[A-G](#|b)?)?$/;

/**
 * Chord sheet text -> "C | G | Am | F". Reads ChordPro [C] brackets, or
 * lines made of chord names (chords over lyrics). One chord per bar.
 */
export function parseChordSheet(text) {
  const names = [];
  const bracket = [...text.matchAll(/\[([^\]\s]{1,12})\]/g)].map(m => m[1]);
  if (bracket.length) names.push(...bracket);
  else {
    for (const line of text.replace(/\r/g, "").split("\n")) {
      const toks = line.trim().split(/[\s|]+/).filter(Boolean);
      if (!toks.length) continue;
      const chordy = toks.filter(t => CHORD_TOKEN.test(t));
      if (chordy.length / toks.length >= 0.6) names.push(...chordy);
    }
  }
  const known = names.map(normalizeChord).filter(Boolean);
  if (!known.length) throw new Error("No chords found. Paste chord names like G C D Em, or ChordPro like [G]Words [C]here.");
  return known.slice(0, 400).join(" | ");
}
