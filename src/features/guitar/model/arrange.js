// Turning a song into what you play: every note gets a string, a fret and
// a finger; every chord becomes strums or picked notes for the level you
// choose. The result (a timeline) drives the falling notes, the tab, the
// fretboard and the scoring. Times are in quarter-note beats from bar one.

import { CHORDS, TUNING, chordPitchClasses, chordRoot, chordShape, shapeNotes } from "../data/chords.js";
import { STRUMS, slotsPerBar } from "../data/strums.js";

export const PARTS = [
  { id: "lead", name: "Melody", hint: "Single notes: the tune itself." },
  { id: "rhythm", name: "Chords", hint: "Strum or pick the chords." },
  { id: "both", name: "Both", hint: "Fingerstyle: the tune on top, bass notes from the chords under it." },
];
export const LEVELS = [
  { id: "easy", name: "Easy" },
  { id: "medium", name: "Medium" },
  { id: "hard", name: "Hard" },
];
export const MAX_FRET = 15;

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" -> 66, "Bb3" -> 58; null for anything else. */
export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

export const barBeats = sig => {
  const [n, d] = sig.split("/").map(Number);
  return (n * 4) / d;
};

/** Melody text -> [{ midi, beat, beats }] (rests left out), starting at -pickup. */
export function parseMelody(text, pickup = 0) {
  const out = [];
  let beat = -pickup;
  for (const tok of (text ?? "").split(/[\s|]+/).filter(Boolean)) {
    const [name, len] = tok.split("/");
    const beats = Number(len);
    if (!(beats > 0)) throw new Error(`Bad note "${tok}"`);
    if (name !== "r") {
      const midi = noteToMidi(name);
      if (midi == null) throw new Error(`Bad note "${tok}"`);
      out.push({ midi, beat, beats });
    }
    beat += beats;
  }
  return out;
}

/** Chord text -> bars [{ index, start, beats, chords: [{ name, beat, beats }] }]. */
export function parseChords(text, sig) {
  const len = barBeats(sig);
  return (text ?? "")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)
    .map((bar, index) => {
      const names = bar.split(/\s+/);
      const each = len / names.length;
      return { index, start: index * len, beats: len, chords: names.map((name, i) => ({ name, beat: index * len + i * each, beats: each })) };
    });
}

/** Where a pitch can be played: [{ string, fret }]. */
export function positionsFor(midi, tuning = TUNING, maxFret = MAX_FRET) {
  const out = [];
  tuning.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= maxFret) out.push({ string, fret });
  });
  return out;
}

/** Move a note into the guitar's range by octaves. */
export function fitRange(midi, tuning = TUNING) {
  let m = midi;
  while (m < tuning[0]) m += 12;
  while (m > tuning[5] + MAX_FRET) m -= 12;
  return m;
}

/**
 * Guitar music is written an octave above how it sounds, so a tune written
 * for voice often sits better an octave down. Picks the octave shift (in
 * semitones) that keeps the most notes within reach of `home`.
 */
