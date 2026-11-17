// Turn a recording into something playable: the tune (one note at a time)
// plus a guess at the chords under it, beat by beat.
//
// This is a rough transcription. It works well for a clear melody (a voice,
// a solo instrument, a simple piano piece) and gets shakier with full band
// mixes, where the loudest line wins. Same shape as midi.js:
//   { tempo, timeSig, title, tracks: [{ name, notes: [{ midi, start, dur, vel, staff, beat, beats }] }] }

import { freqToMidi } from "./theory.js";

const RATE = 11025; // plenty for melody pitch (up to ~1.5 kHz) and 4x less work than 44.1 kHz
const WIN = 512;
const HOP = 256;
const MIN_F = 65; // C2
const MAX_F = 1400; // ~F6

/** Mix to mono and drop the sample rate to RATE with a simple averaging filter. */
export function toMono(channels, sampleRate) {
  const len = channels[0].length;
  const step = sampleRate / RATE;
  const out = new Float32Array(Math.floor(len / step));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(len, Math.floor((i + 1) * step));
    let s = 0;
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c];
      for (let j = a; j < b; j++) s += ch[j];
    }
    out[i] = s / ((b - a || 1) * channels.length);
  }
  return out;
}

/** YIN pitch for one frame; returns { freq, clarity } or null when unvoiced. */
export function yin(buf, start, rate = RATE, threshold = 0.15) {
  const maxLag = Math.min(WIN, Math.floor(rate / MIN_F));
  const minLag = Math.max(2, Math.floor(rate / MAX_F));
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < WIN; i++) {
      const x = buf[start + i] - buf[start + i + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxLag; tau++) {
    run += d[tau];
    d[tau] = run ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxLag && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  const a = d[tau - 1] ?? d[tau];
  const b = d[tau];
  const c = d[tau + 1] ?? d[tau];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { freq: rate / (tau + (Number.isFinite(shift) ? shift : 0)), clarity: 1 - b };
}

const median = arr => [...arr].sort((x, y) => x - y)[arr.length >> 1];

/** Strength of each semitone midi 36..95 in a slice, by Goertzel. */
function semitoneEnergy(buf, a, b, rate) {
  const out = new Float32Array(60);
  const n = b - a;
  for (let k = 0; k < 60; k++) {
    const f = 440 * 2 ** ((36 + k - 69) / 12);
    const w = (2 * Math.PI * f) / rate;
    const cw = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = a; i < b; i += 1) {
      const s = buf[i] + cw * s1 - s2;
      s2 = s1;
      s1 = s;
    }
    out[k] = (s1 * s1 + s2 * s2 - cw * s1 * s2) / (n * n);
  }
  return out;
}

const CHORDS = [];
for (let root = 0; root < 12; root++) {
  CHORDS.push({ root, quality: "maj", tones: [0, 4, 7].map(i => (root + i) % 12) });
  CHORDS.push({ root, quality: "min", tones: [0, 3, 7].map(i => (root + i) % 12) });
}

/** Guess tempo (beats per minute) from note onsets. */
export function guessTempo(onsets) {
  if (onsets.length < 4) return 100;
  let best = 100;
  let bestScore = -1;
  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const beat = 60 / bpm;
    let score = 0;
    for (const t of onsets) {
      const ph = (t / (beat / 2)) % 1; // eighth-note grid
      score += Math.cos(2 * Math.PI * ph);
    }
    // gentle pull toward common tempos so 2x/0.5x ties go to the middle
    score *= 1 - Math.abs(bpm - 105) / 400;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return best;
}

/**
 * Transcribe. Pass an AudioBuffer (or { numberOfChannels, sampleRate, getChannelData(i) }).
 * onProgress(0..1) is called as it works; it yields to the page between chunks.
 */
