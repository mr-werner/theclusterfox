// Every line CalmFox can say, so they can be recorded ahead of time
// (see scripts/calm-voices) and matched to their recordings at play time.
import { sessions } from "./sessions.js";
import { patterns } from "./breathing.js";

export const PREVIEW_LINE = "Take a slow breath in. And let it go, all the way out.";

export function allLines() {
  const lines = new Set([PREVIEW_LINE]);
  for (const s of sessions) {
    for (const line of [...s.opening, ...s.prompts, ...(s.fillers ?? []), ...s.closing]) lines.add(line);
  }
  for (const p of Object.values(patterns)) for (const ph of p.phases) if (ph.cue) lines.add(ph.cue);
  return [...lines];
}

/** FNV-1a over the UTF-8 bytes: a short, stable file name for each line. */
export function lineKey(text) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
