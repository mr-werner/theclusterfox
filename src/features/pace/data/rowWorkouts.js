// Rowing workouts you can pick on the Go tab without a plan.
//
// Each one builds the same steps a plan session does (see model/sessions.js),
// so the live screen, the voice and the log treat them alike. Pieces can be
// timed (sec) or set by distance (meters). A distance piece ends when the
// rowing machine or GPS says you have rowed that far; with no distance to go
// on it runs for its estimated time instead. Every distance step still
// carries an estimated sec, for the session's shape and total time.
//
// Splits come from the zones: with a 2K time in Setup each work step gets a
// target split per 500 m that the voice calls out. Stroke rates are in the cues.

import { splitRange } from "../model/zones.js";

export const ROW_GROUPS = [
  { id: "steady", name: "Steady state", blurb: "Long, easy aerobic rowing. The base everything else sits on." },
  { id: "intervals", name: "Intervals", blurb: "Hard pieces with set rest. Raise your threshold and top end." },
  { id: "pyramids", name: "Pyramids and ladders", blurb: "Pieces that grow and shrink, so the pace changes keep you honest." },
  { id: "power", name: "Sprints and power", blurb: "Short, fast work with long rest. Starts, speed and power." },
  { id: "tests", name: "Tests", blurb: "Benchmarks to set your 2K time and see your progress." },
];

export const LENGTHS = [
  { id: "short", name: "Shorter" },
  { id: "standard", name: "Standard" },
  { id: "long", name: "Longer" },
];

const DEFAULT_2K = 480; // 8:00, when no 2K time is set

/** Estimated seconds per 500 m at a zone (middle of the zone's split range). */
export function estSplit(zone, profile) {
  const p = profile?.row2k > 300 && profile.row2k < 900 ? profile : { row2k: DEFAULT_2K };
  const r = splitRange(Math.min(Math.max(zone, 1), 6), p);
  return (r[0] + r[1]) / 2;
}

const m = n => Math.round(n * 60);
const warm = (min = 10) => ({ label: "Warm up", kind: "warm", sec: m(min), zone: 1, cue: "Easy rowing, rate 18 to 20. Add three bursts of ten firm strokes near the end." });
const cool = (min = 5) => ({ label: "Cool down", kind: "cool", sec: m(min), zone: 1, cue: "Light pressure. Let your breathing settle." });
const rest = (sec, cue = "Breathe, stay loose, sip water.") => ({ label: "Rest", kind: "rest", sec: Math.round(sec), zone: 1, cue });

/** A distance piece, with its time estimated from the zone's split. */
const dist = (meters, zone, label, cue, profile) => ({ label, kind: "work", meters, sec: Math.round((meters / 500) * estSplit(zone, profile)), zone, cue });
const timed = (sec, zone, label, cue, kind = "work") => ({ label, kind, sec: Math.round(sec), zone, cue });

/** n pieces with rest between (none after the last), numbered "2 of 5". */
function pieces(n, piece, restStep) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ ...piece, rep: [i + 1, n] });
    if (restStep && i < n - 1) out.push({ ...restStep, rep: [i + 1, n] });
  }
  return out;
}

const pick = (len, short, standard, long) => (len === "short" ? short : len === "long" ? long : standard);

