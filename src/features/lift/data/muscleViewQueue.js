// The order LiftFox's exercises get the red-muscle 2D/3D view, five a day.
// The daily task (see docs/liftfox-muscle-views.md) takes the first batch
// whose exercises aren't all in activation.js's BY_EXERCISE yet.
//
// Batches group exercises that move the same way, so one rig (and one day's
// work) covers all five. The note says what that day needs to build.

export const MUSCLE_VIEW_QUEUE = [
  { note: "Push-up family: reuse the push-up rig with options (hand height, foot height, hand width, hips up).",
    exercises: ["incline-push-up", "decline-push-up", "diamond-push-up", "pike-push-up", "plank"] },
  { note: "Squat family: first leg rig (hips, knees, ankles bend; torso leans). Holds use a fixed depth.",
    exercises: ["bodyweight-squat", "goblet-squat", "back-squat", "jump-squat", "wall-sit"] },
  { note: "Hinge family: hips go back, knees soft, spine stays long. Reuses the leg rig.",
    exercises: ["romanian-deadlift", "deadlift", "db-rdl", "kb-swing", "single-leg-rdl"] },
  { note: "Lying hip extension: body on the floor or a bench, hips lift.",
    exercises: ["glute-bridge", "single-leg-bridge", "hip-thrust", "db-hip-thrust", "hamstring-walkout"] },
  { note: "Split stance: one leg forward, one back.",
    exercises: ["split-squat", "bulgarian-split-squat", "walking-lunge", "db-lunge", "step-up"] },
  { note: "Bench pressing: lying arm rig (the push-up arm, turned over).",
    exercises: ["db-bench-press", "barbell-bench-press", "incline-db-press", "db-floor-press", "close-grip-bench"] },
  { note: "Overhead pressing: standing arm rig.",
    exercises: ["db-shoulder-press", "barbell-ohp", "machine-shoulder-press", "machine-chest-press", "band-chest-press"] },
  { note: "Vertical pulling: hanging rig, arms overhead.",
    exercises: ["pull-up", "chin-up", "negative-pull-up", "lat-pulldown", "dead-hang"] },
  { note: "Rows: bent-over and seated pulls.",
    exercises: ["db-row", "barbell-row", "inverted-row", "seated-cable-row", "band-row"] },
  { note: "More rows and shrugs.",
    exercises: ["kb-row", "machine-row", "db-shrug", "barbell-shrug", "farmer-carry"] },
  { note: "Shoulder raises: arm swings out from the side.",
    exercises: ["lateral-raise", "band-lateral-raise", "cable-lateral-raise", "rear-delt-fly", "prone-y-raise"] },
  { note: "Upper-back pulls and chest flys.",
    exercises: ["band-pull-apart", "face-pull", "db-fly", "cable-fly", "dips"] },
  { note: "Elbow bending: curls.",
    exercises: ["db-curl", "hammer-curl", "barbell-curl", "band-curl", "cable-curl"] },
  { note: "More curls and triceps extensions.",
    exercises: ["kb-curl", "towel-curl", "overhead-db-extension", "skull-crusher", "cable-pushdown"] },
  { note: "Triceps and forearms.",
    exercises: ["band-pushdown", "bench-dip", "wrist-curl", "towel-wring", "superman"] },
  { note: "Floor core: curling and leg lifts.",
    exercises: ["crunch", "dead-bug", "leg-raise", "bicycle-crunch", "russian-twist"] },
  { note: "Hanging and standing core.",
    exercises: ["hanging-knee-raise", "cable-crunch", "side-plank", "pallof-press", "kb-windmill"] },
  { note: "Back and hamstrings.",
    exercises: ["bird-dog", "back-extension", "nordic-curl", "band-leg-curl", "machine-leg-curl"] },
  { note: "Leg machines and kickbacks.",
    exercises: ["leg-press", "leg-extension", "band-kickback", "kb-goblet-squat", "calf-raise"] },
  { note: "Calves.",
    exercises: ["db-calf-raise", "machine-calf-raise"] },
];

/** The next batch to do: the first with any exercise still missing. */
export function nextBatch(done) {
  const has = new Set(done);
  const index = MUSCLE_VIEW_QUEUE.findIndex(b => b.exercises.some(id => !has.has(id)));
  return index < 0 ? null : { index, ...MUSCLE_VIEW_QUEUE[index], todo: MUSCLE_VIEW_QUEUE[index].exercises.filter(id => !has.has(id)) };
}
