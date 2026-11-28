// Little sounds made on the fly, so nothing has to download. Phones only
// allow sound after a tap, so the first tap in the game unlocks it.
let ctx = null;

export function unlockSound() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, start, length, type = "sine", gain = 0.2) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + length);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + length + 0.05);
}

export function tickSound() {
  tone(880, 0, 0.08, "square", 0.08);
}

export function buzz() {
  tone(180, 0, 0.6, "sawtooth", 0.25);
  tone(140, 0.05, 0.6, "sawtooth", 0.2);
  try {
    navigator.vibrate?.([300, 100, 300]);
  } catch {
    // no vibration here
  }
}
