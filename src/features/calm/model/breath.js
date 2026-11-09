// Where we are in a breathing pattern at a given moment.

export function cycleSeconds(pattern, pace = 1) {
  return pattern.phases.reduce((sum, p) => sum + p.sec, 0) * pace;
}

const ease = p => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)));

/**
 * @param pattern  from data/breathing.js
 * @param t        seconds since the breathing started
 * @param pace     1 = as written, 1.25 = 25% slower
 * @returns { cycle, index, phase, progress (0..1), remaining (s), level (0 empty .. 1 full) }
 */
export function breathAt(pattern, t, pace = 1) {
  const length = cycleSeconds(pattern, pace);
  const time = Math.max(0, t);
  const cycle = Math.floor(time / length);
  let r = time - cycle * length;
  let level = 0;
  for (let index = 0; index < pattern.phases.length; index++) {
    const phase = pattern.phases[index];
    const dur = phase.sec * pace;
    const to = phase.type === "in" || phase.type === "out" ? phase.to : level;
    if (r < dur || index === pattern.phases.length - 1) {
      const progress = Math.min(1, r / dur);
      return {
        cycle,
        index,
        phase,
        progress,
        remaining: Math.max(0, dur - r),
        level: level + (to - level) * ease(progress),
      };
    }
    r -= dur;
    level = to;
  }
  return null;
}
