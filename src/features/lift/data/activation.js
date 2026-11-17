// How hard each muscle works during a movement, for the red muscle demos.
//
// Each entry names a muscle the way the demo shows it, the LiftFox group it
// belongs to, a regex that finds its parts in the BodyFox 3D model, and how
// hard it works at the hardest point of the rep (0 to 1). The numbers are
// rounded from surface EMG studies of the push-up (as a share of each
// muscle's max effort), so they show which muscles lead, not exact values.
//
// "mover" muscles change with the rep: they work hardest at the bottom and
// while pressing up. "brace" muscles hold the body straight the whole time.

export const MOVEMENTS = {
  pushup: {
    name: "Push-up",
    // One rep: lower for 40%, hold the bottom 10%, press for 30%, rest at the top 20%.
    cycleMs: 3400,
    muscles: [
      { id: "pecMajor", name: "Chest", detail: "Pectoralis major", group: "chest", role: "mover", peak: 0.95, match: /pectoralis major/ },
      { id: "triceps", name: "Triceps", detail: "Triceps brachii", group: "triceps", role: "mover", peak: 0.85, match: /triceps brachii|anconeus/ },
      { id: "frontDelt", name: "Front shoulder", detail: "Anterior deltoid", group: "shoulders", role: "mover", peak: 0.8, match: /clavicular part of (left|right) deltoid/ },
      { id: "serratus", name: "Serratus", detail: "Serratus anterior", group: "chest", role: "mover", peak: 0.6, match: /serratus anterior/ },
      { id: "pecMinor", name: "Pec minor", detail: "Pectoralis minor", group: "chest", role: "mover", peak: 0.45, match: /pectoralis minor/ },
      { id: "abs", name: "Abs", detail: "Rectus abdominis", group: "abs", role: "brace", peak: 0.45, match: /rectus abdominis|transversus abdominis|pyramidalis/ },
      { id: "obliques", name: "Obliques", detail: "External and internal obliques", group: "obliques", role: "brace", peak: 0.35, match: /(external|internal) oblique/ },
      { id: "sideDelt", name: "Side shoulder", detail: "Lateral deltoid", group: "shoulders", role: "mover", peak: 0.3, match: /acromial part of (left|right) deltoid/ },
      { id: "quads", name: "Quads", detail: "Quadriceps", group: "quads", role: "brace", peak: 0.3, match: /rectus femoris|vastus/ },
      { id: "forearms", name: "Forearms", detail: "Wrist and finger muscles", group: "forearms", role: "brace", peak: 0.25, match: /carpi|digitorum superficialis|digitorum profundus|brachioradialis|pronator|palmaris/ },
      { id: "glutes", name: "Glutes", detail: "Gluteus maximus and medius", group: "glutes", role: "brace", peak: 0.22, match: /gluteus (maximus|medius)/ },
      { id: "traps", name: "Traps", detail: "Trapezius and rhomboids", group: "traps", role: "brace", peak: 0.2, match: /trapezius|rhomboid/ },
      { id: "biceps", name: "Biceps", detail: "Biceps brachii", group: "biceps", role: "brace", peak: 0.12, match: /biceps brachii|brachialis/ },
      { id: "lowerBack", name: "Lower back", detail: "Erector spinae", group: "lowerBack", role: "brace", peak: 0.1, match: /iliocostalis|longissimus|spinalis|multifidus/ },
      { id: "lats", name: "Lats", detail: "Latissimus dorsi", group: "lats", role: "brace", peak: 0.12, match: /latissimus|teres major/ },
    ],
  },
};

export const movementFor = exercise => (exercise?.demo && MOVEMENTS[exercise.demo]) || null;

const ease = v => (1 - Math.cos(Math.PI * v)) / 2;

/**
 * Where in the rep we are, from the time since it started.
 * depth: 0 at the top, 1 at the bottom. pressing: true on the way up.
 */
export function repAt(ms, cycleMs) {
  const x = (((ms % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  if (x < 0.4) return { depth: ease(x / 0.4), pressing: false, label: "Lowering" };
  if (x < 0.5) return { depth: 1, pressing: false, label: "Bottom" };
  if (x < 0.8) return { depth: 1 - ease((x - 0.5) / 0.3), pressing: true, label: "Pressing up" };
  return { depth: 0, pressing: false, label: "Top" };
}

/** How hard one muscle works at this point in the rep, 0 to 1. */
export function effort(muscle, { depth, pressing }) {
  if (muscle.role === "brace") return muscle.peak * (0.82 + 0.18 * depth);
  // Movers: lighter at the top, hardest at the bottom and while pressing.
  const push = pressing ? 1 : 0.8;
  return muscle.peak * (0.3 + 0.7 * depth * push + (pressing ? 0.12 * (1 - depth) : 0));
}

/** Effort for every muscle in a movement, by id. */
export function efforts(movement, rep) {
  const out = {};
  for (const m of movement.muscles) out[m.id] = Math.min(1, effort(m, rep));
  return out;
}

/** The muscle a 3D part belongs to in this movement, or null. */
export function muscleForPart(movement, partName) {
  const n = partName.toLowerCase();
  return movement.muscles.find(m => m.match.test(n)) ?? null;
}

// Grey at rest, then deeper red the harder a muscle works.
const REST = [199, 194, 191];
const STOPS = [
  [0.15, REST],
  [0.3, [219, 153, 140]],
  [0.5, [237, 77, 51]],
  [0.75, [219, 18, 15]],
  [1, [153, 0, 10]],
];

/** The colour for an effort level, as [r, g, b] 0–255. */
export function effortRgb(level) {
  const v = Math.max(0, Math.min(1, level));
  if (v <= STOPS[0][0]) return REST;
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    const [a, ca] = STOPS[i - 1];
    if (v <= b) {
      const t = (v - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export const effortCss = level => `rgb(${effortRgb(level).join(" ")})`;
