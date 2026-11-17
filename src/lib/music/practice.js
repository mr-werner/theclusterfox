// Practice helpers shared by the music apps: slowing a song down, looping a
// section, and deciding whether what you played matches what was written.

/** Song time (seconds at full speed) after `elapsed` real seconds at `speed` (0.25–2). */
export const songTime = (elapsed, speed) => elapsed * speed;

/** Clamp a time into a loop [a, b); returns the wrapped time. */
export function wrapLoop(t, loop) {
  if (!loop || !(loop.b > loop.a)) return t;
  if (t < loop.a) return loop.a;
  const len = loop.b - loop.a;
  return loop.a + ((t - loop.a) % len);
}

/**
 * Match a note you just played against the notes due around timeSec.
 * expected: [{ id, midi, start }]; already-hit notes should be left out.
 * Returns { hit: note | null, offset: seconds early(-)/late(+), grade: "perfect" | "good" | "ok" | "miss" }.
 */
export function judge(expected, heardMidi, timeSec, windowSec = 0.25) {
  let best = null;
  for (const n of expected) {
    if (n.midi !== heardMidi) continue;
    const off = timeSec - n.start;
    if (Math.abs(off) > windowSec) continue;
    if (!best || Math.abs(off) < Math.abs(best.offset)) best = { hit: n, offset: off };
  }
  if (!best) return { hit: null, offset: 0, grade: "miss" };
  const a = Math.abs(best.offset) / windowSec;
  return { ...best, grade: a < 0.3 ? "perfect" : a < 0.65 ? "good" : "ok" };
}

/** Accuracy 0–100 from counts. */
export const accuracy = ({ hit = 0, missed = 0, wrong = 0 }) => {
  const total = hit + missed + wrong * 0.5;
  return total ? Math.round((hit / total) * 100) : 0;
};

/** Stars 0–3 for an accuracy. */
export const stars = acc => (acc >= 95 ? 3 : acc >= 80 ? 2 : acc >= 60 ? 1 : 0);