export function bestOctave(midis, { home = 0, tuning = TUNING } = {}) {
  let best = 0;
  let bestScore = -Infinity;
  for (const shift of [-24, -12, 0, 12]) {
    let score = 0;
    for (const m of midis) {
      const ps = positionsFor(m + shift, tuning);
      if (!ps.length) {
        score -= 5;
        continue;
      }
      const lo = home;
      const hi = home === 0 ? 4 : home + 4;
      const reach = ps.some(p => (p.fret >= lo && p.fret <= hi) || (home === 0 && p.fret === 0));
      score += reach ? 1 : -0.5;
    }
    // Prefer to keep the written octave on a tie.
    score -= Math.abs(shift) * 0.001;
    if (score > bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  return best;
}

/**
 * Choose a string and fret for each note so the hand moves as little as
 * possible (dynamic programming over every playable spot). `home` is the
 * fret the hand prefers to sit at (0 = open position).
 * notes: [{ midi, beat }] sorted by beat; returns copies with string/fret.
 */
export function placeNotes(notes, { home = 0, tuning = TUNING, avoidStrings = [] } = {}) {
  if (!notes.length) return [];
  const cands = notes.map(n => {
    let c = positionsFor(n.midi, tuning).filter(p => !avoidStrings.includes(p.string));
    if (!c.length) c = positionsFor(n.midi, tuning);
    if (!c.length) c = positionsFor(fitRange(n.midi, tuning), tuning);
    return c;
  });
  const lo = home === 0 ? 0 : home;
  const hi = home === 0 ? 4 : home + 3;
  const nodeCost = p => {
    let c = p.fret * 0.04;
    if (p.fret === 0) c += home === 0 ? 0 : 1.2;
    else if (p.fret < lo) c += (lo - p.fret) * 0.7;
    else if (p.fret > hi) c += (p.fret - hi) * 0.7;
    return c;
  };
  const move = (a, b) => {
    let c = Math.abs(a.string - b.string) * 0.05;
    if (a.fret > 0 && b.fret > 0) c += Math.max(0, Math.abs(a.fret - b.fret) - 3) * 0.8;
    return c;
  };
  let cost = cands[0].map(nodeCost);
  const back = [cands[0].map(() => -1)];
  for (let i = 1; i < cands.length; i++) {
    const next = [];
    const from = [];
    for (const p of cands[i]) {
      let best = Infinity;
      let arg = 0;
      cands[i - 1].forEach((q, j) => {
        const c = cost[j] + move(q, p);
        if (c < best) {
          best = c;
          arg = j;
        }
      });
      next.push(best + nodeCost(p));
      from.push(arg);
    }
    cost = next;
    back.push(from);
  }
  let k = cost.indexOf(Math.min(...cost));
  const picked = new Array(cands.length);
  for (let i = cands.length - 1; i >= 0; i--) {
    picked[i] = cands[i][k];
    k = back[i][k];
  }
  return notes.map((n, i) => ({ ...n, midi: tuning[picked[i].string] + picked[i].fret, string: picked[i].string, fret: picked[i].fret }));
}

/**
 * Fretting fingers for single notes: the index finger sits on a fret and
 * the others take the next three. Open strings get 0. The hand shifts only
 * when a note falls outside its reach.
 */
export function assignFingers(notes, { home = 0 } = {}) {
  let pos = Math.max(1, home || 1);
  return notes.map(n => {
    if (n.fret === 0) return { ...n, finger: 0 };
    if (n.fret < pos || n.fret > pos + 3) pos = n.fret <= 4 ? 1 : n.fret > pos + 3 ? n.fret - 3 : n.fret;
    pos = Math.max(1, pos);
    return { ...n, finger: n.fret - pos + 1 };
  });
}

/** Known chord name for anything a chord sheet might say ("Gsus2" -> "G", "C/E" -> "C"). */
export function normalizeChord(name) {
  if (!name) return null;
  const clean = name.trim().replace(/\(.*\)/, "").split("/")[0];
  if (CHORDS[clean]) return clean;
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(clean);
  if (!m) return null;
  const flatToSharp = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", "A#": "Bb" };
  const root = flatToSharp[m[1]] && !CHORDS[m[1]] ? flatToSharp[m[1]] : m[1];
  const rest = m[2];
  const minor = /^(m|min|-)(?!aj)/.test(rest);
  const seventh = /7/.test(rest) && !/maj7/.test(rest);
  const tries = minor ? [`${root}m${seventh ? "7" : ""}`, `${root}m`] : [seventh ? `${root}7` : null, /maj7/.test(rest) ? `${root}maj7` : null, root];
  for (const t of tries) if (t && CHORDS[t]) return t;
  // Build a barre shape for roots without an open chord.
  return makeBarre(root, minor) ? `${root}${minor ? "m" : ""}` : null;
}

const E_FORM = { maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0] };
const E_FINGERS = { maj: [1, 3, 4, 2, 1, 1], min: [1, 3, 4, 1, 1, 1] };
const A_FORM = { maj: [-99, 0, 2, 2, 2, 0], min: [-99, 0, 2, 2, 1, 0] };
const A_FINGERS = { maj: [0, 1, 3, 3, 3, 1], min: [0, 1, 3, 4, 2, 1] };

/** Adds a movable barre chord to CHORDS for a root we don't have (e.g. G#m). */
function makeBarre(root, minor) {
  const name = `${root}${minor ? "m" : ""}`;
  if (CHORDS[name]) return true;
  const pc = chordRoot(root);
  if (pc == null) return false;
  const q = minor ? "min" : "maj";
  const eFret = (pc - 4 + 12) % 12 || 12;
  const aFret = (pc - 9 + 12) % 12 || 12;
  const useE = eFret <= aFret || aFret > 9;
  const base = useE ? eFret : aFret;
  const form = useE ? E_FORM[q] : A_FORM[q];
  const fingers = useE ? E_FINGERS[q] : A_FINGERS[q];
  CHORDS[name] = {
    frets: form.map(f => (f < -1 ? -1 : f + base)),
    fingers: form.map((f, i) => (f < -1 ? 0 : fingers[i])),
    barre: { fret: base, from: useE ? 0 : 1, to: 5 },
    generated: true,
  };
  return true;
}

/** The shape's bass note: the root on the lowest string that has it, else the lowest string played. */
function bassOf(shape) {
  const notes = shapeNotes(shape);
  const root = chordRoot(shape.name);
  return notes.find(n => n.midi % 12 === root) ?? notes[0];
}

let uid = 0;
const evId = () => `e${++uid}`;

function strumEvents(bars, sig, level) {
  const pattern = (STRUMS[sig] ?? STRUMS["4/4"])[level];
  const slots = slotsPerBar(sig);
  const slotLen = barBeats(sig) / slots;
  const out = [];
  for (const bar of bars) {
    for (let s = 0; s < slots; s++) {
      const t = bar.start + s * slotLen;
      const ch = bar.chords.find(c => t >= c.beat - 1e-6 && t < c.beat + c.beats - 1e-6) ?? bar.chords[0];
      const shape = chordShape(ch.name, level);
      if (!shape) continue;
      // A chord change lands on its first slot even if the pattern rests there.
      const changed = Math.abs(t - ch.beat) < 1e-6;
      if (pattern.slots) {
        let mark = pattern.slots[s % pattern.slots.length];
        if (mark === "." && changed && s > 0) mark = "D";
        if (mark === ".") continue;
        let next = s + 1;
        while (next < slots && pattern.slots[next] === ".") next++;
        const notes = shapeNotes(shape);
        out.push({
          id: evId(),
          kind: "strum",
          t,
          d: (next - s) * slotLen,
          dir: mark,
          chord: shape.name,
          shape,
          // Up strums mostly catch the top strings.
          notes: mark === "U" ? notes.filter(n => n.string >= 2) : notes,
          bar: bar.index,
        });
      } else {
        const want = pattern.pick[s % pattern.pick.length];
        const notes = shapeNotes(shape);
        let note;
        if (want === "B") note = bassOf(shape);
        else {
          const string = 6 - want;
          note = notes.find(n => n.string === string) ?? notes.find(n => n.string > string) ?? notes[notes.length - 1];
        }
        out.push({ id: evId(), kind: "pick", t, d: slotLen, chord: shape.name, shape, notes: [note], bar: bar.index, showChord: changed });
      }
    }
  }
  return out;
}

/** Easy melody: notes that fall between beats and are shorter than a beat are folded into the note before. */
function simplifyMelody(notes) {
  const out = [];
  for (const n of notes) {
    const offBeat = Math.abs(n.beat - Math.round(n.beat)) > 1e-6;
    if (out.length && offBeat && n.beats < 1) {
      const prev = out[out.length - 1];
      prev.beats = n.beat + n.beats - prev.beat;
      continue;
    }
    out.push({ ...n });
  }
  return out;
}

/** A song's tune as [{ midi, beat, beats }]: from melody text or imported notes. */
export const melodyOf = song => (Array.isArray(song.notes) ? song.notes.map(n => ({ ...n })) : parseMelody(song.melody, song.pickup ?? 0));

/** Tab entries [string, fret, beat?, beats?] -> notes; without beats, one per beat. */
export const tabNotes = song => song.tab.map(([string, fret, beat, beats], i) => ({ midi: TUNING[string] + fret, beat: beat ?? i, beats: beats ?? 1, string, fret }));

function tabEvents(song) {
  const notes = assignFingers(tabNotes(song).sort((a, b) => a.beat - b.beat || a.string - b.string));
  const events = [];
  for (const n of notes) {
    const last = events[events.length - 1];
    const note = { string: n.string, fret: n.fret, finger: n.finger, midi: n.midi };
    if (last && Math.abs(last.t - n.beat) < 1e-6) {
      if (!last.notes.some(x => x.string === n.string)) last.notes.push(note);
      last.kind = "pinch";
      last.d = Math.max(last.d, n.beats);
    } else events.push({ id: evId(), kind: "note", t: n.beat, d: n.beats, notes: [note] });
  }
  return events;
}

function leadEvents(song, level) {
  if (song.tab) return tabEvents(song);
  let notes = melodyOf(song);
  if (level === "easy" && !song.tab) notes = simplifyMelody(notes);
  // Hard plays the tune higher up the neck.
  const home = level === "hard" ? 5 : song.home ?? 0;
  if (!song.tab) {
    const shift = bestOctave(notes.map(n => n.midi), { home });
    notes = notes.map(n => ({ ...n, midi: fitRange(n.midi + shift) }));
  }
  const placed = placeNotes(notes, { home });
  return assignFingers(placed, { home }).map(n => ({
    id: evId(),
    kind: "note",
    t: n.beat,
    d: n.beats,
    notes: [{ string: n.string, fret: n.fret, finger: n.finger, midi: n.midi }],
  }));
}

function fingerstyleEvents(song, bars, level) {
  const sigBeats = barBeats(song.sig);
  // Melody stays on the top four strings so the thumb has the bass strings.
  const melody = melodyOf(song).map(n => ({ ...n, midi: fitRange(n.midi) }));
  const lifted = melody.map(n => ({ ...n, midi: n.midi < 50 ? n.midi + 12 : n.midi }));
  const placed = assignFingers(placeNotes(lifted, { avoidStrings: [0, 1] }));
  const events = placed.map(n => ({ id: evId(), kind: "note", t: n.beat, d: n.beats, notes: [{ string: n.string, fret: n.fret, finger: n.finger, midi: n.midi }] }));
  // Bass: beat one (easy), each chord and the middle of the bar (medium), every beat (hard).
  const bassTimes = [];
  for (const bar of bars) {
    for (const ch of bar.chords) {
      const step = level === "easy" ? sigBeats : level === "medium" ? Math.max(1, Math.min(ch.beats, sigBeats / (sigBeats % 2 ? 3 : 2))) : 1;
      for (let t = ch.beat; t < ch.beat + ch.beats - 1e-6; t += step) {
        if (level === "easy" && t !== bar.start) continue;
        bassTimes.push({ t, d: step, chord: ch.name, alt: Math.round((t - ch.beat) / step) % 2 === 1 });
      }
    }
  }
  for (const b of bassTimes) {
    const shape = chordShape(b.chord, level);
    if (!shape) continue;
    const notes = shapeNotes(shape);
    let note = bassOf(shape);
    if (b.alt && level === "hard") {
      // Alternate to the next bass string the chord uses.
      note = notes.find(n => n.string === note.string + 1 && n.string <= 2) ?? note;
    }
    if (note.string > 2) continue;
    const clash = events.some(e => e.kind === "note" && Math.abs(e.t - b.t) < 1e-6 && e.notes[0].string === note.string);
    if (clash) continue;
    events.push({ id: evId(), kind: "bass", t: b.t, d: b.d, chord: shape.name, shape, notes: [note] });
  }
  // Merge notes that start together into one event (played as a pinch).
  events.sort((a, b) => a.t - b.t || a.notes[0].string - b.notes[0].string);
  const merged = [];
  for (const e of events) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.t - e.t) < 1e-6) {
      last.notes = [...last.notes, ...e.notes].sort((a, b) => a.string - b.string);
      last.kind = "pinch";
      last.chord ??= e.chord;
      last.d = Math.max(last.d, e.d);
    } else merged.push({ ...e });
  }
  return merged;
}

