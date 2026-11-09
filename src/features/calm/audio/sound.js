// Bells, breath tones and ambient soundscapes, all made in the browser with the
// Web Audio API. No audio files to download.

let ctx = null;
const buffers = {};

export const audioSupported = typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);

/** Create or wake the audio context. Call from a tap first (browsers require it). */
export function audio() {
  if (!audioSupported) return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** A singing-bowl style bell. */
export function bell({ volume = 0.5, pitch = 196 } = {}) {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const now = ac.currentTime + 0.02;
  const out = ac.createGain();
  out.gain.value = volume * 0.5;
  out.connect(ac.destination);
  // Partials of a bowl are not whole-number multiples, which gives the shimmer.
  const partials = [
    [1, 1, 7],
    [2.01, 0.45, 5],
    [2.76, 0.35, 4],
    [5.4, 0.12, 2.5],
    [8.93, 0.05, 1.5],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = pitch * ratio;
    // A slight wobble, as a real bowl has.
    osc.detune.setValueAtTime(0, now);
    osc.detune.linearRampToValueAtTime(4, now + decay);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + decay + 0.1);
  }
}

/** A soft tone marking a breath phase: rising for in, falling for out, level for holds. */
export function breathTone(type, { volume = 0.5 } = {}) {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const now = ac.currentTime + 0.02;
  const [from, to] = { in: [262, 330], out: [330, 247], hold: [294, 294], rest: [247, 247] }[type] ?? [294, 294];
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + 0.7);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12 * volume, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 1.2);
}

function noise(ac, color) {
  if (buffers[color]) return buffers[color];
  const length = ac.sampleRate * 8;
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    // Cross-fade the ends so the loop point can't be heard.
    const fade = Math.floor(ac.sampleRate * 0.5);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      data[i] = data[i] * k + data[length - fade + i] * (1 - k);
    }
  }
  buffers[color] = buffer;
  return buffer;
}

function loop(ac, buffer) {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopEnd = buffer.duration - 0.5;
  return src;
}

function lfo(ac, rate, depth, target) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.value = rate;
  g.gain.value = depth;
  osc.connect(g).connect(target);
  osc.start();
  return osc;
}

/**
 * Start a looping soundscape. Returns { setVolume, stop(fadeSeconds) }.
 * Types: rain, ocean, brown, drone.
 */
export function startAmbient(type, volume = 0.35) {
  const ac = audio();
  if (!ac || type === "none") return null;
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(volume, ac.currentTime + 3);
  master.connect(ac.destination);
  const nodes = [];

  if (type === "rain") {
    const src = loop(ac, noise(ac, "pink"));
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 500;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.value = 0.9;
    src.connect(hp).connect(lp).connect(g).connect(master);
    nodes.push(src, lfo(ac, 0.13, 0.12, g.gain));
    src.start();
  } else if (type === "ocean") {
    const src = loop(ac, noise(ac, "brown"));
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ac.createGain();
    g.gain.value = 0.55;
    src.connect(lp).connect(g).connect(master);
    // Waves: the volume and brightness swell roughly every 9 seconds.
    nodes.push(src, lfo(ac, 0.11, 0.45, g.gain), lfo(ac, 0.11, 450, lp.frequency));
    src.start();
  } else if (type === "brown") {
    const src = loop(ac, noise(ac, "brown"));
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    src.connect(lp).connect(master);
    nodes.push(src);
    src.start();
  } else if (type === "drone") {
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = ac.createGain();
    g.gain.value = 0.18;
    lp.connect(g).connect(master);
    for (const [freq, level] of [
      [110, 1],
      [110.6, 0.8],
      [164.8, 0.5],
      [220.4, 0.3],
      [329.6, 0.12],
    ]) {
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      og.gain.value = level;
      osc.connect(og).connect(lp);
      osc.start();
      nodes.push(osc);
    }
    nodes.push(lfo(ac, 0.05, 0.06, g.gain), lfo(ac, 0.03, 250, lp.frequency));
  }

  let stopped = false;
  return {
    setVolume(v) {
      if (stopped) return;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(v, ac.currentTime, 0.2);
    },
    stop(fade = 1.5) {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => {
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            // already stopped
          }
        }
        master.disconnect();
      }, fade * 1000 + 100);
    },
  };
}