export const ROW_WORKOUTS = [
  // ---- Steady state ----
  {
    id: "ut2",
    group: "steady",
    name: "Steady state",
    detail: len => `${pick(len, 20, 30, 45)} min at UT2`,
    why: "The bread and butter of rowing fitness. Easy enough to hold a conversation, rate 18 to 22.",
    build: len => [timed(m(pick(len, 20, 30, 45)), 2, "Steady state", "Relaxed and long. Rate 18 to 22. Hold the same split the whole way.", "steady"), cool(3)],
  },
  {
    id: "ut1",
    group: "steady",
    name: "UT1 pieces",
    detail: len => `${pick(len, 2, 3, 4)} × 10 min, 2 min rest`,
    why: "Firm steady rowing, a step up from UT2. Builds aerobic power without wrecking you.",
    build: len => [warm(8), ...pieces(pick(len, 2, 3, 4), timed(m(10), 3, "UT1 piece", "Firm and steady. Rate 22 to 24."), rest(120)), cool()],
  },
  {
    id: "rate-steps",
    group: "steady",
    name: "Rate steps",
    detail: len => `${pick(len, 2, 3, 4)} × (3 min at r20, r22, r24, r26)`,
    why: "Same effort per stroke, more strokes per minute. Teaches you to move the boat with rhythm, not just muscle.",
    build: len => {
      const set = [
        timed(m(3), 2, "Rate 20", "Rate 20. Long and strong."),
        timed(m(3), 3, "Rate 22", "Up to 22. Same length, a bit quicker on the way out."),
        timed(m(3), 3, "Rate 24", "Rate 24. Keep the stroke long."),
        timed(m(3), 4, "Rate 26", "Rate 26. Sharp catches, hold the split."),
      ];
      const n = pick(len, 2, 3, 4);
      const out = [warm(8)];
      for (let i = 0; i < n; i += 1) {
        out.push(...set.map(s => ({ ...s, label: `${s.label} (set ${i + 1})` })));
        if (i < n - 1) out.push(rest(120, "Easy paddle between sets."));
      }
      return [...out, cool()];
    },
  },

  // ---- Intervals ----
  {
    id: "4x1000",
    group: "intervals",
    name: "1000 m repeats",
    detail: len => `${pick(len, 3, 4, 5)} × 1000 m, 4 min rest`,
    why: "The classic threshold builder. Hold the same split on every piece.",
    build: (len, profile) => [warm(), ...pieces(pick(len, 3, 4, 5), dist(1000, 4, "1000 m", "Hard but controlled. Rate 26 to 28. Same split every piece.", profile), rest(240)), cool()],
  },
  {
    id: "8x500",
    group: "intervals",
    name: "500 m repeats",
    detail: len => `${pick(len, 6, 8, 10)} × 500 m, 2 min rest`,
    why: "Just faster than 2K pace, with rest to keep the quality high. Builds the speed you race on.",
    build: (len, profile) => [warm(), ...pieces(pick(len, 6, 8, 10), dist(500, 5, "500 m", "2K pace or a touch faster. Rate 28 to 32. Strong legs, quick hands.", profile), rest(120)), cool()],
  },
  {
    id: "3x2000",
    group: "intervals",
    name: "2000 m repeats",
    detail: len => `${pick(len, 2, 3, 4)} × 2000 m, 5 min rest`,
    why: "Long threshold pieces. Teaches you to sit on a hard split and stay relaxed.",
    build: (len, profile) => [warm(), ...pieces(pick(len, 2, 3, 4), dist(2000, 4, "2000 m", "Threshold. Rate 24 to 26. Settle in after the first 20 strokes.", profile), rest(300)), cool()],
  },
  {
    id: "4x8min",
    group: "intervals",
    name: "8 minute pieces",
    detail: len => `${pick(len, 3, 4, 5)} × 8 min, 3 min rest`,
    why: "Anaerobic threshold work by time. Good for building toward a 6K or head race.",
    build: len => [warm(), ...pieces(pick(len, 3, 4, 5), timed(m(8), 4, "8 min piece", "Hard but sustainable. Rate 24 to 26."), rest(180)), cool()],
  },
  {
    id: "2on1off",
    group: "intervals",
    name: "2 on, 1 off",
    detail: len => `${pick(len, 6, 8, 10)} × 2 min hard, 1 min easy`,
    why: "Transport-rate intervals. Short rest keeps your heart rate up the whole set.",
    build: len => [warm(), ...pieces(pick(len, 6, 8, 10), timed(m(2), 5, "Hard 2 min", "Hard. Rate 28 to 30. Breathe on the recovery."), { ...rest(60, "Paddle easy. Don't stop rowing."), label: "Easy" }), cool()],
  },

  // ---- Pyramids and ladders ----
  {
    id: "time-pyramid",
    group: "pyramids",
    name: "Time pyramid",
    detail: () => "1-2-3-4-3-2-1 min, rest half the piece",
    why: "Up and down the ladder. Pace the long ones, attack the short ones.",
    build: len => {
      const mins = pick(len, [1, 2, 3, 2, 1], [1, 2, 3, 4, 3, 2, 1], [1, 2, 3, 4, 5, 4, 3, 2, 1]);
      const out = [warm()];
      mins.forEach((mm, i) => {
        const zone = mm <= 2 ? 5 : 4;
        out.push({ ...timed(m(mm), zone, `${mm} min`, mm <= 2 ? "Fast. Rate 28 to 32." : "Strong and even. Rate 26 to 28."), rep: [i + 1, mins.length] });
        if (i < mins.length - 1) out.push({ ...rest(m(mm) / 2), rep: [i + 1, mins.length] });
      });
      return [...out, cool()];
    },
  },
  {
    id: "distance-ladder",
    group: "pyramids",
    name: "Distance ladder",
    detail: len => pick(len, "250-500-750-500-250 m", "250-500-750-1000-750-500-250 m", "500-750-1000-1250-1000-750-500 m"),
    why: "Each step gets a split to match its length: the short ones faster, the long ones steadier.",
    build: (len, profile) => {
      const ms = pick(len, [250, 500, 750, 500, 250], [250, 500, 750, 1000, 750, 500, 250], [500, 750, 1000, 1250, 1000, 750, 500]);
      const out = [warm()];
      ms.forEach((d, i) => {
        const zone = d <= 500 ? 5 : 4;
        out.push({ ...dist(d, zone, `${d} m`, d <= 500 ? "Quick. Rate 28 to 32." : "Strong and steady. Rate 26.", profile), rep: [i + 1, ms.length] });
        if (i < ms.length - 1) out.push({ ...rest(Math.max(60, (d / 250) * 45)), rep: [i + 1, ms.length] });
      });
      return [...out, cool()];
    },
  },

  // ---- Sprints and power ----
  {
    id: "10x250",
    group: "power",
    name: "250 m sprints",
    detail: len => `${pick(len, 6, 10, 12)} × 250 m, 90 s rest`,
    why: "Speed work. Faster than 2K pace, with enough rest to do each one properly.",
    build: (len, profile) => [warm(), ...pieces(pick(len, 6, 10, 12), dist(250, 5, "250 m", "Sprint. Rate 32 plus. Hard legs, sharp catches.", profile), rest(90)), cool()],
  },
  {
    id: "30-30",
    group: "power",
    name: "30/30s",
    detail: len => `${pick(len, 2, 3, 4)} sets of 6 × 30 s on, 30 s off`,
    why: "Short bursts at high rate. Big fitness gains in little time.",
    build: len => {
      const n = pick(len, 2, 3, 4);
      const out = [warm()];
      for (let i = 0; i < n; i += 1) {
        out.push(...pieces(6, timed(30, 5, `On (set ${i + 1})`, "Go! Rate 30 plus."), { ...rest(30, "Light paddle."), label: `Off (set ${i + 1})` }));
        if (i < n - 1) out.push(rest(180, "Easy rowing between sets."));
      }
      return [...out, cool()];
    },
  },
  {
    id: "power-10s",
    group: "power",
    name: "Power strokes",
    detail: len => `${pick(len, 6, 8, 10)} × 10 strokes all out, 1:30 rest`,
    why: "Maximum power from a slow start. Builds the drive off the catch, and race starts.",
    build: len => [warm(), ...pieces(pick(len, 6, 8, 10), timed(20, 6, "10 power strokes", "Ten strokes, everything you have. Big legs."), rest(90, "Paddle easy and recover fully.")), cool()],
  },

  // ---- Tests ----
  {
    id: "test-2k",
    group: "tests",
    name: "2000 m test",
    detail: () => "2000 m all out",
    why: "The standard rowing benchmark. Enter your time in Setup and every split target updates.",
    build: (len, profile) => [warm(12), rest(120, "Get ready. Go out controlled; the race starts at 1000 meters."), dist(2000, 5, "2000 m test", "Strong first 10 strokes, settle by 250, hold on through the middle, then empty the tank in the last 500.", profile), cool(8)],
  },
  {
    id: "test-500",
    group: "tests",
    name: "500 m test",
    detail: () => "500 m all out",
    why: "A sprint benchmark. Tells you your top-end speed.",
    build: (len, profile) => [warm(12), rest(120, "Get ready. Sprint start, then hold on."), dist(500, 6, "500 m test", "All out. High rate start, then lengthen out and hang on.", profile), cool(8)],
  },
  {
    id: "test-30r20",
    group: "tests",
    name: "30 minutes at rate 20",
    detail: () => "30 min, rate capped at 20",
    why: "A classic aerobic test. Row as far as you can in 30 minutes without going over rate 20.",
    build: () => [warm(10), rest(60, "Get ready. Rate 20, no higher."), timed(m(30), 4, "30 min at r20", "Rate 20 only. Big, long strokes. Go for distance."), cool(5)],
  },
];

export const rowWorkoutById = new Map(ROW_WORKOUTS.map(w => [w.id, w]));

/** The steps of a picked workout. */
export function rowWorkoutSteps(id, len = "standard", profile = null) {
  const w = rowWorkoutById.get(id);
  return w ? w.build(len, profile) : null;
}

/** For "4 × 1000 m" style labels and the shape of a set. */
export const hasDistanceSteps = steps => Boolean(steps?.some(s => s.meters));

/**
 * Turn distance steps into timed ones (for when nothing measures distance,
 * like an indoor row with no machine connected). The estimate stays as the time.
 */
export const timeOnly = steps =>
  steps?.map(s => {
    if (!s.meters) return s;
    const { meters, ...rest } = s;
    return { ...rest, estimated: meters };
  }) ?? null;
