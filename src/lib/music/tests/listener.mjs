// The note listener: hears a key the moment it's struck, once, and never
// mistakes a ringing note, an overtone, a neighbour or room noise for one.
// Feeds made-up piano audio through the same frame analysis the mic uses.
import assert from 'node:assert/strict';
import { createFrameAnalyzer, detectPitch, tuningFromPitches } from '../pitch.js';
import { createNoteListener, selfSounds } from '../listener.js';

const RATE = 48000;
const N = 8192;
const HOP = 1200; // 25 ms, like startMic

// --- made-up audio ---------------------------------------------------------
const hz = m => 440 * 2 ** ((m - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;

/**
 * notes: [{ midi, at (s), amp, tau }], noise amplitude. Like a piano: each
 * strike starts with a short hammer knock, and striking a key again restarts
 * its string rather than adding a second one.
 */
function render(seconds, notes, noise = 0.002) {
  const out = new Float32Array(Math.ceil(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = noise * rand();
  for (const [idx, { midi, at, amp = 0.25, tau = 1.2, cents = 0 }] of notes.entries()) {
    const f = hz(midi + cents / 100);
    const start = Math.floor(at * RATE);
    const again = notes.find((x, j) => j > idx && x.midi === midi && x.at > at);
    const stop = again ? Math.floor(again.at * RATE) : out.length;
    // Piano-ish: overtones fading with number, low notes weak at the fundamental.
    const partials = [1, 2, 3, 4, 5, 6].map(k => ({ k, a: (midi < 48 && k === 1 ? 0.35 : 1) / k }));
    for (let i = start; i < Math.min(stop, out.length); i++) {
      const t = (i - start) / RATE;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / tau) * Math.min(1, (stop - i) / 240);
      if (t > 0.01 && env < 1e-4) break;
      let v = 0;
      for (const { k, a } of partials) if (f * k < RATE / 2) v += a * Math.sin(2 * Math.PI * f * k * t);
      // The hammer: a few milliseconds of knock.
      if (t < 0.006) v += 0.8 * rand() * (1 - t / 0.006);
      out[i] += amp * env * v * 0.5;
    }
  }
  return out;
}

// --- a small FFT (Blackman window, like the browser's analyser) -------------
const win = Float32Array.from({ length: N }, (_, i) => 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N));
const rev = new Uint32Array(N);
for (let i = 0, bits = Math.log2(N); i < N; i++) {
  let r = 0;
  for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
  rev[i] = r;
}
function mags(frame) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[rev[i]] = frame[i] * win[i];
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2;
    const step = (-2 * Math.PI) / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < half; j++) {
        const c = Math.cos(step * j);
        const s = Math.sin(step * j);
        const a = i + j;
        const b = a + half;
        const tr = re[b] * c - im[b] * s;
        const ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  const out = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) out[k] = Math.hypot(re[k], im[k]) / N;
  return out;
}

/** Runs audio through the analyser and listener. expectedAt(t, heardSoFar) -> midis. Returns [{ t, midi }]. */
function listen(audio, expectedAt, { selfAt = () => ({}), quietAt = () => false, tuning = 0 } = {}) {
  const analyze = createFrameAnalyzer({ sampleRate: RATE, fftSize: N, minFreq: 26, maxFreq: 4200, tuning });
  const listener = createNoteListener();
  const heard = [];
  const buf = new Float32Array(N);
  for (let end = HOP; end <= audio.length; end += HOP) {
    buf.fill(0);
    const from = Math.max(0, end - N);
    buf.set(audio.subarray(from, end), N - (end - from));
    const t = end / RATE;
    const frame = analyze(buf, mags(buf));
    for (const m of listener.update(frame, expectedAt(t, heard), { ...selfAt(t), quiet: quietAt(t) })) heard.push({ t, midi: m });
  }
  return heard;
}
const midis = h => h.map(x => x.midi);

// Room noise alone: nothing, however long it waits.
assert.deepEqual(listen(render(2, [], 0.01), () => [60]), [], 'noise is not a note');

// One C, ringing on while the song asks for C again: counted once, promptly.
{
  const h = listen(render(2.5, [{ midi: 60, at: 0.5 }]), () => [60]);
  assert.deepEqual(midis(h), [60], `one strike, one note (${JSON.stringify(h)})`);
  assert(h[0].t >= 0.5 && h[0].t < 0.62, `heard quickly (${h[0].t})`);
}

// The same key struck again while the first is still ringing: two notes.
{
  const h = listen(render(2.5, [{ midi: 60, at: 0.5 }, { midi: 60, at: 1.3 }]), () => [60]);
  assert.deepEqual(midis(h), [60, 60], `repeated note (${JSON.stringify(h)})`);
  assert(h[1].t >= 1.3 && h[1].t < 1.42, `second strike heard on time (${h[1].t})`);
}

