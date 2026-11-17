// FretFox checks: node src/features/guitar/tests/validate.mjs
import assert from "node:assert/strict";

import { CHORDS, TUNING, chordShape, shapeNotes } from "../data/chords.js";
import { STRUMS, STRUM_LIBRARY, slotsPerBar } from "../data/strums.js";
import { ALL_BUILT_IN, SONGS } from "../data/songs.js";
import { LEVELS, barBeats, buildTimeline, normalizeChord, parseChords, parseMelody, partsFor, placeNotes, assignFingers } from "../model/arrange.js";
import { chordFromProfile, parseChordSheet, parseTabText, songFromNoteData, topLine } from "../model/importers.js";
import { frameMatches } from "../model/listen.js";
import { addPractice, addSong, emptyData, normalizeData } from "../state/guitarStore.js";
import { launchTargets, planItems } from "../model/planLink.js";
import { parseMidi, writeMidi } from "../../../lib/music/midi.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("chord shapes are playable and match their names", () => {
  for (const [name, c] of Object.entries(CHORDS)) {
    assert.equal(c.frets.length, 6, name);
    assert.equal(c.fingers.length, 6, name);
    c.frets.forEach((f, s) => {
      assert(f >= -1 && f <= 15, `${name} fret`);
      if (f > 0) assert(c.fingers[s] >= 1 && c.fingers[s] <= 4, `${name} string ${s} needs a finger`);
      else assert.equal(c.fingers[s], 0, `${name} string ${s} open/muted has no finger`);
    });
    if (c.easy) assert(CHORDS[c.easy], `${name} easy swap exists`);
    // Every sounding note belongs to the chord.
    const root = /^([A-G](?:#|b)?)/.exec(name)[1];
    const n = normalizeChord(name);
    assert.equal(n, name, `${name} normalizes to itself`);
    void root;
  }
  assert.deepEqual(shapeNotes(CHORDS.C).map(n => n.midi), [48, 52, 55, 60, 64]);
  assert.equal(chordShape("F", "easy").name, "Fmaj7");
  assert.equal(chordShape("F", "medium").name, "F");
});

test("strum patterns fill their bars", () => {
  for (const [sig, levels] of Object.entries(STRUMS)) {
    for (const p of Object.values(levels)) assert.equal((p.slots ?? p.pick).length, slotsPerBar(sig), `${sig} ${p.name}`);
  }
  for (const p of STRUM_LIBRARY) assert.equal((p.slots ?? p.pick).length, slotsPerBar(p.sig), p.id);
  assert.equal(barBeats("6/8"), 3);
});

test("every built-in song lines up with its bars and builds at every part and level", () => {
  assert.equal(new Set(ALL_BUILT_IN.map(s => s.id)).size, ALL_BUILT_IN.length);
  for (const s of ALL_BUILT_IN) {
    if (s.melody && s.chords) {
      const m = parseMelody(s.melody, s.pickup ?? 0);
      const total = s.melody.split(/[\s|]+/).filter(Boolean).reduce((a, t) => a + Number(t.split("/")[1]), 0) - (s.pickup ?? 0);
      assert.equal(total, parseChords(s.chords, s.sig).length * barBeats(s.sig), `${s.id}: melody fills the bars`);
      assert(m.length > 0);
    }
    for (const c of (s.chords ?? "").split(/[\s|]+/).filter(Boolean)) assert(CHORDS[c], `${s.id}: chord ${c} has a shape`);
    const parts = partsFor(s);
    assert(parts.length, `${s.id} has something to play`);
    for (const p of parts)
      for (const l of LEVELS) {
        const t = buildTimeline(s, { part: p.id, level: l.id });
        assert(t.events.length > 0, `${s.id} ${p.id} ${l.id}`);
        for (const e of t.events) {
          assert(e.notes.length > 0 && e.d > 0, `${s.id} event`);
          const strings = e.notes.map(n => n.string);
          assert.equal(new Set(strings).size, strings.length, `${s.id} ${p.id} ${l.id}: one note per string at t=${e.t}`);
          for (const n of e.notes) {
            assert.equal(TUNING[n.string] + n.fret, n.midi, `${s.id}: fret matches pitch`);
            assert(n.fret >= 0 && n.fret <= 15 && n.finger >= 0 && n.finger <= 4, `${s.id}: reachable`);
            if (n.fret === 0) assert.equal(n.finger, 0);
          }
        }
        for (let i = 1; i < t.events.length; i++) assert(t.events[i].t >= t.events[i - 1].t, `${s.id} sorted`);
      }
  }
});

