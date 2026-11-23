// KeysFox: songs add up, arrangements thin out, the engine judges fairly.
import assert from 'node:assert/strict';
import { SONGS, songById, CATEGORIES } from '../data/songs.js';
import { arrange, barCount, barAt, fromImport, keyRange, songBeats, LEVELS } from '../model/song.js';
import { Engine, starsFor } from '../model/engine.js';
import { layoutStaff } from '../model/notation.js';
import { planItems, launchTargets } from '../model/planLink.js';
import { normalizeData, addRun, emptyData } from '../state/keysStore.js';
import { parseMidi, writeMidi } from '../../../lib/music/midi.js';

assert(SONGS.length >= 15);
assert.equal(new Set(SONGS.map(s => s.id)).size, SONGS.length);
const cats = new Set(CATEGORIES.map(c => c.id));
for (const s of SONGS) {
  assert(s.tags.every(t => cats.has(t)), `${s.id} categories`);
  assert(s.notes.length > 10, `${s.id} has notes`);
  for (const h of ['R', 'L']) assert(s.notes.some(n => n.hand === h), `${s.id} ${h} hand`);
  const ends = ['R', 'L'].map(h => Math.max(...s.notes.filter(n => n.hand === h).map(n => n.t + n.d)));
  assert(Math.abs(ends[0] - ends[1]) <= 1, `${s.id} hands end together (${ends})`);
  const [lo, hi] = keyRange(s);
  assert(s.notes.every(n => n.midi >= lo && n.midi <= hi));
  assert(barCount(s) >= 4);
  // Each level is playable, and easier levels have fewer notes.
  const counts = LEVELS.map(l => arrange(s, l.id).notes.length);
  assert(counts[0] <= counts[1] && counts[1] <= counts[2], `${s.id} levels ${counts}`);
  assert(counts[0] > 0);
  const easy = arrange(s, 'easy');
  const onsetsR = new Map();
  for (const n of easy.notes.filter(n => n.hand === 'R')) onsetsR.set(n.t, (onsetsR.get(n.t) ?? 0) + 1);
  assert([...onsetsR.values()].every(c => c === 1), `${s.id} easy right hand is one note at a time`);
  // Sheet music lays out without throwing and puts every note somewhere.
  for (const hand of ['R', 'L']) {
    const staff = layoutStaff(s, hand);
    assert(staff.heads.length >= s.notes.filter(n => n.hand === hand).length, `${s.id} ${hand} heads`);
    assert(staff.heads.every(h => Number.isFinite(h.pos) && Number.isFinite(h.x)));
  }
}
assert.equal(barAt(songById.get('happy-birthday'), 0.5), 0, 'pickup bar');
assert.equal(barAt(songById.get('happy-birthday'), 1), 1);

// Playing a song perfectly in both modes.
for (const id of ['twinkle', 'fur-elise', 'prelude-c']) {
  const song = songById.get(id);
  for (const mode of ['wait', 'play']) {
    const eng = new Engine(song, { mode, hands: 'both' });
    let guard = 0;
    const dt = 1 / 120;
    while (!eng.finished && guard++ < 200000) {
      eng.tick(dt);
      for (const n of eng.expected()) if (Math.abs(n.t - eng.beat) < 0.02 || (mode === 'wait' && eng.waiting)) eng.press(n.midi);
    }
    assert(eng.finished, `${id} ${mode} finishes`);
    const st = eng.stats();
    assert.equal(st.hit, st.total, `${id} ${mode}: all ${st.total} hit (missed ${st.missed})`);
    assert.equal(starsFor(st), 3);
  }
}
// Not playing in play mode misses everything; the other hand plays itself.
{
  const eng = new Engine(songById.get('mary'), { mode: 'play', hands: 'R' });
  let autos = 0;
  while (!eng.finished) for (const e of eng.tick(0.02)) if (e.type === 'auto') autos++;
  assert.equal(autos, songById.get('mary').notes.filter(n => n.hand === 'L').length);
  assert.equal(eng.stats().hit, 0);
  assert.equal(eng.stats().missed, eng.stats().total);
}
// Wait mode never moves past an unplayed note, and wrong keys count.
{
  const eng = new Engine(songById.get('twinkle'), { mode: 'wait', hands: 'R' });
  for (let i = 0; i < 600; i++) eng.tick(0.02);
  assert.equal(eng.beat, 0, 'waits on the first note');
  assert.equal(eng.press(61).type, 'wrong');
  assert.equal(eng.press(60).type, 'hit');
  for (let i = 0; i < 100; i++) eng.tick(0.02);
  assert.equal(eng.beat, 1);
}
// Looping bars.
{
  const eng = new Engine(songById.get('ode-to-joy'), { mode: 'play', loop: { a: 4, b: 8 }, countIn: 0 });
  let loops = 0;
  for (let i = 0; i < 500 && loops < 2; i++) for (const e of eng.tick(0.05)) if (e.type === 'loop') loops++;
  assert.equal(loops, 2);
  assert(eng.beat >= 4 && eng.beat < 8);
}

// Importing a MIDI file.
{
  const notes = [];
  for (let i = 0; i < 16; i++) notes.push({ midi: 72 + (i % 5), beat: i * 0.5, beats: 0.5 });
  for (let i = 0; i < 4; i++) notes.push({ midi: 48, beat: i * 2, beats: 2 });
  const song = fromImport(parseMidi(writeMidi(notes, { bpm: 96 })), { title: 'Test' });
  assert.equal(song.bpm, 96);
  assert.equal(song.notes.filter(n => n.hand === 'L').length, 4);
  assert.equal(song.notes.filter(n => n.hand === 'R').length, 16);
  assert.equal(songBeats(song), 8);
}

// Saved data and TaskFox.
{
  let data = emptyData();
  data = addRun(data, { songId: 'twinkle', level: 'easy', hands: 'R', mode: 'wait', speed: 0.75, accuracy: 92, stars: 2, seconds: 95, day: '2026-11-10' });
  data = addRun(data, { songId: 'twinkle', level: 'easy', hands: 'R', mode: 'play', speed: 1, accuracy: 97, stars: 3, seconds: 60, day: '2026-11-10' });
  data = normalizeData(JSON.parse(JSON.stringify(data)));
  assert.equal(data.best['twinkle:easy:R'].stars, 3);
  const items = planItems(data, '2026-11-01', '2026-11-30');
  assert.equal(items.length, 1);
  assert.equal(items[0].day, '2026-11-10');
  assert(items[0].href.startsWith('/piano?song=twinkle'));
  assert.deepEqual(planItems(null, '2026-11-01', '2026-11-30'), []);
  for (const junk of [{}, 'x', 42, [], { history: 'x' }]) normalizeData(junk);
  const targets = launchTargets();
  assert(targets.length >= SONGS.length);
}

console.log('keysfox ok');
