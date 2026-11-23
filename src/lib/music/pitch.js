// Listening through the microphone, shared by the music apps.
//
//   const stop = await startMic({ onFrame })
//
// onFrame is called about 40 times a second with
//   { midi, freq, cents, clarity, level, onset, attack, spectrum, peak, chroma }
// midi/freq: the strongest single pitch (YIN), null when nothing clear.
// spectrum: Float32Array(128), energy near each MIDI note (0..1 of the frame's peak).
// chroma: Float32Array(12), the same folded into pitch classes C..B.
// onset: true on the frame a new note was struck (a jump in loudness).
// attack: how sharply the last ~25 ms got louder than the moment before (1 = steady).
// peak: the spectrum's scale, so spectrum[m] * peak compares across frames.
//
// An instrument that isn't at standard pitch: pass tuning (cents) to
// startMic, or call stop.setTuning(cents) later; tuningFromPitches() works it
// out from a known note.
//
// To follow a player note by note (and tell a new key press from one still
// ringing), feed frames to createNoteListener() from ./listener.js.
//
// For chords, use notesPresent(frame, expectedMidis): a microphone can't
// reliably list every note in a chord, but it can tell whether the notes
// you're supposed to be playing are sounding.
import { freqToMidi } from "./theory.js";

export const micSupported = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/** YIN on a time-domain buffer at an arbitrary rate, searching minFreq..maxFreq. */
export function detectPitch(buf, rate, { minFreq = 38, maxFreq = 2000, threshold = 0.15 } = {}) {
  const maxLag = Math.min(Math.floor(buf.length / 2), Math.floor(rate / minFreq));
  const minLag = Math.max(2, Math.floor(rate / maxFreq));
  const w = buf.length - maxLag;
  if (w < 32) return null;
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < w; i++) {
      const x = buf[i] - buf[i + tau];
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
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxLag && d[t + 1] < d[t]) t++;
      const a = d[t - 1];
      const b = d[t];
      const c = d[t + 1] ?? b;
      const den = a - 2 * b + c;
      const shift = den ? (a - c) / (2 * den) : 0;
      return { freq: rate / (t + shift), clarity: 1 - b };
    }
  }
  return null;
}

/**
 * Fold an FFT magnitude array (linear) into energy per MIDI note and per
 * pitch class. tuning (cents) shifts the note boundaries for an instrument
 * that isn't at standard pitch.
 */
export function spectrumToNotes(mags, sampleRate, fftSize, tuning = 0) {
  const spectrum = new Float32Array(128);
  // tuning: how many cents the instrument sits above standard pitch (A = 440).
  const binHz = (sampleRate / fftSize) * 2 ** (-tuning / 1200);
  for (let k = 1; k < mags.length; k++) {
    const m = freqToMidi(k * binHz);
    if (m == null || m < 0 || m > 127) continue;
    spectrum[m] = Math.max(spectrum[m], mags[k]);
  }
  let peak = 0;
  for (let i = 0; i < 128; i++) peak = Math.max(peak, spectrum[i]);
  const chroma = new Float32Array(12);
  if (peak > 0) {
    for (let i = 0; i < 128; i++) {
      spectrum[i] /= peak;
      if (i >= 28 && i <= 100) chroma[i % 12] += spectrum[i];
    }
    const cmax = Math.max(...chroma);
    if (cmax > 0) for (let i = 0; i < 12; i++) chroma[i] /= cmax;
  }
  return { spectrum, chroma, peak };
}

/**
 * Which of the expected notes are sounding in this frame. A note counts when
 * its fundamental (or, for low notes, its second harmonic) stands out.
 * Returns a Set of the midis heard.
 */
export function notesPresent(frame, expected, { min = 0.22 } = {}) {
  const heard = new Set();
  if (!frame?.spectrum || frame.level < 0.004) return heard;
  const s = frame.spectrum;
  for (const m of expected) {
    const fund = s[m] ?? 0;
    const second = s[m + 12] ?? 0;
    const score = m < 48 ? Math.max(fund, second * 0.9) : Math.max(fund, second * 0.6);
    if (score >= min || (frame.midi != null && (frame.midi === m || frame.midi === m + 12))) heard.add(m);
  }
  return heard;
}

/**
 * Turns one block of microphone samples (and its FFT magnitudes) into a
 * frame. Kept apart from startMic so tests can feed it made-up audio.
 * Call it about every 25 ms with the latest fftSize samples.
 */
