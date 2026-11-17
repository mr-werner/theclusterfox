// A small Web Audio instrument shared by the music apps: a soft piano-like
// tone and a plucked string, no samples to download.
//
//   const synth = createSynth({ voice: "piano" })
//   synth.playNote(60, 0.5)          // middle C for half a second, now
//   synth.playNote(64, 0.5, synth.now() + 0.25, 0.7)
//   synth.noteOn(67); synth.noteOff(67)
//   synth.strum([40, 45, 50, 55, 59, 64], synth.now(), { down: true, spread: 0.02 })
import { midiToFreq } from "./theory.js";

let sharedCtx = null;
export function audioContext() {
  const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctx) return null;
  sharedCtx ??= new Ctx();
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

const VOICES = {
  // Partials and how fast each fades; low notes ring longer.
  piano: { partials: [1, 0.55, 0.28, 0.16, 0.08, 0.05], attack: 0.004, decay: m => 2.6 - (m - 21) / 60, release: 0.25, bright: 3200 },
  pluck: { partials: [1, 0.7, 0.45, 0.3, 0.18, 0.1, 0.06], attack: 0.002, decay: m => 1.9 - (m - 28) / 80, release: 0.12, bright: 2600 },
  soft: { partials: [1, 0.25, 0.08], attack: 0.03, decay: () => 3.2, release: 0.4, bright: 1800 },
};

export function createSynth({ voice = "piano", volume = 0.6 } = {}) {
  const ctx = audioContext();
  if (!ctx) {
    const noop = () => {};
    return { now: () => 0, playNote: noop, noteOn: noop, noteOff: noop, strum: noop, click: noop, setVolume: noop, stopAll: noop, ctx: null };
  }
  const out = ctx.createGain();
  out.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  out.connect(comp).connect(ctx.destination);
  const held = new Map();
  const live = new Set();
  let v = VOICES[voice] ?? VOICES.piano;

  function voiceAt(midi, when, vel) {
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(16000, v.bright * (0.5 + vel));
    g.connect(lp).connect(out);
    const peak = 0.22 * vel * (midi < 48 ? 1.15 : 1);
    const decay = Math.max(0.5, v.decay(midi));
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + v.attack);
    g.gain.setTargetAtTime(peak * 0.25, when + v.attack, decay * 0.18);
    g.gain.setTargetAtTime(0.0001, when + v.attack + decay * 0.3, decay * 0.5);
    const oscs = v.partials.map((amp, i) => {
      const fr = f * (i + 1) * (1 + 0.0004 * i * i);
      if (fr > 18000) return null;
      const o = ctx.createOscillator();
      o.frequency.value = fr;
      const pg = ctx.createGain();
      pg.gain.value = amp / (1 + i * 0.15);
      // Upper partials die faster, like a real string.
      pg.gain.setTargetAtTime(0, when + 0.01, decay * (0.4 / (i + 1)));
      o.connect(pg).connect(g);
      o.start(when);
      return o;
    }).filter(Boolean);
    const node = { g, oscs };
    live.add(node);
    return node;
  }

  function release(node, at) {
    const t = Math.max(at, ctx.currentTime);
    node.g.gain.cancelScheduledValues(t);
    node.g.gain.setTargetAtTime(0.0001, t, v.release / 3);
    for (const o of node.oscs) o.stop(t + v.release * 2);
    setTimeout(() => live.delete(node), (t - ctx.currentTime + v.release * 2) * 1000 + 50);
  }

  return {
    ctx,
    now: () => ctx.currentTime,
    setVoice(name) {
      v = VOICES[name] ?? v;
    },
    setVolume(x) {
      out.gain.value = x;
    },
    playNote(midi, dur = 0.5, when = ctx.currentTime, vel = 0.8) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const node = voiceAt(midi, Math.max(when, ctx.currentTime), vel);
      release(node, Math.max(when, ctx.currentTime) + Math.max(0.05, dur));
    },
    noteOn(midi, vel = 0.8) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (held.has(midi)) release(held.get(midi), ctx.currentTime);
      held.set(midi, voiceAt(midi, ctx.currentTime, vel));
    },
    noteOff(midi) {
      const node = held.get(midi);
      if (!node) return;
      held.delete(midi);
      release(node, ctx.currentTime);
    },
    strum(midis, when = ctx.currentTime, { down = true, spread = 0.025, dur = 1.2, vel = 0.75 } = {}) {
      const order = down ? [...midis] : [...midis].reverse();
      order.forEach((m, i) => this.playNote(m, dur, when + i * spread, vel * (1 - i * 0.03)));
    },
    /** A metronome tick; accent for beat one. */
    click(when = ctx.currentTime, accent = false) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = accent ? 1760 : 1175;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      o.connect(g).connect(out);
      o.start(when);
      o.stop(when + 0.08);
    },
    stopAll() {
      for (const node of [...live]) release(node, ctx.currentTime);
      held.clear();
    },
  };
}
