// The shared music library: file readers round-trip, pitch finding hits the note.
import assert from 'node:assert/strict';
import { noteName, parseNote, midiToFreq, freqToMidi, isBlack } from '../theory.js';
import { parseMidi, writeMidi } from '../midi.js';
import { parseMusicXml } from '../musicXml.js';
import { detectPitch, notesPresent, spectrumToNotes } from '../pitch.js';
import { audioToNotes } from '../audioToNotes.js';
import { judge, wrapLoop, accuracy, stars } from '../practice.js';

assert.equal(noteName(60), 'C4');
assert.equal(noteName(61, { flats: true }), 'D♭4');
assert.equal(parseNote('F#3'), 54);
assert.equal(parseNote('Bb2'), 46);
assert.equal(freqToMidi(midiToFreq(33)), 33);
assert(isBlack(61) && !isBlack(60));

// MIDI round trip.
const tune = [60, 62, 64, 65, 67].map((midi, i) => ({ midi, beat: i, beats: 1, vel: 0.8 }));
tune.push({ midi: 48, beat: 0, beats: 4, vel: 0.6 });
const song = parseMidi(writeMidi(tune, { bpm: 90 }));
assert.equal(song.tempo, 90);
const notes = song.tracks.flatMap(t => t.notes);
assert.equal(notes.length, 6);
const e = notes.find(n => n.midi === 64);
assert.equal(e.beat, 2);
assert(Math.abs(e.start - 2 * 60 / 90) < 1e-6);
assert.throws(() => parseMidi(new Uint8Array([1, 2, 3, 4]).buffer));

// MusicXML: two staves, a chord, a tie and a backup.
const xml = `<?xml version="1.0"?><!DOCTYPE score-partwise><score-partwise version="3.1">
<work><work-title>Test &amp; tune</work-title></work>
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
<direction><sound tempo="60"/></direction>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><chord/><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>4</duration><tie type="start"/><staff>1</staff></note>
<backup><duration>6</duration></backup>
<note><pitch><step>C</step><octave>3</octave></pitch><duration>6</duration><staff>2</staff></note>
</measure><measure number="2">
<note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><tie type="stop"/><staff>1</staff></note>
<note><rest/><duration>4</duration></note>
</measure></part></score-partwise>`;
const sx = parseMusicXml(xml);
assert.equal(sx.title, 'Test & tune');
assert.deepEqual(sx.timeSig, [3, 4]);
assert.equal(sx.tempo, 60);
const xn = sx.tracks[0].notes;
assert.equal(xn.length, 4, 'tie merged');
const fs = xn.find(n => n.midi === 78);
assert.equal(fs.beat, 1);
assert.equal(fs.beats, 3, 'tied across the bar');
assert.equal(xn.find(n => n.midi === 48).staff, 2);
assert.equal(xn.find(n => n.midi === 76).beat, 0, 'chord note starts with its partner');

// Pitch: a pure tone and a low bass note.
const sine = (f, rate, n) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f * i) / rate) + 0.3 * Math.sin((4 * Math.PI * f * i) / rate));
for (const m of [40, 57, 69, 84, 31]) {
  const p = detectPitch(sine(midiToFreq(m), 12000, 1024), 12000);
  assert.equal(freqToMidi(p.freq), m, `finds ${noteName(m)}`);
}
// Chord presence from a spectrum.
const mags = new Float32Array(4096);
for (const m of [60, 64, 67]) mags[Math.round(midiToFreq(m) / (48000 / 8192))] = 1;
const frame = { ...spectrumToNotes(mags, 48000, 8192), level: 0.1, midi: null };
const heard = notesPresent(frame, [60, 64, 67, 62]);
assert.deepEqual([...heard].sort(), [60, 64, 67]);

// Transcribing a recording of a scale.
{
  const rate = 22050;
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  const len = 0.5 * rate;
  const data = new Float32Array(scale.length * len);
  scale.forEach((m, k) => {
    const f = midiToFreq(m);
    for (let i = 0; i < len; i++) data[k * len + i] = Math.exp(-i / rate * 2) * (Math.sin((2 * Math.PI * f * i) / rate) + 0.4 * Math.sin((4 * Math.PI * f * i) / rate)) * (i > len - 200 ? 0 : 1);
  });
  const buf = { numberOfChannels: 1, sampleRate: rate, getChannelData: () => data };
  const out = await audioToNotes(buf, { chords: false });
  assert.deepEqual(out.tracks[0].notes.map(n => n.midi), scale, 'scale transcribed');
}

// Judging.
const due = [{ id: 'a', midi: 60, start: 1 }, { id: 'b', midi: 62, start: 1.5 }];
assert.equal(judge(due, 60, 1.02).grade, 'perfect');
assert.equal(judge(due, 60, 1.2).grade, 'ok');
assert.equal(judge(due, 61, 1).grade, 'miss');
assert.equal(wrapLoop(5.5, { a: 2, b: 4 }), 3.5);
assert.equal(accuracy({ hit: 9, missed: 1 }), 90);
assert.equal(stars(96), 3);

console.log('music lib ok');