// A quick repeat (a quarter note apart at 120 bpm).
{
  const h = listen(render(1.6, [{ midi: 67, at: 0.4 }, { midi: 67, at: 0.9 }]), () => [67]);
  assert.deepEqual(midis(h), [67, 67], `quick repeat (${JSON.stringify(h)})`);
}

// C rings while the song now wants E: no E until E is played.
{
  const h = listen(render(2.2, [{ midi: 60, at: 0.3 }, { midi: 64, at: 1.4 }]), t => (t < 0.9 ? [60] : [64]));
  assert.deepEqual(midis(h), [60, 64], `next note waits (${JSON.stringify(h)})`);
  assert(h[1].t >= 1.4, 'E only after E is played');
}

// Overtones of a ringing note aren't the note an octave or a fifth up.
for (const next of [72, 67, 79]) {
  const h = listen(render(2, [{ midi: 60, at: 0.3 }]), t => (t < 0.8 ? [60] : [next]));
  assert.deepEqual(midis(h), [60], `C4 ringing is not ${next}`);
}

// The song asks for the same note an octave (or a fifth) away the moment
// the first one counts: the first one ringing on is not it, either way.
{
  const seq = tune => (t, heard) => (heard.length < tune.length ? [tune[heard.length]] : []);
  for (const [a, b] of [[60, 72], [60, 48], [72, 60], [48, 60], [48, 36], [36, 48], [55, 67], [60, 79]]) {
    for (const amp of [0.15, 0.5]) {
      const alone = listen(render(2.2, [{ midi: a, at: 0.4, amp, tau: 2.5 }]), seq([a, b]));
      assert.deepEqual(midis(alone), [a], `${a} ringing is not ${b} (${JSON.stringify(alone)})`);
    }
    // ...and when it is played, it counts, even soon after.
    for (const gap of [0.2, 0.8]) {
      const h = listen(render(2.2, [{ midi: a, at: 0.4, tau: 2.5 }, { midi: b, at: 0.4 + gap, tau: 2.5 }]), seq([a, b]));
      assert.deepEqual(midis(h), [a, b], `${a} then ${b}, ${gap}s apart (${JSON.stringify(h)})`);
      assert(h[1].t >= 0.4 + gap && h[1].t < 0.4 + gap + 0.3, `${b} heard when played (${h[1].t})`);
    }
  }
}

// A key struck while another still rings: its attack counts for it, not
// for the ringing one when the song asks for that again.
for (const tune of [[60, 67, 60, 67], [48, 36, 48, 36], [60, 64, 60, 64]]) {
  const notes = tune.map((midi, i) => ({ midi, at: 0.5 + 0.35 * i, tau: 2.5, amp: 0.2 }));
  const h = listen(render(2.6, notes, 0.004), (t, heard) => (heard.length < tune.length ? [tune[heard.length]] : []));
  assert.deepEqual(midis(h), tune, `${tune} (${JSON.stringify(h)})`);
  h.forEach((x, i) => assert(x.t >= notes[i].at && x.t < notes[i].at + 0.3, `${tune} note ${i} on time (${x.t} vs ${notes[i].at})`));
}

// Octaves played together are a chord: both count.
for (const ch of [[48, 60], [60, 72], [36, 48, 55]]) {
  const h = listen(render(1.5, ch.map(midi => ({ midi, at: 0.4, amp: 0.15 }))), () => ch);
  assert.deepEqual(midis(h).sort(), [...ch].sort(), `octave chord ${ch} (${JSON.stringify(h)})`);
}

// The key next door is a wrong note, not the right one.
assert.deepEqual(listen(render(1.5, [{ midi: 61, at: 0.4 }]), () => [62]), [], 'C# is not D');
assert.deepEqual(listen(render(1.5, [{ midi: 64, at: 0.4 }]), () => [62]), [], 'E is not D');

// A chord: every note in it.
{
  const h = listen(render(1.5, [60, 64, 67].map(midi => ({ midi, at: 0.4, amp: 0.15 }))), () => [60, 64, 67]);
  assert.deepEqual(midis(h).sort(), [60, 64, 67], `chord (${JSON.stringify(h)})`);
}

// Low notes, carried by their overtones.
for (const low of [36, 43]) {
  const h = listen(render(1.6, [{ midi: low, at: 0.4, amp: 0.4 }]), () => [low]);
  assert.deepEqual(midis(h), [low], `low ${low} (${JSON.stringify(h)})`);
}

