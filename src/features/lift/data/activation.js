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

// Every muscle the demos show, so the leg and hip moves below can list
// theirs by id and peak. Adductors have no LiftFox group of their own; they
// sit with the glutes as hip muscles.
const CATALOGUE = Object.fromEntries([
  ...PUSHUP_MUSCLES,
  { id: "adductors", name: "Inner thigh", detail: "Adductors", group: "glutes", role: "mover", peak: 0.3, match: /adductor (longus|brevis|magnus|minimus)|gracilis|pectineus/ },
].map(m => [m.id, m]));

// A muscle list from { id: peak } (movers) and { id: peak } (braces).
function musclesOf(movers, braces = {}) {
  const pick = (peaks, role) => Object.entries(peaks).map(([id, peak]) => ({ ...CATALOGUE[id], role, peak }));
  return [...pick(movers, "mover"), ...pick(braces, "brace")];
}

// Labels for the four parts of the rep, in repAt's order: going down, the
// bottom, coming up, the top.
const SQUAT_PHASES = ["Lowering", "Bottom", "Standing up", "Top"];
const HINGE_PHASES = ["Hinging", "Bottom", "Standing up", "Top"];
// Bridges start with the hips down and work on the way up, so depth 1 is
// hips up and the lift is the "pressing" part.
const BRIDGE_PHASES = ["Lifting", "Squeeze", "Lowering", "Hips down"];

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

  // ---- Squats: one standing leg rig ("body"), hips, knees and ankles bend.
  // Surface EMG for the squat puts the quads first, then the glutes and
  // adductors; the hamstrings stay low (Isear et al. 1997 for the bodyweight
  // squat; Escamilla 2001 and Contreras et al. 2016 for loaded squats).

  // Arms reach forward as you sit down, for balance. Without a load the
  // quads reach about half their max at the bottom.
  bodyweightSquat: {
    name: "Bodyweight squat",
    rig: "body",
    rigOptions: { pose: "bodyweightSquat" },
    cycleMs: 3200,
    phases: SQUAT_PHASES,
    muscles: musclesOf(
      { quads: 0.5, glutes: 0.32, adductors: 0.25, hamstrings: 0.15 },
      { lowerBack: 0.22, abs: 0.15, calves: 0.15, obliques: 0.12, frontDelt: 0.15 },
    ),
  },

  // A dumbbell at the chest keeps the trunk upright, so the quads and the
  // abs do more and the lower back a little less than with a bar on the back.
  // Peaks are estimates scaled between the bodyweight and back squat.
  gobletSquat: {
    name: "Goblet squat",
    rig: "body",
    rigOptions: { pose: "gobletSquat" },
    cycleMs: 3400,
    phases: SQUAT_PHASES,
    muscles: musclesOf(
      { quads: 0.68, glutes: 0.45, adductors: 0.35, hamstrings: 0.18 },
      { abs: 0.32, lowerBack: 0.3, obliques: 0.24, biceps: 0.25, forearms: 0.25, frontDelt: 0.22, traps: 0.2, calves: 0.18 },
    ),
  },

  // The bar on the upper back: the heaviest squat here. Quads lead, the
  // glutes and adductors climb as you go deeper, and the lower back works
  // hard to keep the trunk from folding.
  backSquat: {
    name: "Barbell back squat",
    rig: "body",
    rigOptions: { pose: "backSquat" },
    cycleMs: 3600,
    phases: SQUAT_PHASES,
    muscles: musclesOf(
      { quads: 0.85, glutes: 0.58, adductors: 0.5, hamstrings: 0.3 },
      { lowerBack: 0.6, abs: 0.32, obliques: 0.3, traps: 0.3, calves: 0.25, lats: 0.2, forearms: 0.15 },
    ),
  },

  // Squat down, then jump: the push-off adds the calves, and the arm swing
  // the front shoulders. Jumps reach near-max quad and glute activity.
  jumpSquat: {
    name: "Jump squat",
    rig: "body",
    rigOptions: { pose: "jumpSquat" },
    cycleMs: 2600,
    jump: true,
    phases: ["Lowering", "Bottom", "Jumping", "In the air"],
    muscles: musclesOf(
      { quads: 0.9, glutes: 0.68, calves: 0.75, adductors: 0.4, hamstrings: 0.35, frontDelt: 0.25 },
      { lowerBack: 0.35, abs: 0.25, obliques: 0.2 },
    ),
  },

  // Back on a wall, thighs level: a hold. The quads sit around half their
  // max at 90° of knee bend; everything else does little.
  wallSit: {
    name: "Wall sit",
    rig: "body",
    rigOptions: { pose: "wallSit" },
    hold: 1,
    cycleMs: 4000,
    muscles: musclesOf({}, { quads: 0.55, adductors: 0.2, glutes: 0.18, abs: 0.15, hamstrings: 0.12, calves: 0.12, lowerBack: 0.1 }),
  },

  // ---- Hinges: hips go back, knees stay soft, the back stays long. The
  // hamstrings, glutes and the muscles along the spine do the work
  // (McAllister et al. 2014 for the Romanian deadlift; Escamilla et al. 2002
  // for the deadlift; McGill & Marshall 2012 for the kettlebell swing).

  romanianDeadlift: {
    name: "Romanian deadlift",
    rig: "body",
    rigOptions: { pose: "romanianDeadlift" },
    cycleMs: 3800,
    phases: HINGE_PHASES,
    muscles: musclesOf(
      { hamstrings: 0.75, glutes: 0.55, adductors: 0.35 },
      { lowerBack: 0.7, forearms: 0.4, traps: 0.35, lats: 0.3, abs: 0.25, obliques: 0.2, quads: 0.15, calves: 0.15 },
    ),
  },

  // From the floor: the knees bend more than in the Romanian, so the quads
  // join in, and the whole back holds the bar.
  deadlift: {
    name: "Deadlift",
    rig: "body",
    rigOptions: { pose: "deadlift" },
    cycleMs: 3800,
    phases: ["Lowering", "Bar on the floor", "Lifting", "Standing tall"],
    muscles: musclesOf(
      { glutes: 0.65, hamstrings: 0.6, quads: 0.6, adductors: 0.45 },
      { lowerBack: 0.8, traps: 0.5, forearms: 0.5, lats: 0.35, abs: 0.3, obliques: 0.3, calves: 0.25 },
    ),
  },

  // Dumbbells are usually lighter than the bar, so every peak is a little
  // lower than the barbell Romanian deadlift (an estimate).
  dbRdl: {
    name: "Dumbbell Romanian deadlift",
    rig: "body",
    rigOptions: { pose: "dbRdl" },
    cycleMs: 3800,
    phases: HINGE_PHASES,
    muscles: musclesOf(
      { hamstrings: 0.62, glutes: 0.47, adductors: 0.3 },
      { lowerBack: 0.55, forearms: 0.35, traps: 0.3, lats: 0.22, abs: 0.2, obliques: 0.16, quads: 0.12, calves: 0.12 },
    ),
  },

  // A fast hinge: the glutes snap the hips forward and the bell floats up.
  // The glutes and the back muscles reach well over half their max.
  kbSwing: {
    name: "Kettlebell swing",
    rig: "body",
    rigOptions: { pose: "kbSwing" },
    cycleMs: 1800,
    phases: ["Hiking back", "Between the legs", "Hips snap forward", "Chest height"],
    muscles: musclesOf(
      { glutes: 0.75, hamstrings: 0.55, quads: 0.3 },
      { lowerBack: 0.6, forearms: 0.35, abs: 0.3, frontDelt: 0.3, obliques: 0.25, lats: 0.25, traps: 0.25 },
    ),
  },

  // On one leg: the standing side's glutes (the medius too, for balance) and
  // hamstrings lead, and the obliques and calf keep you steady. Estimates.
  singleLegRdl: {
    name: "Single-leg Romanian deadlift",
    rig: "body",
    rigOptions: { pose: "singleLegRdl" },
    cycleMs: 4000,
    phases: HINGE_PHASES,
    muscles: musclesOf(
      { hamstrings: 0.6, glutes: 0.6, adductors: 0.3 },
      { lowerBack: 0.5, obliques: 0.3, calves: 0.3, abs: 0.2, quads: 0.2 },
    ),
  },

  // ---- Lying hip extension: shoulders on the floor or a bench, hips lift.
  // The glutes lead, hardest with the hips all the way up (Contreras et al.
  // 2015 measured the barbell hip thrust above the back squat for the glutes).

  gluteBridge: {
    name: "Glute bridge",
    rig: "body",
    rigOptions: { pose: "gluteBridge" },
    cycleMs: 3200,
    liftFirst: true,
    phases: BRIDGE_PHASES,
    muscles: musclesOf(
      { glutes: 0.5, hamstrings: 0.35, adductors: 0.2 },
      { lowerBack: 0.35, quads: 0.2, abs: 0.15, obliques: 0.12 },
    ),
  },

  // All the weight on one leg, and the hips have to stay level.
  singleLegBridge: {
    name: "Single-leg glute bridge",
    rig: "body",
    rigOptions: { pose: "singleLegBridge" },
    cycleMs: 3400,
    liftFirst: true,
    phases: BRIDGE_PHASES,
    muscles: musclesOf(
      { glutes: 0.7, hamstrings: 0.55, adductors: 0.25 },
      { lowerBack: 0.4, obliques: 0.3, quads: 0.3, abs: 0.2 },
    ),
  },

  hipThrust: {
    name: "Hip thrust",
    rig: "body",
    rigOptions: { pose: "hipThrust" },
    cycleMs: 3400,
    liftFirst: true,
    phases: BRIDGE_PHASES,
    muscles: musclesOf(
      { glutes: 0.9, quads: 0.45, hamstrings: 0.4, adductors: 0.35 },
      { lowerBack: 0.4, abs: 0.25, forearms: 0.15, calves: 0.1 },
    ),
  },

  // A dumbbell is lighter than the bar: the same pattern a step lower (an estimate).
  dbHipThrust: {
    name: "Dumbbell hip thrust",
    rig: "body",
    rigOptions: { pose: "dbHipThrust" },
    cycleMs: 3400,
    liftFirst: true,
    phases: BRIDGE_PHASES,
    muscles: musclesOf(
      { glutes: 0.72, quads: 0.35, hamstrings: 0.35, adductors: 0.28 },
      { lowerBack: 0.35, abs: 0.2, forearms: 0.15 },
    ),
  },

  // Hips up the whole time while the heels walk out: the further out, the
  // longer and harder-working the hamstrings. Estimates.
  hamstringWalkout: {
    name: "Hamstring walkout",
    rig: "body",
    rigOptions: { pose: "hamstringWalkout" },
    cycleMs: 5200,
    phases: ["Walking out", "Furthest out", "Walking back in", "Bridge"],
    muscles: musclesOf(
      { hamstrings: 0.7, glutes: 0.55, calves: 0.3 },
      { lowerBack: 0.4, adductors: 0.2, abs: 0.2 },
    ),
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
  "bodyweight-squat": "bodyweightSquat",
  "goblet-squat": "gobletSquat",
  "back-squat": "backSquat",
  "jump-squat": "jumpSquat",
  "wall-sit": "wallSit",
  "romanian-deadlift": "romanianDeadlift",
  deadlift: "deadlift",
  "db-rdl": "dbRdl",
  "kb-swing": "kbSwing",
  "single-leg-rdl": "singleLegRdl",
  "glute-bridge": "gluteBridge",
  "single-leg-bridge": "singleLegBridge",
  "hip-thrust": "hipThrust",
  "db-hip-thrust": "dbHipThrust",
  "hamstring-walkout": "hamstringWalkout",
};
export const movementFor = exercise => MOVEMENTS[BY_EXERCISE[exercise?.id]] ?? null;