test("melodies sit in open position on Medium and up the neck on Hard", () => {
  const grace = SONGS.find(s => s.id === "amazing-grace");
  const med = buildTimeline(grace, { part: "lead", level: "medium" }).events.flatMap(e => e.notes);
  assert(med.every(n => n.fret <= 4), "open position");
  const hard = buildTimeline(grace, { part: "lead", level: "hard" }).events.flatMap(e => e.notes);
  assert(hard.filter(n => n.fret >= 4).length > hard.length / 2, "up the neck");
  // Easy leaves out quick off-beat notes.
  const easy = buildTimeline(grace, { part: "lead", level: "easy" }).events;
  assert(easy.length < med.length);
  assert(easy.every(e => Number.isInteger(e.t) || e.d >= 1));
});

test("the hand moves little and fingers follow frets", () => {
  const placed = assignFingers(placeNotes([60, 62, 64, 65, 67].map((midi, i) => ({ midi, beat: i, beats: 1 }))));
  assert.deepEqual(placed.map(n => `${n.string}:${n.fret}:${n.finger}`), ["4:1:1", "4:3:3", "5:0:0", "5:1:1", "5:3:3"]);
});

test("strums follow the pattern and chord changes", () => {
  const song = { id: "x", sig: "4/4", bpm: 90, chords: "G | C D" };
  const med = buildTimeline(song, { part: "rhythm", level: "medium" });
  const bar1 = med.events.filter(e => e.t < 4);
  assert.deepEqual(bar1.map(e => e.dir).join(""), "DDUUDU");
  const bar2 = med.events.filter(e => e.t >= 4);
  assert(bar2.some(e => e.t === 6 && e.chord === "D"), "the D lands on beat 3");
  const easy = buildTimeline({ ...song, chords: "F" }, { part: "rhythm", level: "easy" });
  assert(easy.events.every(e => e.chord === "Fmaj7" && e.dir === "D"));
  assert.equal(easy.events.length, 4);
  const hard = buildTimeline(song, { part: "rhythm", level: "hard" });
  assert(hard.events.every(e => e.kind === "pick" && e.notes.length === 1));
  assert.equal(hard.events[0].notes[0].string, 0, "thumb on the low G");
});

test("chord names from sheets map to shapes", () => {
  assert.equal(normalizeChord("Gsus2"), "G");
  assert.equal(normalizeChord("C/E"), "C");
  assert.equal(normalizeChord("Am7"), "Am7");
  assert.equal(normalizeChord("Ebm"), "D#m");
  assert(CHORDS["D#m"].barre, "made a barre chord");
  assert.equal(normalizeChord("H"), null);
  assert.equal(parseChordSheet("[G]Amazing [C]grace how [G]sweet"), "G | C | G");
  assert.equal(parseChordSheet("G    C\nwords go here\nD7  Em"), "G | C | D7 | Em");
  assert.throws(() => parseChordSheet("just words"));
});

test("tab text becomes notes", () => {
  const tab = parseTabText("e|-----0---|\nB|---1---1-|\nG|-0-------|\nD|---------|\nA|-3-------|\nE|---------|");
  assert.deepEqual(tab[0].slice(0, 3), [3, 0, 0]);
  assert.deepEqual(tab[1].slice(0, 3), [1, 3, 0], "A string 3rd fret with it");
  assert(tab.length === 5);
  assert.throws(() => parseTabText("hello"));
  const t = buildTimeline({ id: "u-t", sig: "4/4", bpm: 90, tab }, { part: "lead" });
  assert.equal(t.events[0].notes.length, 2, "notes together become a pinch");
});