/** What parts a song offers. */
export function partsFor(song) {
  const hasMelody = Boolean(song.melody || song.tab || song.notes?.length);
  const hasChords = Boolean(song.chords);
  return PARTS.filter(p => (p.id === "lead" ? hasMelody : p.id === "rhythm" ? hasChords : hasMelody && hasChords && !song.tab));
}

/**
 * Everything the practice screen needs for a song, part and level:
 * { events, bars, start, end, sig, bpm, chordsUsed, backing }.
 * backing = the other part, to play quietly underneath if you want it.
 */
export function buildTimeline(song, { part = "lead", level = "medium" } = {}) {
  const parts = partsFor(song).map(p => p.id);
  const use = parts.includes(part) ? part : parts[0];
  const sig = song.sig ?? "4/4";
  const len = barBeats(sig);
  let bars = song.chords ? parseChords(song.chords, sig) : [];
  let events;
  if (use === "rhythm") events = strumEvents(bars, sig, level);
  else if (use === "both") events = fingerstyleEvents(song, bars, level);
  else events = leadEvents(song, level);
  events.sort((a, b) => a.t - b.t);
  const lastEnd = events.reduce((m, e) => Math.max(m, e.t + e.d), 0);
  if (!bars.length) {
    const n = Math.max(1, Math.ceil(lastEnd / len - 1e-6));
    bars = Array.from({ length: n }, (_, index) => ({ index, start: index * len, beats: len, chords: [] }));
  }
  const start = Math.min(0, ...events.map(e => e.t));
  const end = Math.max(bars.length * len, lastEnd);
  let backing = [];
  if (use === "lead" && song.chords) backing = strumEvents(bars, sig, "easy");
  else if (use === "rhythm" && (song.melody || song.tab || song.notes?.length)) backing = leadEvents(song, "medium");
  const chordsUsed = [...new Set(events.map(e => e.shape?.name ?? e.chord).filter(Boolean))];
  return { part: use, level, events, bars, start, end, sig, barLen: len, bpm: song.bpm ?? 90, chordsUsed, backing };
}

/** Pitch classes a strum should sound (for listening). */
export const eventPitchClasses = e => (e.chord && (e.kind === "strum") ? chordPitchClasses(e.chord) ?? e.notes.map(n => n.midi % 12) : e.notes.map(n => n.midi % 12));
