// Plays a light pattern on a loop. Timing is kept against the clock, so
// small delays don't add up and a long message stays in step.

export function createPlayer(listener) {
  let onChange = listener ?? (() => {});
  let timer = null;
  let segments = [];
  let index = 0;
  let due = 0;
  let loop = true;
  let running = false;
  let onEnd = null;

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function step() {
    if (!running) return;
    if (index >= segments.length) {
      if (!loop) {
        stop();
        onEnd?.();
        return;
      }
      index = 0;
    }
    const seg = segments[index];
    onChange({ on: seg.on, at: seg.at ?? null, index });
    index += 1;
    if (!Number.isFinite(seg.ms)) return; // steady: stay here until stopped
    due += seg.ms;
    // If the tab was asleep and we fell far behind, start fresh from now.
    if (now() - due > 2000) due = now() + seg.ms;
    timer = setTimeout(step, Math.max(0, due - now()));
  }

  function start(next, options = {}) {
    stop();
    segments = next.filter(s => s.ms > 0);
    if (!segments.length) return;
    loop = options.loop !== false;
    onEnd = options.onEnd ?? null;
    index = 0;
    running = true;
    due = now();
    step();
  }

  function stop() {
    const was = running;
    running = false;
    clearTimeout(timer);
    timer = null;
    if (was) onChange({ on: false, at: null, index: -1 });
  }

  /** Swap who hears the light changes. Returns a function that unhooks it. */
  function listen(fn) {
    onChange = fn;
    return () => {
      if (onChange === fn) onChange = () => {};
    };
  }

  return { start, stop, listen, isRunning: () => running };
}
