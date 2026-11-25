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

// The push-up's muscles. Its variants below start from these and change how
// hard each one works.
const PUSHUP_MUSCLES = [
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
  { id: "calves", name: "Calves", detail: "Gastrocnemius and soleus", group: "calves", role: "brace", peak: 0.15, match: /gastrocnemius|soleus/ },
  { id: "hamstrings", name: "Hamstrings", detail: "Back of the thigh", group: "hamstrings", role: "brace", peak: 0.1, match: /biceps femoris|semitendinosus|semimembranosus/ },
  { id: "lowerBack", name: "Lower back", detail: "Erector spinae", group: "lowerBack", role: "brace", peak: 0.1, match: /iliocostalis|longissimus|spinalis|multifidus/ },
  { id: "lats", name: "Lats", detail: "Latissimus dorsi", group: "lats", role: "brace", peak: 0.12, match: /latissimus|teres major/ },
];

// A push-up variant: the same muscles with some peaks changed. A muscle set
// to 0 drops out of the list.
function variantOf(muscles, peaks, roles = {}) {
  return muscles
    .map(m => ({ ...m, peak: peaks[m.id] ?? m.peak, role: roles[m.id] ?? m.role }))
    .filter(m => m.peak > 0);
}

export const MOVEMENTS = {
  pushup: {
    name: "Push-up",
    // Which body rig poses it: see anatomy3d/rigs.js (3D) and
    // components/MotionDemo.jsx (2D). Variants can share a rig and pass
    // rigOptions (hand height, hand width, ...).
    rig: "pushup",
    // One rep: lower for 40%, hold the bottom 10%, press for 30%, rest at the top 20%.
    cycleMs: 3400,
    muscles: PUSHUP_MUSCLES,
  },

  // Hands on a bench about 45 cm high. Less of your weight is on your hands
  // (about 40% of body weight against 65% on the floor, Suprak 2011), so every
  // pressing muscle works less; surface EMG drops by roughly a quarter to a third.
  inclinePushup: {
    name: "Incline push-up",
    rig: "pushup",
    rigOptions: { handHeight: 0.45 },
    cycleMs: 3400,
    muscles: variantOf(PUSHUP_MUSCLES, {
      pecMajor: 0.7, triceps: 0.6, frontDelt: 0.55, serratus: 0.45, pecMinor: 0.32,
      abs: 0.3, obliques: 0.25, sideDelt: 0.22, quads: 0.2, forearms: 0.18, glutes: 0.15,
    }),
  },

  // Feet on a bench about 45 cm high. More weight on the hands (about 70% of
  // body weight) and the press tips toward overhead, so the front shoulder and
  // the upper chest pick up work. Peaks are estimates scaled from the push-up.
  declinePushup: {
    name: "Decline push-up",
    rig: "pushup",
    rigOptions: { footHeight: 0.45 },
    cycleMs: 3400,
    muscles: variantOf(PUSHUP_MUSCLES, {
      pecMajor: 0.92, triceps: 0.88, frontDelt: 0.92, serratus: 0.7, pecMinor: 0.5,
      abs: 0.5, obliques: 0.4, sideDelt: 0.4, traps: 0.28, glutes: 0.25, quads: 0.25, calves: 0.1,
    }),
  },

  // Hands together under the chest. A narrow base raises triceps and chest
  // activity over the normal hand width (Cogley et al. 2005); the elbows stay
  // tucked, so the side shoulder does less.
  diamondPushup: {
    name: "Diamond push-up",
    rig: "pushup",
    rigOptions: { handWidth: -0.105, handForward: -0.1, flare: 0.2, handTurn: -1.1 },
    cycleMs: 3400,
    muscles: variantOf(PUSHUP_MUSCLES, {
      triceps: 0.95, pecMajor: 0.92, frontDelt: 0.78, serratus: 0.62, pecMinor: 0.48,
      sideDelt: 0.2, forearms: 0.3,
    }),
  },

  // Hips high, head down between the hands: an upside-down shoulder press.
  // Little published EMG, so these are conservative estimates: the shoulders
  // and triceps lead, the upper traps and serratus turn the shoulder blades
  // up, and the chest does less than in a push-up.
  pikePushup: {
    name: "Pike push-up",
    rig: "pushup",
    rigOptions: { pike: true },
    cycleMs: 3400,
    muscles: variantOf(PUSHUP_MUSCLES, {
      frontDelt: 0.88, triceps: 0.82, sideDelt: 0.55, serratus: 0.62, traps: 0.5,
      pecMajor: 0.42, pecMinor: 0.25, abs: 0.3, obliques: 0.2, forearms: 0.3,
      quads: 0.2, glutes: 0.1, hamstrings: 0.15, calves: 0.2, lats: 0.1, lowerBack: 0.12, biceps: 0.1,
    }, { traps: "mover" }),
  },

  // A forearm plank: a hold, so every muscle braces. Surface EMG puts the abs
  // and obliques at about 30–50% of their max (Escamilla et al. 2006;
  // Calatayud et al. 2017); squeezing the glutes, as the tip says, adds to them.
  plank: {
    name: "Plank",
    rig: "pushup",
    rigOptions: { forearms: true, handWidth: -0.05, handTurn: -0.35 },
    hold: 0,
    cycleMs: 4000,
    muscles: [
      { id: "abs", name: "Abs", detail: "Rectus abdominis and transversus", group: "abs", role: "brace", peak: 0.5, match: /rectus abdominis|transversus abdominis|pyramidalis/ },
      { id: "obliques", name: "Obliques", detail: "External and internal obliques", group: "obliques", role: "brace", peak: 0.45, match: /(external|internal) oblique/ },
      { id: "frontDelt", name: "Front shoulder", detail: "Anterior deltoid", group: "shoulders", role: "brace", peak: 0.35, match: /clavicular part of (left|right) deltoid/ },
      { id: "quads", name: "Quads", detail: "Quadriceps", group: "quads", role: "brace", peak: 0.3, match: /rectus femoris|vastus/ },
      { id: "glutes", name: "Glutes", detail: "Gluteus maximus and medius", group: "glutes", role: "brace", peak: 0.3, match: /gluteus (maximus|medius)/ },
      { id: "serratus", name: "Serratus", detail: "Serratus anterior", group: "chest", role: "brace", peak: 0.3, match: /serratus anterior/ },
      { id: "pecMajor", name: "Chest", detail: "Pectoralis major", group: "chest", role: "brace", peak: 0.2, match: /pectoralis major/ },
      { id: "traps", name: "Traps", detail: "Trapezius and rhomboids", group: "traps", role: "brace", peak: 0.2, match: /trapezius|rhomboid/ },
      { id: "lats", name: "Lats", detail: "Latissimus dorsi", group: "lats", role: "brace", peak: 0.15, match: /latissimus|teres major/ },
      { id: "calves", name: "Calves", detail: "Gastrocnemius and soleus", group: "calves", role: "brace", peak: 0.15, match: /gastrocnemius|soleus/ },
      { id: "forearms", name: "Forearms", detail: "Wrist and finger muscles", group: "forearms", role: "brace", peak: 0.12, match: /carpi|digitorum superficialis|digitorum profundus|brachioradialis|pronator|palmaris/ },
      { id: "lowerBack", name: "Lower back", detail: "Erector spinae", group: "lowerBack", role: "brace", peak: 0.1, match: /iliocostalis|longissimus|spinalis|multifidus/ },
    ],
  },
};

// Which exercises have muscle data so far. New ones are added five a day,
// in the order of data/muscleViewQueue.js.
export const BY_EXERCISE = {
  "push-up": "pushup",
  "incline-push-up": "inclinePushup",
  "decline-push-up": "declinePushup",
  "diamond-push-up": "diamondPushup",
  "pike-push-up": "pikePushup",
  plank: "plank",
};
export const movementFor = exercise => MOVEMENTS[BY_EXERCISE[exercise?.id]] ?? null;

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

/**
 * Where a movement is at this moment. A hold (movement.hold is its depth)
 * stays put; everything else runs the rep cycle.
 */
export function repFor(movement, ms) {
  if (movement.hold != null) return { depth: movement.hold, pressing: false, hold: true, label: "Hold" };
  return repAt(ms, movement.cycleMs);
}

/** How hard one muscle works at this point in the rep, 0 to 1. */
export function effort(muscle, rep) {
  const { depth, pressing } = rep;
  if (rep.hold) return muscle.peak;
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