export function createFrameAnalyzer({ sampleRate, fftSize, minFreq = 38, maxFreq = 2000, tuning = 0 }) {
  // Decimate to ~12 kHz before YIN so low notes stay cheap to find.
  const factor = Math.max(1, Math.floor(sampleRate / 12000));
  const small = new Float32Array(Math.floor(fftSize / factor));
  // The newest ~25 ms (one frame), to catch the moment a key is struck. The full window
  // is long (for low notes) and smears attacks out over a few frames.
  const recentN = Math.min(fftSize, Math.round(sampleRate * 0.025));
  let lastLevel = 0;
  let recentAvg = 0;
  // Bright band (1.5–8 kHz): a hammer, pick or pluck lights it up for a
  // moment even when the notes already ringing are louder overall.
  const binHz = sampleRate / fftSize;
  const hiFrom = Math.round(1500 / binHz);
  const hiTo = Math.min(Math.round(8000 / binHz), fftSize / 2 - 1);
  let hiPrev = null;

  const analyze = (time, mags) => {
    let sum = 0;
    for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
    const level = Math.sqrt(sum / time.length);
    let rs = 0;
    for (let i = time.length - recentN; i < time.length; i++) rs += time[i] * time[i];
    const recent = Math.sqrt(rs / recentN);
    let attack = recent > 0.004 ? recent / Math.max(recentAvg, 0.002) : 1;
    recentAvg = recentAvg * 0.5 + recent * 0.5;
    // Spectral flux in the bright band, as a ratio like the loudness one.
    let hi = 0;
    for (let k = hiFrom; k <= hiTo; k++) hi += mags[k];
    if (hiPrev != null && hi > 0 && level > 0.004) {
      let up = 0;
      for (let k = hiFrom; k <= hiTo; k++) up += Math.max(0, mags[k] - hiPrev[k - hiFrom]);
      attack = Math.max(attack, 1 + up / Math.max(hi - up, 1e-12));
    }
    hiPrev ??= new Float32Array(hiTo - hiFrom + 1);
    for (let k = hiFrom; k <= hiTo; k++) hiPrev[k - hiFrom] = mags[k];
    for (let i = 0; i < small.length; i++) {
      let s = 0;
      for (let j = 0; j < factor; j++) s += time[i * factor + j];
      small[i] = s / factor;
    }
    const p = level > 0.003 ? detectPitch(small, sampleRate / factor, { minFreq, maxFreq }) : null;
    const { spectrum, chroma, peak } = spectrumToNotes(mags, sampleRate, fftSize, tuning);
    const midiF = p ? freqToMidi(p.freq, false) - tuning / 100 : null;
    const onset = level > 0.006 && level > lastLevel * 1.6;
    lastLevel = lastLevel * 0.6 + level * 0.4;
    return {
      midi: p && p.clarity > 0.7 ? Math.round(midiF) : null,
      freq: p?.freq ?? null,
      cents: p ? Math.round((midiF - Math.round(midiF)) * 100) : null,
      clarity: p?.clarity ?? 0,
      level,
      onset,
      attack,
      spectrum,
      peak,
      chroma,
    };
  };
  /** Listen in an instrument's own tuning (cents above standard pitch). */
  analyze.setTuning = cents => {
    tuning = Number.isFinite(cents) ? cents : 0;
  };
  return analyze;
}

/**
 * Start listening. Options: onFrame (required), minFreq (default 38 Hz, low
 * enough for bass), maxFreq (2000 Hz), deviceId. Resolves to stop().
 */
export async function startMic({ onFrame, onError, minFreq = 38, maxFreq = 2000, deviceId, tuning = 0 } = {}) {
  if (!micSupported()) throw new Error("This browser can't use the microphone.");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);

  const time = new Float32Array(analyser.fftSize);
  const freqDb = new Float32Array(analyser.frequencyBinCount);
  const mags = new Float32Array(analyser.frequencyBinCount);
  const analyze = createFrameAnalyzer({ sampleRate: ctx.sampleRate, fftSize: analyser.fftSize, minFreq, maxFreq, tuning });
  let running = true;
  let timer = null;

  const tick = () => {
    if (!running) return;
    try {
      analyser.getFloatTimeDomainData(time);
      analyser.getFloatFrequencyData(freqDb);
      for (let i = 0; i < freqDb.length; i++) mags[i] = 10 ** (freqDb[i] / 20);
      onFrame?.({ ...analyze(time, mags), time: ctx.currentTime });
    } catch (err) {
      onError?.(err);
    }
    timer = setTimeout(tick, 25);
  };
  tick();

  const stop = () => {
    running = false;
    clearTimeout(timer);
    stream.getTracks().forEach(t => t.stop());
    ctx.close().catch(() => {});
  };
  stop.setTuning = analyze.setTuning;
  return stop;
}

/**
 * How far an instrument sits from standard pitch, in cents (+ sharp, − flat),
 * from pitches heard while one known note rings (any octave of target).
 * freqs: Hz of clear frames. Returns null when there aren't enough steady
 * readings to trust.
 */
export function tuningFromPitches(freqs, target = 60, { min = 8 } = {}) {
  const cents = [];
  for (const f of freqs) {
    if (!(f > 0)) continue;
    let c = (freqToMidi(f, false) - target) * 100;
    c -= Math.round(c / 1200) * 1200; // any octave of the note
    if (Math.abs(c) <= 150) cents.push(c);
  }
  if (cents.length < min) return null;
  cents.sort((a, b) => a - b);
  const q = i => cents[Math.min(cents.length - 1, Math.floor(i * cents.length))];
  if (q(0.75) - q(0.25) > 25) return null; // wobbling: not one steady note
  return Math.round(q(0.5));
}

/** Microphones the page may use (labels appear after permission is granted). */
export async function listMics() {
  if (!micSupported()) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === "audioinput").map(d => ({ id: d.deviceId, name: d.label || "Microphone" }));
}