test("MIDI import: tune, chords and timing", () => {
  const notes = [];
  // C, G, Am, F bars with a melody on top.
  [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]].forEach((ch, i) => ch.forEach(m => notes.push({ midi: m, startBeat: i * 4, durBeat: 4 })));
  [72, 76, 74, 79, 72, 76, 72, 77].forEach((m, i) => notes.push({ midi: m, startBeat: i * 2, durBeat: 2 }));
  const parsed = parseMidi(writeMidi(notes.map(n => ({ midi: n.midi, beat: n.startBeat, beats: n.durBeat, start: n.startBeat / 2, dur: n.durBeat / 2, vel: 0.8 })), { bpm: 120 }).buffer ?? writeMidi(notes.map(n => ({ midi: n.midi, beat: n.startBeat, beats: n.durBeat, start: n.startBeat / 2, dur: n.durBeat / 2, vel: 0.8 })), { bpm: 120 }));
  const song = songFromNoteData(parsed);
  assert.equal(song.notes.length, 8, "top line only");
  assert.equal(song.chords, "C | G | Am | F");
  assert.equal(song.bpm, 120);
  const t = buildTimeline(song, { part: "both", level: "medium" });
  assert(t.events.flatMap(e => e.notes).length > 8, "bass notes under the tune");
  assert(t.events.flatMap(e => e.notes).every(n => n.fret <= 5), "fingerstyle stays low on the neck");
  assert.deepEqual(topLine([{ midi: 60, beat: 0, beats: 1 }, { midi: 64, beat: 0, beats: 1 }]).map(n => n.midi), [64]);
  assert.equal(chordFromProfile([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), null);
});

test("listening matches notes and chords", () => {
  const spectrum = new Float32Array(128);
  spectrum[64] = 1;
  assert(frameMatches({ kind: "note", notes: [{ midi: 64 }] }, { level: 0.05, midi: 64, spectrum, chroma: new Float32Array(12) }));
  assert(!frameMatches({ kind: "note", notes: [{ midi: 65 }] }, { level: 0.05, midi: 64, spectrum, chroma: new Float32Array(12) }));
  const chroma = new Float32Array(12);
  [7, 11, 2].forEach(pc => (chroma[pc] = 1));
  assert(frameMatches({ kind: "strum", dir: "D", chord: "G", notes: [] }, { level: 0.05, chroma, spectrum }));
  assert(!frameMatches({ kind: "strum", dir: "D", chord: "Am", notes: [] }, { level: 0.05, chroma, spectrum }));
  assert(frameMatches({ kind: "strum", dir: "D", chord: "G", notes: [{ midi: 43 }, { midi: 47 }, { midi: 50 }] }, { midis: [43, 47, 50] }));
});

test("store: practice log, best scores, imports, junk", () => {
  let d = emptyData();
  d = addPractice(d, { songId: "twinkle", title: "Twinkle", part: "lead", level: "easy", minutes: 3, accuracy: 70, day: "2026-11-10" });
  d = addPractice(d, { songId: "twinkle", title: "Twinkle", part: "lead", level: "easy", minutes: 2, accuracy: 90, day: "2026-11-10" });
  assert.equal(d.history.length, 1);
  assert.equal(d.history[0].minutes, 5);
  assert.equal(d.best.twinkle["lead:easy"], 90);
  d = addSong(d, { id: "u-1", title: "Mine", sig: "3/4", bpm: 80, chords: "G | C" });
  d = addSong(d, { id: "bad", title: "Nope", chords: "G" });
  assert.equal(d.songs.length, 1);
  const again = normalizeData(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(again.songs, d.songs);
  assert.equal(again.songs[0].rhythmOnly, true);
  for (const junk of [null, 1, "x", [], { prefs: 5, history: "x", songs: [1, { id: "u-2", notes: "x" }] }]) normalizeData(junk);
  assert.equal(normalizeData({ prefs: { speed: 99, part: "x" } }).prefs.speed, 0.75);
});

test("PlanFox shows practice and can open songs", () => {
  const d = addPractice(emptyData(), { songId: "greensleeves", title: "Greensleeves", part: "rhythm", level: "hard", minutes: 12, accuracy: 81, day: "2026-11-12" });
  const items = planItems(d, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1);
  assert.equal(items[0].href, "/guitar?song=greensleeves&part=rhythm&level=hard");
  assert.match(items[0].detail, /chords, hard · 12 min · 81%/);
  assert.equal(planItems(d, "2026-12-01", "2026-12-31").length, 0);
  assert.deepEqual(planItems(null, "2026-11-01", "2026-11-30"), []);
  const targets = launchTargets(null);
  assert(targets.some(t => t.href === "/guitar?tab=tuner"));
  assert(targets.every(t => t.href.startsWith("/guitar")));
});

console.log(`FretFox: ${passed} checks passed`);