export async function audioToNotes(audio, { onProgress, chords = true, maxSeconds = 420 } = {}) {
  const channels = [];
  for (let c = 0; c < Math.min(2, audio.numberOfChannels); c++) channels.push(audio.getChannelData(c).subarray(0, Math.floor(maxSeconds * audio.sampleRate)));
  const buf = toMono(channels, audio.sampleRate);
  const frames = Math.max(0, Math.floor((buf.length - WIN * 2) / HOP));

  // Loudness gate relative to the whole piece.
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const gate = peak * 0.04;

  const pitch = new Array(frames).fill(null);
  const level = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const s = f * HOP;
    let rms = 0;
    for (let i = 0; i < WIN; i++) rms += buf[s + i] * buf[s + i];
    rms = Math.sqrt(rms / WIN);
    level[f] = rms;
    if (rms > gate) {
      const p = yin(buf, s);
      if (p && p.clarity > 0.6) pitch[f] = freqToMidi(p.freq);
    }
    if (f % 400 === 0) {
      onProgress?.(f / frames * 0.85);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Smooth out single-frame octave jumps.
  const smooth = pitch.map((p, i) => {
    if (p == null) return null;
    const win = pitch.slice(Math.max(0, i - 2), i + 3).filter(v => v != null);
    return win.length >= 3 ? median(win) : p;
  });

  // Runs of the same note become notes.
  const sec = HOP / RATE;
  const raw = [];
  let cur = null;
  for (let f = 0; f <= frames; f++) {
    const p = f < frames ? smooth[f] : null;
    if (cur && p === cur.midi) {
      cur.end = f;
      cur.level = Math.max(cur.level, level[f]);
      continue;
    }
    if (cur) raw.push(cur);
    cur = p == null ? null : { midi: p, startF: f, end: f, level: level[f] };
  }
  const notes = [];
  for (const n of raw) {
    const start = n.startF * sec;
    const dur = (n.end - n.startF + 1) * sec;
    const last = notes[notes.length - 1];
    if (last && last.midi === n.midi && start - (last.start + last.dur) < 0.05) {
      last.dur = start + dur - last.start;
      continue;
    }
    if (dur < 0.07) continue;
    notes.push({ midi: n.midi, start, dur, vel: Math.min(1, 0.4 + n.level / (peak || 1)), staff: 1 });
  }

  const tempo = guessTempo(notes.map(n => n.start));
  const beatSec = 60 / tempo;
  for (const n of notes) {
    n.beat = n.start / beatSec;
    n.beats = n.dur / beatSec;
  }

  const tracks = [{ name: "Melody", notes }];

  if (chords && notes.length) {
    const chordNotes = [];
    const total = buf.length / RATE;
    const barSec = beatSec * 2; // a chord every two beats
    let prev = null;
    for (let t = 0, i = 0; t + barSec <= total; t += barSec, i++) {
      const e = semitoneEnergy(buf, Math.floor(t * RATE), Math.floor((t + barSec) * RATE), RATE);
      const chroma = new Float32Array(12);
      for (let k = 0; k < 60; k++) chroma[(36 + k) % 12] += e[k];
      const sum = chroma.reduce((a, b) => a + b, 0);
      if (sum <= 0) continue;
      let best = null;
      let bestScore = 0;
      for (const c of CHORDS) {
        const s = (chroma[c.tones[0]] * 1.2 + chroma[c.tones[1]] + chroma[c.tones[2]]) / sum;
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }
      if (!best || bestScore < 0.45) {
        prev = null;
        continue;
      }
      const beat = (t / beatSec);
      const name = `${best.root}${best.quality}`;
      if (prev && prev.name === name) {
        for (const n of prev.notes) {
          n.dur += barSec;
          n.beats += 2;
        }
        continue;
      }
      const root = 48 + best.root; // C3 octave
      const voicing = [root - 12, root, root + (best.quality === "maj" ? 4 : 3), root + 7];
      const made = voicing.map(midi => ({ midi, start: t, dur: barSec, vel: 0.55, staff: 2, beat, beats: 2 }));
      chordNotes.push(...made);
      prev = { name, notes: made };
      if (i % 20 === 0) {
        onProgress?.(0.85 + (t / total) * 0.15);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (chordNotes.length) tracks.push({ name: "Chords", notes: chordNotes });
  }
  onProgress?.(1);
  return { title: null, tempo, timeSig: [4, 4], tracks };
}
