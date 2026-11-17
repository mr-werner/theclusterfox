// Listening through the microphone, shared by the music apps.
//
//   const stop = await startMic({ onFrame })
//
// onFrame is called about 40 times a second with
//   { midi, freq, cents, clarity, level, onset, spectrum, chroma }
// midi/freq: the strongest single pitch (YIN), null when nothing clear.
// spectrum: Float32Array(128), energy near each MIDI note (0..1 of the frame's peak).
// chroma: Float32Array(12), the same folded into pitch classes C..B.
// onset: true on the frame a new note was struck (a jump in loudness).
//
// For chords, use notesPresent(frame, expectedMidis): a microphone can't
// reliably list every note in a chord, but it can tell whether the notes
// you're supposed to be playing are sounding.
import { freqToMidi } from "./theory.js";
import { yin } from "./audioToNotes.js";

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

/** Fold an FFT magnitude array (linear) into energy per MIDI note and per pitch class. */
export function spectrumToNotes(mags, sampleRate, fftSize) {
  const spectrum = new Float32Array(128);
  const binHz = sampleRate / fftSize;
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
  return { spectrum, chroma };
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
 * Start listening. Options: onFrame (required), minFreq (default 38 Hz, low
 * enough for bass), maxFreq (2000 Hz), deviceId. Resolves to stop().
 */
export async function startMic({ onFrame, onError, minFreq = 38, maxFreq = 2000, deviceId } = {}) {
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
  // Decimate to ~12 kHz before YIN so low notes stay cheap to find.
  const factor = Math.max(1, Math.floor(ctx.sampleRate / 12000));
  const small = new Float32Array(Math.floor(time.length / factor));
  let lastLevel = 0;
  let running = true;
  let timer = null;

  const tick = () => {
    if (!running) return;
    try {
      analyser.getFloatTimeDomainData(time);
      let sum = 0;
      for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
      const level = Math.sqrt(sum / time.length);
      for (let i = 0; i < small.length; i++) {
        let s = 0;
        for (let j = 0; j < factor; j++) s += time[i * factor + j];
        small[i] = s / factor;
      }
      const p = level > 0.003 ? detectPitch(small, ctx.sampleRate / factor, { minFreq, maxFreq }) : null;
      analyser.getFloatFrequencyData(freqDb);
      for (let i = 0; i < freqDb.length; i++) mags[i] = 10 ** (freqDb[i] / 20);
      const { spectrum, chroma } = spectrumToNotes(mags, ctx.sampleRate, analyser.fftSize);
      const midiF = p ? freqToMidi(p.freq, false) : null;
      const onset = level > 0.006 && level > lastLevel * 1.6;
      lastLevel = lastLevel * 0.6 + level * 0.4;
      onFrame?.({
        midi: p && p.clarity > 0.7 ? Math.round(midiF) : null,
        freq: p?.freq ?? null,
        cents: p ? Math.round((midiF - Math.round(midiF)) * 100) : null,
        clarity: p?.clarity ?? 0,
        level,
        onset,
        spectrum,
        chroma,
        time: ctx.currentTime,
      });
    } catch (err) {
      onError?.(err);
    }
    timer = setTimeout(tick, 25);
  };
  tick();

  return () => {
    running = false;
    clearTimeout(timer);
    stream.getTracks().forEach(t => t.stop());
    ctx.close().catch(() => {});
  };
}

/** Microphones the page may use (labels appear after permission is granted). */
export async function listMics() {
  if (!micSupported()) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === "audioinput").map(d => ({ id: d.deviceId, name: d.label || "Microphone" }));
}