// A long run of notes ringing into each other, the song following along
// (wait mode: each note is asked for once the one before it is heard).
{
  const tune = [60, 62, 64, 65, 67, 67, 69, 67, 65, 64, 64, 62, 60, 62, 64, 60, 60, 67, 72, 67];
  const notes = tune.map((midi, i) => ({ midi, at: 0.5 + 0.7 * i, tau: 2.5, amp: 0.2 }));
  const h = listen(render(15.5, notes, 0.004), (t, heard) => (heard.length < tune.length ? [tune[heard.length]] : []));
  assert.deepEqual(midis(h), tune, `long legato run (${JSON.stringify(h)})`);
  h.forEach((x, i) => assert(x.t >= notes[i].at && x.t < notes[i].at + 0.45, `note ${i} on time (${x.t} vs ${notes[i].at})`));
}

// A noisy room: the note still counts, the noise still doesn't.
{
  const h = listen(render(2.5, [{ midi: 65, at: 1.4 }], 0.03), () => [65]);
  assert.deepEqual(midis(h), [65], `note in a noisy room (${JSON.stringify(h)})`);
  assert(h[0].t >= 1.4, 'not before it was played');
}

// A soft note in a quiet room still counts.
assert.deepEqual(midis(listen(render(1.5, [{ midi: 72, at: 0.4, amp: 0.05 }], 0.001), () => [72])), [72], 'soft note');

// The other hand, played by the app through the speakers, isn't you.
{
  const sounds = [{ midi: 55, at: 400, until: 1400 }];
  const h = listen(render(1.6, [{ midi: 55, at: 0.4 }]), () => [55, 67], { selfAt: t => selfSounds(sounds, t * 1000) });
  assert.deepEqual(h, [], `app's own note ignored (${JSON.stringify(h)})`);
}
{
  // ...but you playing over it still counts.
  const sounds = [{ midi: 48, at: 400, until: 1400 }];
  const h = listen(render(1.6, [{ midi: 48, at: 0.4 }, { midi: 64, at: 0.9 }]), () => [64], { selfAt: t => selfSounds(sounds, t * 1000) });
  assert.deepEqual(midis(h), [64], `you over the app (${JSON.stringify(h)})`);
}

// You answer the app's left hand an octave up, right after it starts
// (both hands on the same beat): still counted, if a moment late.
{
  const sounds = [{ midi: 55, at: 400, until: 2400 }];
  const h = listen(render(2, [{ midi: 55, at: 0.4, amp: 0.12 }, { midi: 67, at: 0.6 }]), () => [67], { selfAt: t => selfSounds(sounds, t * 1000) });
  assert.deepEqual(midis(h), [67], `octave over the app (${JSON.stringify(h)})`);
  assert(h[0].t < 1.0, `not too late (${h[0].t})`);
}

// A metronome-like click (broadband tick) isn't a note.
{
  const audio = render(1.5, [], 0.002);
  for (const at of [0.3, 0.8, 1.3]) for (let i = 0; i < 200; i++) audio[Math.floor(at * RATE) + i] += 0.5 * rand() * Math.exp(-i / 40);
  assert.deepEqual(listen(audio, () => [60, 64]), [], 'clicks are not notes');
}

// An old piano, 70 cents flat: its C sounds nearer to B. Tuned to it, the
// listener hears C again.
{
  const flat = tune => tune.map(midi => ({ midi, at: 0.4 + 0.8 * tune.indexOf(midi), cents: -70 }));
  const audio = render(2.2, flat([60, 64]));
  const seq = (t, heard) => (heard.length === 0 ? [60] : heard.length === 1 ? [64] : []);
  assert.notDeepEqual(midis(listen(audio, seq)), [60, 64], 'out of tune: missed without calibrating');
  assert.deepEqual(midis(listen(audio, seq, { tuning: -70 })), [60, 64], 'calibrated: heard');
}

// Working the tuning out from middle C (or any C) ringing.
{
  const audio = render(1.5, [{ midi: 48, at: 0.1, cents: -70, amp: 0.4 }]);
  const small = new Float32Array(N / 4);
  const freqs = [];
  for (let end = 0.3 * RATE; end + N <= audio.length; end += HOP) {
    for (let i = 0; i < small.length; i++) small[i] = (audio[end + i * 4] + audio[end + i * 4 + 1] + audio[end + i * 4 + 2] + audio[end + i * 4 + 3]) / 4;
    const p = detectPitch(small, RATE / 4, { minFreq: 26, maxFreq: 4200 });
    if (p && p.clarity > 0.9) freqs.push(p.freq);
  }
  const c = tuningFromPitches(freqs, 60);
  assert(c != null && Math.abs(c + 70) <= 3, `measured ${c} cents`);
  assert.equal(tuningFromPitches([261.6, 300, 220, 250, 280, 240, 262, 290, 230], 60), null, 'a wobble is not a tuning');
  assert.equal(tuningFromPitches([261.6, 261.7], 60), null, 'too few readings');
  assert.equal(tuningFromPitches(Array(10).fill(hz(72 + 0.15)), 60), 15, 'an octave up counts');
}

console.log('listener ok');
