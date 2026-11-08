// Breathing patterns. Each phase moves the "breath level" (0 = empty, 1 = full)
// toward `to` over `sec` seconds. Holds keep the level where it is.
// `cue` is what the voice says at the start of the phase.

export const PHASE_TYPES = ["in", "hold", "out", "rest"];

export const patterns = {
  box: {
    id: "box",
    name: "Box",
    phases: [
      { type: "in", sec: 4, to: 1, label: "Breathe in", cue: "Breathe in" },
      { type: "hold", sec: 4, label: "Hold", cue: "Hold" },
      { type: "out", sec: 4, to: 0, label: "Breathe out", cue: "Breathe out" },
      { type: "rest", sec: 4, label: "Hold empty", cue: "Hold" },
    ],
  },
  relax478: {
    id: "relax478",
    name: "4-7-8",
    phases: [
      { type: "in", sec: 4, to: 1, label: "Breathe in", cue: "Breathe in through your nose" },
      { type: "hold", sec: 7, label: "Hold", cue: "Hold" },
      { type: "out", sec: 8, to: 0, label: "Breathe out", cue: "Slowly out" },
    ],
  },
  coherent: {
    id: "coherent",
    name: "Steady rhythm",
    phases: [
      { type: "in", sec: 5.5, to: 1, label: "Breathe in", cue: "In" },
      { type: "out", sec: 5.5, to: 0, label: "Breathe out", cue: "Out" },
    ],
  },
  sigh: {
    id: "sigh",
    name: "Double sigh",
    phases: [
      { type: "in", sec: 2.5, to: 0.75, label: "Breathe in", cue: "Breathe in" },
      { type: "in", sec: 1, to: 1, label: "Sip in more", cue: "A little more" },
      { type: "out", sec: 6, to: 0, label: "Long sigh out", cue: "Long sigh out" },
      { type: "rest", sec: 2, label: "Rest", cue: "Rest" },
    ],
  },
  longExhale: {
    id: "longExhale",
    name: "Longer exhale",
    phases: [
      { type: "in", sec: 4, to: 1, label: "Breathe in", cue: "Breathe in" },
      { type: "out", sec: 6, to: 0, label: "Breathe out", cue: "Breathe out slowly" },
    ],
  },
  rising: {
    id: "rising",
    name: "Rising breath",
    phases: [
      { type: "in", sec: 3, to: 1, label: "Breathe in fully", cue: "Breathe in" },
      { type: "hold", sec: 1, label: "Hold", cue: "Hold" },
      { type: "out", sec: 2, to: 0, label: "Let it go", cue: "Out" },
    ],
  },
  // Meditations show a slow, uncued "breathing light" to rest the eyes on.
  natural: {
    id: "natural",
    name: "Natural",
    phases: [
      { type: "in", sec: 4.5, to: 1, label: "", cue: "" },
      { type: "out", sec: 6.5, to: 0, label: "", cue: "" },
    ],
  },
};

/** "In 4 · Hold 7 · Out 8" */
export function describePattern(pattern, pace = 1) {
  const short = { in: "In", hold: "Hold", out: "Out", rest: "Rest" };
  const fmt = n => String(Math.round(n * 10) / 10);
  return pattern.phases.map(p => `${short[p.type]} ${fmt(p.sec * pace)}`).join(" · ");
}
