import { loudness } from "./code.js";

// One AudioContext for the page: it measures how loud the room is and plays
// the alert chime. Browsers only let it run after a tap, so `unlock` is
// called from buttons.

let ctx = null;
export function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlock() {
  const c = audioContext();
  if (c && c.state !== "running") c.resume().catch(() => {});
  return c;
}

/** A loudness reader (0..100) for a stream's sound. `stop()` disconnects it. */
export function meter(stream) {
  const c = audioContext();
  if (!c || !stream?.getAudioTracks().length) return { read: () => null, stop() {} };
  const source = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  return {
    read() {
      if (c.state !== "running") return null;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return loudness(Math.sqrt(sum / buf.length));
    },
    stop() {
      try {
        source.disconnect();
      } catch {
        // already gone
      }
    },
  };
}

/** A soft three-note chime; `urgent` makes it louder and lower, for a lost connection. */
export function chime(urgent = false) {
  const c = unlock();
  if (!c) return;
  const notes = urgent ? [440, 330, 440, 330] : [660, 880, 990];
  const t0 = c.currentTime + 0.02;
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const at = t0 + i * 0.22;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(urgent ? 0.5 : 0.3, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + 0.55);
  });
}
