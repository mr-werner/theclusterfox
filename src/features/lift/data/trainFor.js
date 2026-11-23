// "Training for something?": workout recommendations by sport, everyday
// activity or lifestyle goal.
//
// Each profile says which muscles matter most (weights: 2 = top priority,
// 1 = normal, 0.6 = supporting), how to train them (a LiftFox goal), which
// library exercises carry over best (favor), a sport-style warm-up drill, and
// extra work that belongs outside the weights room (jumps, sprints, mobility).
// The workout builder and the plan builder both read from here.
//
// These are general, well-established priorities (e.g. single-leg strength
// and hamstrings for field sports, upper-back and rotator cuff work for
// throwing and racket sports), not a coaching programme.

export const TRAIN_FOR_KINDS = [
  { id: "sport", name: "Sports" },
  { id: "activity", name: "Activities" },
  { id: "lifestyle", name: "Lifestyle goals" },
];

const p = (id, name, kind, goal, planGoal, muscles, favor, why, warmup, extras) => ({
  id, name, kind, goal, planGoal, muscles, favor, why, warmup, extras,
});

export const trainFor = [
  // Sports
  p("basketball", "Basketball", "sport", "strength", "strength",
    { quads: 2, glutes: 2, calves: 1.6, hamstrings: 1.4, abs: 1, obliques: 1, shoulders: 0.6, lats: 0.6 },
    ["bulgarian-split-squat", "jump-squat", "single-leg-rdl", "step-up", "calf-raise", "goblet-squat", "pallof-press", "nordic-curl"],
    "Jumping, cutting and landing come from strong legs, especially one leg at a time, plus a core that holds firm through contact.",
    "Skips, side shuffles and 5 easy pogo hops",
    ["Jumps: 3 × 5 box jumps or tuck jumps, full rest between", "Landing practice: 3 × 5 drop-and-stick landings, knees over toes", "Ankle hops: 3 × 20 quick pogo hops"]),
  p("volleyball", "Volleyball", "sport", "strength", "strength",
    { quads: 2, glutes: 2, calves: 1.6, shoulders: 1.4, hamstrings: 1.2, abs: 1, obliques: 1, traps: 0.8 },
    ["jump-squat", "bulgarian-split-squat", "back-squat", "calf-raise", "face-pull", "band-pull-apart", "single-leg-rdl", "russian-twist"],
    "Big jumps on both legs, plenty of overhead hitting: legs for height, the back of the shoulder for healthy swings.",
    "Arm circles, band pull-aparts and 10 approach jumps at half effort",
    ["Approach jumps: 3 × 4 full approach jumps, rest 45 s", "Shoulder care: 2 × 15 band external rotations each arm", "Lateral bounds: 3 × 6 each side"]),
  p("soccer", "Soccer", "sport", "stamina", "general",
    { hamstrings: 2, glutes: 1.8, quads: 1.6, calves: 1.2, obliques: 1, abs: 1, lowerBack: 0.6 },
    ["nordic-curl", "single-leg-rdl", "bulgarian-split-squat", "walking-lunge", "side-plank", "glute-bridge", "calf-raise", "split-squat"],
    "Sprinting and kicking load the hamstrings hard. Nordic curls and single-leg work are the best-studied way to cut hamstring strains.",
    "Jog, high knees, butt kicks, open and close the gate",
    ["Sprints: 6 × 30 m at 90%, walk back", "Copenhagen side plank: 3 × 20 s each side (groin)", "Change of direction: 4 × 5-10-5 shuttle"]),
  p("football", "Football", "sport", "strength", "strength",
    { quads: 1.8, glutes: 1.8, hamstrings: 1.6, chest: 1.2, shoulders: 1.2, traps: 1.2, lats: 1, abs: 1 },
    ["back-squat", "deadlift", "barbell-bench-press", "barbell-row", "barbell-shrug", "hip-thrust", "nordic-curl", "farmer-carry"],
    "Power from the hips, a strong upper body for contact, and thick traps and neck muscles to take hits.",
    "Jog, leg swings, walking lunges and 3 short build-up sprints",
    ["Sprints: 6 × 20 m from a three-point stance", "Med ball or sandbag throws: 3 × 5", "Neck: 2 × 15 gentle head nods against your hand each way"]),
  p("baseball", "Baseball & softball", "sport", "size", "general",
    { shoulders: 1.6, obliques: 1.8, glutes: 1.6, lats: 1.2, traps: 1.2, hamstrings: 1, forearms: 1, abs: 1 },
    ["face-pull", "rear-delt-fly", "band-pull-apart", "pallof-press", "russian-twist", "single-leg-rdl", "db-row", "hammer-curl"],
    "Throwing and swinging are rotation from the hips through the trunk. The back of the shoulder slows the arm down, so it needs to be strong.",
    "Arm circles, band pull-aparts, trunk twists and light throwing",
    ["Rotator cuff: 2 × 15 band external rotations each arm", "Rotational throws: 3 × 6 each side with a light med ball", "Sprints: 5 × home-to-first"]),
  p("racket", "Tennis & pickleball", "sport", "stamina", "general",
    { shoulders: 1.4, obliques: 1.8, forearms: 1.4, glutes: 1.4, quads: 1.2, calves: 1.2, traps: 1 },
    ["face-pull", "band-pull-apart", "wrist-curl", "pallof-press", "walking-lunge", "calf-raise", "side-plank", "towel-wring"],
    "Lots of short side-to-side moves, rotation on every stroke and a gripping forearm. Shoulder and elbow care keeps you playing.",
    "Side shuffles, carioca, arm circles and shadow swings",
    ["Lateral shuffles: 4 × 15 s fast", "Wrist and elbow: 2 × 15 slow eccentric wrist extensions each arm", "Split-step drill: 3 × 30 s"]),
  p("golf", "Golf", "sport", "size", "general",
    { obliques: 2, glutes: 1.8, lowerBack: 1, abs: 1, lats: 1, shoulders: 0.8, forearms: 0.8 },
    ["pallof-press", "kb-windmill", "russian-twist", "glute-bridge", "single-leg-rdl", "bird-dog", "db-row", "side-plank"],
    "Distance comes from hips that turn and a trunk that can resist and then release rotation. A strong core also protects the lower back.",
    "Hip circles, open books on the floor and slow practice swings",
    ["Mobility: 2 × 8 open books each side", "Hip turns: 2 × 10 90/90 switches", "Balance: 3 × 30 s on one leg in your golf posture"]),
  p("swimming", "Swimming", "sport", "stamina", "stamina",
    { lats: 2, shoulders: 1.6, triceps: 1.2, traps: 1.2, abs: 1.2, glutes: 1, lowerBack: 0.8 },
    ["pull-up", "lat-pulldown", "face-pull", "band-pull-apart", "overhead-db-extension", "dead-bug", "superman", "prone-y-raise"],
    "The pull is mostly lats and triceps. Plenty of upper-back and rotator cuff work balances all the reaching overhead.",
    "Arm swings, band pull-aparts and 10 slow streamline squats",
    ["Shoulder care: 2 × 15 band external rotations each arm", "Streamline holds: 3 × 30 s, arms squeezed overhead", "Flutter kicks: 3 × 30 s"]),
  p("running", "Running", "sport", "stamina", "stamina",
    { calves: 2, glutes: 1.8, hamstrings: 1.4, quads: 1.4, obliques: 1, abs: 0.8 },
    ["single-leg-rdl", "step-up", "bulgarian-split-squat", "calf-raise", "single-leg-bridge", "side-plank", "glute-bridge", "split-squat"],
    "Every stride is a one-leg landing. Strong calves, glutes and hips make you more efficient and are linked to fewer running injuries.",
    "Leg swings, ankle bounces and 2 × 20 s A-skips",
    ["Strides: 4 × 20 s fast and relaxed, after an easy run", "Calf raises off a step: 3 × 15 each leg, slow on the way down", "Hip stability: 2 × 15 side-lying leg raises each side"]),
  p("cycling", "Cycling", "sport", "stamina", "stamina",
    { quads: 2, glutes: 1.8, hamstrings: 1.2, lowerBack: 1.2, abs: 1, lats: 0.6, traps: 0.6 },
    ["goblet-squat", "bulgarian-split-squat", "step-up", "romanian-deadlift", "back-extension", "bird-dog", "plank", "inverted-row"],
    "Quads and glutes drive the pedals; a strong lower back and core hold your position for hours. Upper-back work fights the hunch.",
    "Easy spin or march, hip flexor stretch and 10 bodyweight squats",
    ["Hip flexor stretch: 2 × 45 s each side", "Thoracic extension: 2 × 10 over a foam roller or chair back", "Single-leg balance: 3 × 30 s each side"]),
  p("hockey", "Hockey & skating", "sport", "strength", "strength",
    { glutes: 2, quads: 1.8, hamstrings: 1.2, obliques: 1.4, abs: 1, lowerBack: 1, shoulders: 0.6 },
    ["bulgarian-split-squat", "walking-lunge", "goblet-squat", "single-leg-rdl", "pallof-press", "side-plank", "deadlift", "russian-twist"],
    "The skating stride pushes out to the side from a deep knee bend. Strong glutes, inner thighs and a stable trunk carry it.",
    "Lateral lunges, leg swings side to side and hip circles",
    ["Lateral bounds: 3 × 6 each side, stick the landing", "Copenhagen side plank: 3 × 20 s each side", "Slide-board or sock slides: 3 × 30 s"]),
  p("combat", "Wrestling, MMA & martial arts", "sport", "strength", "strength",
    { lats: 1.6, traps: 1.6, forearms: 1.6, glutes: 1.4, hamstrings: 1.2, abs: 1.2, obliques: 1.2, chest: 1 },
    ["pull-up", "barbell-row", "farmer-carry", "dead-hang", "deadlift", "towel-curl", "pallof-press", "push-up"],
    "Grip, pulling strength and a stiff trunk win scrambles. Hips and hamstrings power takedowns and kicks.",
    "Jump rope or shadow work, hip circles, neck circles",
    ["Grip: 3 × max towel hangs", "Conditioning: 5 × 1 min hard, 1 min easy (bag, bike or burpees)", "Neck: 2 × 15 gentle isometric holds each way"]),
  p("climbing", "Climbing", "sport", "strength", "strength",
    { lats: 2, forearms: 2, biceps: 1.2, shoulders: 1, abs: 1.2, traps: 1 },
    ["pull-up", "negative-pull-up", "dead-hang", "hanging-knee-raise", "towel-curl", "face-pull", "wrist-curl", "push-up"],
    "Pulling and grip do the climbing; pushing and shoulder work keep the joints balanced so you stay injury-free.",
    "Arm circles, band pull-aparts and easy hangs with feet on the floor",
    ["Finger strength: easy hangboard or bar hangs, 6 × 10 s", "Antagonists: 2 × 15 reverse wrist curls", "Mobility: 2 × 30 s deep squat hold"]),
  p("skiing", "Skiing & snowboarding", "sport", "stamina", "general",
    { quads: 2, glutes: 1.8, hamstrings: 1.2, obliques: 1, abs: 1, calves: 0.8 },
    ["wall-sit", "goblet-squat", "bulgarian-split-squat", "walking-lunge", "single-leg-rdl", "side-plank", "jump-squat", "nordic-curl"],
    "Long, burning holds in a half-squat, quick edge changes and knees that track straight. Hamstrings help protect the ACL.",
    "Leg swings, ankle circles, 10 squats and 10 lateral lunges",
    ["Lateral hops: 3 × 20 s over a line", "Balance: 3 × 30 s single-leg on a pillow", "Tuck holds: 3 × 45 s wall sit"]),
  p("track-sprint", "Sprinting (track)", "sport", "strength", "strength",
    { hamstrings: 2, glutes: 2, quads: 1.6, calves: 1.6, abs: 1, lowerBack: 0.8 },
    ["nordic-curl", "romanian-deadlift", "hip-thrust", "back-squat", "single-leg-rdl", "calf-raise", "jump-squat", "step-up"],
    "Speed comes from force into the ground fast: strong hamstrings and glutes, stiff calves and ankles.",
    "A-skips, B-skips, leg swings and 3 build-ups",
    ["Acceleration: 6 × 20 m from a crouch, full rest", "Bounding: 3 × 20 m", "Pogo hops: 3 × 15"]),
  p("jumps-throws", "Jumping & throwing events", "sport", "strength", "strength",
    { glutes: 2, quads: 1.8, hamstrings: 1.4, calves: 1.4, obliques: 1.4, shoulders: 1, abs: 1 },
    ["back-squat", "jump-squat", "bulgarian-split-squat", "hip-thrust", "kb-swing", "russian-twist", "barbell-ohp", "calf-raise"],
    "Jumps and throws are all about power: heavy strength work, then moving light things very fast.",
    "Skips, leg swings, trunk twists and 3 easy approach run-throughs",
    ["Single-leg bounds: 3 × 5 each leg", "Med ball scoop throws: 4 × 3", "Depth jumps: 3 × 4 from a low box (advanced)"]),

  // Activities
  p("hiking", "Hiking & backpacking", "activity", "stamina", "stamina",
    { quads: 1.8, glutes: 1.8, calves: 1.4, hamstrings: 1.2, lowerBack: 1, abs: 1, traps: 0.8 },
    ["step-up", "walking-lunge", "goblet-squat", "single-leg-rdl", "calf-raise", "farmer-carry", "bird-dog", "split-squat"],
    "Up means quads and glutes; down means quads braking every step. A strong back and core carry the pack.",
    "Brisk walk, leg swings, ankle circles",
    ["Loaded step-ups: 3 × 2 min with a backpack", "Slow step-downs: 3 × 8 each leg (for the descents)", "Ankle balance: 3 × 30 s on one leg"]),
  p("rucking", "Rucking & fitness tests", "activity", "stamina", "stamina",
    { glutes: 1.6, quads: 1.6, traps: 1.4, lowerBack: 1.2, chest: 1, lats: 1, abs: 1, calves: 1 },
    ["push-up", "pull-up", "goblet-squat", "step-up", "farmer-carry", "plank", "deadlift", "walking-lunge"],
    "Carrying weight over distance, plus the push-ups, pull-ups and plank that most fitness tests ask for.",
    "Brisk walk with an empty pack, arm circles, 10 squats",
    ["Ruck: 30–60 min walk with a pack (start at 10% of body weight)", "Push-up practice: 3 sets of half your max", "Run: 1 easy 20 min run"]),
  p("dance", "Dance", "activity", "stamina", "general",
    { glutes: 1.8, calves: 1.6, abs: 1.4, obliques: 1.2, quads: 1.2, hamstrings: 1, lowerBack: 0.8 },
    ["single-leg-bridge", "calf-raise", "dead-bug", "side-plank", "split-squat", "glute-bridge", "bird-dog", "single-leg-rdl"],
    "Control on one leg, strong ankles for relevés and landings, and a core that holds your line.",
    "Easy marching, hip circles, ankle rolls, pliés",
    ["Single-leg relevés: 3 × 12 each side", "Balance: 3 × 30 s on one leg, eyes closed if steady", "Mobility: 2 × 30 s hip flexor and hamstring stretch"]),
  p("manual-work", "Physical job & yard work", "activity", "strength", "general",
    { lowerBack: 1.6, glutes: 1.6, hamstrings: 1.2, forearms: 1.4, traps: 1.2, abs: 1.2, quads: 1, shoulders: 0.8 },
    ["deadlift", "goblet-squat", "farmer-carry", "db-row", "bird-dog", "side-plank", "pallof-press", "kb-swing"],
    "Lifting, carrying and twisting all day: train the hinge so your hips do the lifting, and a core that resists bending and twisting.",
    "Cat-cow, hip circles, 10 good mornings with no weight",
    ["Practice the hinge: 2 × 10 hip hinges with a stick on your back", "Carries: 3 × 30 m suitcase carry each side", "Stretch: hamstrings and hip flexors after work"]),
  p("desk", "Desk job", "activity", "size", "general",
    { traps: 1.6, shoulders: 1.4, lats: 1.2, glutes: 1.6, abs: 1.2, lowerBack: 1, hamstrings: 0.8 },
    ["face-pull", "band-pull-apart", "prone-y-raise", "inverted-row", "glute-bridge", "bird-dog", "dead-bug", "romanian-deadlift"],
    "Sitting rounds the upper back and switches the glutes off. Pull more than you push and wake up the back of the body.",
    "Thoracic rotations, chin tucks and 10 glute bridges",
    ["Every hour: stand, 10 band pull-aparts or wall angels", "Hip flexor stretch: 2 × 45 s each side", "Walk: 10 minutes after lunch"]),
  p("parent", "Lifting kids & everyday carrying", "activity", "strength", "general",
    { glutes: 1.4, quads: 1.2, lowerBack: 1.2, abs: 1.4, obliques: 1.2, biceps: 1, forearms: 1, traps: 1 },
    ["goblet-squat", "farmer-carry", "deadlift", "pallof-press", "side-plank", "db-row", "split-squat", "hammer-curl"],
    "Picking up and carrying an awkward, wriggling weight on one side: squat and hinge strength plus a core that resists leaning.",
    "Cat-cow, arm circles, 10 squats",
    ["Suitcase carry: 3 × 30 m each side", "Floor to stand: 2 × 5 get-ups without hands", "Squat holds: 2 × 30 s at the bottom"]),

  // Lifestyle goals
  p("fat-loss", "Lose fat", "lifestyle", "stamina", "general",
    { quads: 1.4, glutes: 1.4, hamstrings: 1.2, chest: 1, lats: 1, shoulders: 0.8, abs: 0.8 },
    ["goblet-squat", "kb-swing", "push-up", "walking-lunge", "db-row", "romanian-deadlift", "step-up", "jump-squat"],
    "Big moves that use lots of muscle burn the most, and strength training helps you keep muscle while you eat less.",
    "3 minutes of brisk walking or jumping jacks, then 10 squats",
    ["Steps: aim for 8,000–10,000 a day", "Finisher: 5 rounds of 20 s hard, 40 s easy", "Protein with every meal helps keep muscle"]),
  p("healthy-aging", "Stay strong as I age", "lifestyle", "strength", "general",
    { quads: 1.8, glutes: 1.8, lats: 1.2, forearms: 1.2, calves: 1, abs: 1, lowerBack: 1, chest: 0.8 },
    ["goblet-squat", "step-up", "farmer-carry", "db-row", "glute-bridge", "calf-raise", "incline-push-up", "bird-dog"],
    "Leg strength, grip and balance are some of the best predictors of staying independent. Lifting also helps keep bones strong.",
    "March in place, arm circles, sit-to-stand from a chair × 10",
    ["Balance: 3 × 30 s on one leg near a counter", "Sit-to-stand: 2 × 10 without using your hands", "Walk: 20–30 minutes most days"]),
  p("posture", "Better posture", "lifestyle", "size", "general",
    { traps: 1.8, shoulders: 1.4, lats: 1.2, lowerBack: 1.2, glutes: 1.2, abs: 1.2 },
    ["face-pull", "band-pull-apart", "prone-y-raise", "rear-delt-fly", "inverted-row", "superman", "bird-dog", "dead-bug"],
    "Strong upper-back and rear-shoulder muscles pull the shoulders back; glutes and abs set the pelvis.",
    "Chin tucks, wall angels and doorway chest stretch",
    ["Wall angels: 2 × 10", "Doorway chest stretch: 2 × 30 s", "Chin tucks: 2 × 10, hold 3 s each"]),
  p("back-health", "Fewer back aches", "lifestyle", "stamina", "general",
    { abs: 1.6, obliques: 1.6, lowerBack: 1.4, glutes: 1.8, hamstrings: 1 },
    ["bird-dog", "dead-bug", "side-plank", "glute-bridge", "pallof-press", "plank", "single-leg-bridge", "romanian-deadlift"],
    "Endurance in the muscles around the spine, especially holding still against movement, plus strong glutes to take the load off the back.",
    "Cat-cow × 10, pelvic tilts × 10, gentle walk",
    ["Walk: 20–30 minutes a day", "McGill curl-up: 3 × 10 s holds", "See a doctor or physio for pain that's sharp, shooting or getting worse"]),
  p("athletic", "Be more athletic", "lifestyle", "strength", "general",
    { glutes: 1.6, quads: 1.4, hamstrings: 1.4, lats: 1.2, chest: 1, shoulders: 1, abs: 1, calves: 1 },
    ["back-squat", "deadlift", "pull-up", "push-up", "jump-squat", "bulgarian-split-squat", "kb-swing", "farmer-carry"],
    "Strength in the big patterns (squat, hinge, push, pull, carry) plus a little jumping and sprinting covers most of what sport asks for.",
    "Skips, leg swings, inchworms and 5 easy jumps",
    ["Jumps: 3 × 5 broad jumps", "Sprints: 4 × 15 m", "Play: a pick-up game or a new sport once a week"]),
];

export const trainForById = new Map(trainFor.map(t => [t.id, t]));

/** Muscles in priority order, top ones first. */
export function priorityMuscles(profile) {
  return Object.entries(profile.muscles).sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/**
 * What a profile changes in the workout inputs. Weights and favoured
 * exercises steer the generator; the muscles and goal fill the form so
 * people can still edit them.
 */
export function workoutInputs(profile) {
  return {
    muscles: priorityMuscles(profile),
    goal: profile.goal,
    weights: profile.muscles,
    favor: profile.favor,
  };
}
