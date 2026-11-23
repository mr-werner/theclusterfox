// A Morse tone that follows the light, for when someone can hear you
// before they can see you.

export function createTone() {
  let ctx = null;
  let gain = null;
  let osc = null;

  function ensure() {
    if (ctx) return true;
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 880;
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 2400;
    osc.connect(soften).connect(gain).connect(ctx.destination);
    osc.start();
    return true;
  }

  return {
    // Call from a tap so the browser lets sound play.
    unlock() {
      if (ensure() && ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    set(on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(on ? 0.35 : 0, t, 0.004);
    },
    close() {
      if (!ctx) return;
      ctx.close().catch(() => {});
      ctx = null;
    },
  };
}
