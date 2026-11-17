// Finger colors used everywhere in FretFox: the falling notes, the
// fretboard, the tab and the chord diagrams all agree.
export const FINGER = {
  0: { color: "#efe6d6", name: "Open string" },
  1: { color: "#4da3ff", name: "Index (1)" },
  2: { color: "#3fd17a", name: "Middle (2)" },
  3: { color: "#ffb03b", name: "Ring (3)" },
  4: { color: "#ff5c8a", name: "Pinky (4)" },
};
export const fingerColor = f => FINGER[f]?.color ?? FINGER[0].color;
export const STRING_TINT = ["#c98b5a", "#b98a63", "#a8896d", "#c9c2b3", "#d8d2c6", "#e8e3d8"];
