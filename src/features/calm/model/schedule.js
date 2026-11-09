// Turns a session into a timeline of things to say (and bells to ring),
// spaced to fit the length and prompt frequency the listener picked.

export const GAP = 3; // seconds of quiet after each spoken line

/** A rough estimate of how long the voice takes to say a line. */
export function speakSeconds(text, rate = 1) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / (2.4 * rate) + 0.6;
}

/** Deterministic shuffle so a session plays the same way for a given seed. */
export function shuffle(list, seed = 1) {
  const out = list.slice();
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param session  a session from data/sessions.js
 * @param options  { seconds, interval (seconds, 0 = start and end only), rate, seed, lengthOf }
 *                 lengthOf(text) may return a line's real length in seconds (from a recording), or null to estimate
 * @returns [{ at, kind: "open" | "guide" | "close" | "bell", text?, end }] sorted by `at`
 */
export function buildTimeline(session, { seconds, interval = 60, rate = 1, seed = 1, lengthOf }) {
  const total = Math.max(30, seconds);
  const len = text => lengthOf?.(text) ?? speakSeconds(text, rate);
  const closeGap = session.closingGap ?? GAP;
  const out = [];
  const say = (at, kind, text) => {
    const item = { at: round(at), kind, text, end: round(at + len(text)) };
    out.push(item);
    return item.end + (kind === "close" ? closeGap : GAP);
  };

  if (session.kind === "timer") {
    let t = 0;
    for (const line of session.opening) t = say(Math.max(t, 4), "open", line);
    const closing = session.closing ?? [];
    const closeLen = closing.reduce((sum, line) => sum + len(line) + GAP, 0);
    if (interval > 0) {
      const pool = shuffle(session.prompts ?? [], seed);
      let k = 0;
      for (let at = interval; at < total - 10 - closeLen; at += interval) {
        out.push({ at: round(at), kind: "bell", end: round(at + 4) });
        if (session.voiceTimer && pool.length) {
          const text = pool[k++ % pool.length];
          if (at + 4 + len(text) < total - closeLen - GAP) say(at + 4, "guide", text);
        }
      }
    }
    let c = total - closeLen - 2;
    for (const line of closing) if (c > t) c = say(c, "close", line);
    return out.sort((a, b) => a.at - b.at);
  }

  // Opening, in order, from the start. Short sessions drop lines that won't fit.
  let t = session.kind === "breath" ? 2 : 3;
  for (const line of session.opening) {
    if (t + len(line) > total * 0.45) break;
    t = say(t, "open", line);
  }
  const openEnd = t;

  // Closing: keep as many lines as fit, always ending with the last one.
  let closing = session.closing.slice();
  const closingLength = lines => lines.reduce((sum, line) => sum + len(line) + closeGap, 0);
  while (closing.length && total - closingLength(closing) - 2 < openEnd) closing = closing.slice(1);
  const closeStart = total - closingLength(closing) - 2;

  // The middle.
  const fits = (at, text) => at + len(text) + GAP <= closeStart;
  let last = openEnd; // earliest moment the next line may start
  const place = (at, kind, text) => {
    const start = Math.max(at, last);
    if (!fits(start, text)) return false;
    last = say(start, kind, text);
    return true;
  };

  if (interval > 0) {
    let next;
    if (session.ordered) {
      // Steps play in order. If the chosen interval can't fit them all, they come a little closer together.
      const steps = session.prompts;
      const window = closeStart - openEnd;
      const spacing = Math.min(interval, window / Math.max(1, steps.length));
      next = openEnd + Math.min(spacing, 4);
      for (const step of steps) {
        if (!place(next, "guide", step)) break;
        next = Math.max(next + spacing, last);
      }
      next = Math.max(next - spacing + interval, last);
    } else {
      next = openEnd + interval;
    }
    const pool = shuffle(session.ordered ? (session.fillers ?? []) : session.prompts, seed);
    for (let k = 0; pool.length && next < closeStart; k++) {
      if (!place(next, "guide", pool[k % pool.length])) break;
      next += interval;
    }
  }

  let c = Math.max(closeStart, last);
  for (const line of closing) c = say(c, "close", line);

  return out;
}

function round(n) {
  return Math.round(n * 10) / 10;
}

/** How many lines the voice will say in a timeline. */
export const spokenCount = timeline => timeline.filter(item => item.text).length;