const ease = v => (1 - Math.cos(Math.PI * v)) / 2;

/**
 * Where in the rep we are, from the time since it started.
 * depth: 0 at the top, 1 at the bottom. pressing: true on the way up.
 */
export function repAt(ms, cycleMs) {
  const x = (((ms % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  if (x < 0.4) return { depth: ease(x / 0.4), pressing: false, label: "Lowering", phase: 0, at: x };
  if (x < 0.5) return { depth: 1, pressing: false, label: "Bottom", phase: 1, at: x };
  if (x < 0.8) return { depth: 1 - ease((x - 0.5) / 0.3), pressing: true, label: "Pressing up", phase: 2, at: x };
  return { depth: 0, pressing: false, label: "Top", phase: 3, at: x };
}

/**
 * Where a movement is at this moment. A hold (movement.hold is its depth)
 * stays put; everything else runs the rep cycle.
 */
export function repFor(movement, ms) {
  if (movement.hold != null) return { depth: movement.hold, pressing: false, hold: true, label: "Hold" };
  const rep = repAt(ms, movement.cycleMs);
  if (movement.phases) rep.label = movement.phases[rep.phase];
  // Bridges work on the way to depth 1 (hips up), not on the way back.
  if (movement.liftFirst) rep.pressing = rep.phase === 0;
  // A jump leaves the floor in the "top" part of the rep, and lands by its end.
  if (movement.jump && rep.phase === 3) {
    rep.air = Math.sin(Math.PI * Math.min(1, (rep.at - 0.8) / 0.17));
    rep.pressing = true;
  }
  return rep;
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
