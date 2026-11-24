// What you're jumping for. Each goal sets the default takeoff, which drills
// get extra time, whether sprints are in the plan, and what you test.
//
// takeoff  "two" both feet, "one" one foot, "both" a mix
// fixed    true when the event decides the takeoff (high jump is always one foot)
// sport    drill ids that suit the sport, rotated through the speed and sport days
// tests    test ids from TESTS, the first is the main one

export const GROUPS = [
  { id: "court", name: "Court sports" },
  { id: "field", name: "Field sports" },
  { id: "track", name: "Track & field" },
  { id: "general", name: "Just jump higher" },
];

export const GOALS = [
  {
    id: "basketball", group: "court", name: "Basketball", takeoff: "both", approach: true,
    blurb: "Dunks and layups off one foot, rebounds and tip-ins off two, often jumping again right away.",
    sport: ["approach-jump", "one-foot-approach", "repeat-jumps"],
    tests: ["approach", "standing", "approach-one"],
  },
  {
    id: "volleyball", group: "court", name: "Volleyball", takeoff: "two", approach: true,
    blurb: "A two-foot approach to attack, a standing jump to block, and a lot of landings in one match.",
    sport: ["approach-jump", "block-jump", "repeat-jumps"],
    tests: ["approach", "standing"],
  },
  {
    id: "beach", group: "court", name: "Beach volleyball", takeoff: "two", approach: true,
    blurb: "The same jumps as indoors, from sand that soaks up your push. Quick ankles and strong hips win here.",
    sport: ["approach-jump", "block-jump", "pogo-hops"],
    tests: ["approach", "standing"],
  },
  {
    id: "badminton", group: "court", name: "Badminton & handball", takeoff: "both", approach: false,
    blurb: "Jump smashes off two feet, one-foot jumps on the move, and fast changes of direction.",
    sport: ["skater-bound", "one-foot-approach", "lateral-hops"],
    tests: ["standing", "approach-one"],
  },
  {
    id: "football", group: "field", name: "Football", takeoff: "both", approach: true,
    blurb: "Jump balls and contested catches, plus the combine's vertical and broad jump.",
    sport: ["broad-jump", "one-foot-approach", "acceleration-sprint"],
    tests: ["standing", "broad"],
  },
  {
    id: "soccer", group: "field", name: "Soccer", takeoff: "both", approach: true,
    blurb: "Headers off one or two feet, often with a run-up and someone leaning on you. Keepers need both.",
    sport: ["one-foot-approach", "approach-jump", "skater-bound"],
    tests: ["standing", "approach-one"],
  },
  {
    id: "rugby", group: "field", name: "Rugby & Aussie rules", takeoff: "both", approach: true,
    blurb: "Lineout lifts, high balls and marks: jumping from a stand and on the run.",
    sport: ["one-foot-approach", "approach-jump", "broad-jump"],
    tests: ["standing", "approach-one"],
  },
  {
    id: "high-jump", group: "track", name: "High jump", takeoff: "one", fixed: true, approach: true,
    blurb: "A curved run-up into a fast one-foot takeoff. Speed you can turn into height is everything.",
    sport: ["curve-runs", "scissor-jump", "one-foot-approach"],
    tests: ["approach-one", "single"],
  },
  {
    id: "long-jump", group: "track", name: "Long jump", takeoff: "one", fixed: true, approach: true,
    blurb: "Sprint speed carried through a one-foot takeoff. The faster your run-up, the farther you go.",
    sport: ["pop-ups", "short-run-jump", "acceleration-sprint"],
    tests: ["broad", "single", "approach-one"],
  },
  {
    id: "triple-jump", group: "track", name: "Triple jump", takeoff: "one", fixed: true, approach: true,
    blurb: "Hop, step and jump: three landings in a row that each hit harder than a long jump.",
    sport: ["bounding", "single-leg-hops", "hop-step-jump"],
    tests: ["broad", "single"],
  },
  {
    id: "pole-vault", group: "track", name: "Pole vault", takeoff: "one", fixed: true, approach: true,
    blurb: "Sprint, plant and take off from one foot. Pair this with pole drills from your coach.",
    sport: ["pop-ups", "acceleration-sprint", "one-foot-approach"],
    tests: ["approach-one", "broad"],
  },
  {
    id: "hurdles", group: "track", name: "Hurdles", takeoff: "one", fixed: true, approach: true,
    blurb: "Low, quick one-foot takeoffs at full speed, over and over. Reactive ankles matter most.",
    sport: ["single-leg-pogo", "acceleration-sprint", "skater-bound"],
    tests: ["single", "broad"],
  },
  {
    id: "general", group: "general", name: "Jump higher", takeoff: "both", approach: false,
    blurb: "Touch the rim, dunk, or just jump higher than you do now.",
    sport: ["max-vertical", "one-foot-approach", "approach-jump"],
    tests: ["standing", "approach"],
  },
];

export const goalById = new Map(GOALS.map(g => [g.id, g]));

export const TAKEOFFS = [
  { id: "two", name: "Two feet", blurb: "Jump off both feet: blocks, rebounds, a standing vertical." },
  { id: "one", name: "One foot", blurb: "Jump off one foot on the run: layups, headers, track jumps." },
  { id: "both", name: "Both", blurb: "Train both, if your sport uses both." },
];

export const LEVELS = [
  { id: 1, name: "New to it", blurb: "Little or no jump training or lifting" },
  { id: 2, name: "Some training", blurb: "A season or more of lifting or plyos" },
  { id: 3, name: "Experienced", blurb: "Years of lifting and jumping, no aches" },
];

export const GEAR = [
  { id: "none", name: "No gear", blurb: "Bodyweight, a sturdy chair or step", lift: ["bench"] },
  { id: "home", name: "Some weights", blurb: "Dumbbells or a kettlebell, a band", lift: ["dumbbells", "kettlebell", "bands", "bench"] },
  { id: "gym", name: "Full gym", blurb: "Barbell, rack, machines", lift: ["dumbbells", "barbell", "bench", "pullupBar", "kettlebell", "bands", "cable", "machines"] },
];

export const TESTS = [
  { id: "standing", name: "Standing vertical", blurb: "Two feet, no step, arm swing allowed", kind: "height" },
  { id: "approach", name: "Approach vertical", blurb: "Run-up, two-foot takeoff", kind: "height" },
  { id: "approach-one", name: "One-foot approach vertical", blurb: "Run-up, one-foot takeoff", kind: "height" },
  { id: "single", name: "Single-leg vertical", blurb: "Standing on one leg, no step", kind: "height", perSide: true },
  { id: "broad", name: "Standing broad jump", blurb: "Two feet, as far as you can", kind: "distance" },
];

export const testById = new Map(TESTS.map(t => [t.id, t]));
