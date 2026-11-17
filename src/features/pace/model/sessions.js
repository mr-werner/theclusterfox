// The kinds of session in a PaceFox plan and the steps inside each one.
// A plan stores only a session's kind and length; the steps are built
// here when they are shown or followed, so the live guide, the calendar
// and the diet planner always agree on what the session is.
//
// A step: { label, kind: "warm"|"work"|"rest"|"steady"|"cool", sec, zone, cue?, rep?: [i, n], open? }
// open means the step has no set end (a race or a test): it runs until you finish.

import { eventById } from "../data/events.js";

const NAMES = {
  easy: { run: "Easy run", ride: "Endurance ride", row: "Steady state (UT2)" },
  recovery: { run: "Recovery jog", ride: "Recovery spin", row: "Recovery paddle" },
  long: { run: "Long run", ride: "Long ride", row: "Long steady row" },
  strides: { run: "Easy run + strides" },
  runwalk: { run: "Run/walk" },
  fartlek: { run: "Fartlek" },
  hills: { run: "Hill repeats" },
  speed: { run: "Speed: short fast reps" },
  tempo: { run: "Tempo run", ride: "Tempo blocks", row: "Tempo pieces" },
  ut1: { row: "UT1 pieces" },
  threshold: { run: "Threshold intervals", ride: "Threshold intervals", row: "Threshold (AT) pieces" },
  vo2: { run: "VO2 max intervals", ride: "VO2 max intervals", row: "Transport rate (TR) pieces" },
  cadence: { ride: "Cadence drills" },
  sprints: { ride: "Sprint efforts" },
  starts: { row: "Race starts" },
  racesim: { ride: "Race simulation" },
  racepace: { run: "Race pace", ride: "Race pace", row: "Race pace pieces" },
  shakeout: { run: "Shakeout + strides", ride: "Openers", row: "Openers" },
  race: { run: "Race day", ride: "Race day", row: "Race day" },
  test: { run: "Time trial", ride: "Power test", row: "Test piece" },
};

const WHY = {
  easy: "Builds the aerobic engine everything else sits on. Keep it truly easy.",
  recovery: "Loosens you up and helps you absorb the hard days. Easier than you think.",
  long: "Your biggest aerobic session of the week: endurance, fueling practice and confidence.",
  strides: "Easy running with a few short, quick, relaxed bursts to keep your legs sharp.",
  runwalk: "Alternating running and walking builds you up safely. The run parts get longer each week.",
  fartlek: "Playful surges on feel. Speed without the pressure of a track.",
  hills: "Strength and power without the pounding of flat-out speed work.",
  speed: "Short, fast and relaxed with full recovery. Teaches your legs to turn over quickly.",
  tempo: "Comfortably hard. Raises the pace you can hold for a long time.",
  ut1: "Firm steady rowing, a step up from UT2. Builds aerobic power.",
  threshold: "Right around the effort you could hold for an hour, broken into chunks.",
  vo2: "Hard intervals that raise your ceiling. Recover fully between them.",
  cadence: "Spinning fast with smooth pedal strokes. Easy on the legs, good for skill.",
  sprints: "Short, all-out efforts for jumps out of corners and finishes, with long rests.",
  starts: "Practice the race start: a few short fast strokes, lengthen out, settle into rhythm.",
  racesim: "Surges on top of hard riding, the way racing really goes.",
  racepace: "Time at the speed you plan to race, so race day feels familiar.",
  shakeout: "Short and easy with a few quick efforts to wake your legs up for tomorrow.",
  race: "This is what you trained for. Warm up, start controlled, finish strong.",
  test: "An honest, even effort so you can see your progress and set your zones.",
};

// The zone each event is raced at.
const RACE_ZONE = {
  "run-mile": 5, "run-5k": 5, "run-10k": 4, "run-half": 4, "run-marathon": 3, "run-trail": 3, "run-fit": 5,
  "ride-crit": 5, "ride-road": 4, "ride-tt": 4, "ride-fondo": 3, "ride-gravel": 3, "ride-mtb": 5, "ride-fit": 4,
  "row-2k": 5, "row-6k": 4, "row-head": 4, "row-sprint": 5, "row-fit": 5,
};
export const raceZoneFor = eventId => RACE_ZONE[eventId] ?? 4;

// A rough race speed in m/s for each level, for the race step's length when
// there is no recent result to predict from.
const ROUGH_SPEED = { run: { new: 2.5, regular: 3.2, experienced: 4 }, ride: { new: 6.5, regular: 8.5, experienced: 10 }, row: { new: 3.6, regular: 4.2, experienced: 4.7 } };

export const sessionName = (type, sport) => NAMES[type]?.[sport] ?? NAMES[type]?.run ?? "Session";
export const sessionWhy = type => WHY[type] ?? "";
export const KINDS = Object.keys(NAMES);
export const isQuality = type => !["easy", "recovery", "long", "strides", "runwalk", "cadence", "shakeout"].includes(type);

const m = n => Math.round(n * 60);
const warm = (min, cue) => ({ label: "Warm up", kind: "warm", sec: m(min), zone: 1, cue });
const cool = min => ({ label: "Cool down", kind: "cool", sec: m(min), zone: 1, cue: "Ease off and let your breathing settle." });
const steady = (min, zone, label, cue) => ({ label, kind: "steady", sec: m(min), zone, cue });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** n repeats of work then rest (no rest after the last one). */
function reps(n, work, rest) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ ...work, rep: [i + 1, n] });
    if (rest && i < n - 1) out.push({ ...rest, rep: [i + 1, n] });
  }
  return out;
}

/** How many reps of (work + rest) seconds fit in the minutes left. */
const fit = (mainMin, workSec, restSec, lo, hi) => clamp(Math.round((mainMin * 60 + restSec) / (workSec + restSec)), lo, hi);

function interval({ min, warmMin = 12, coolMin = 10, workSec, restSec, zone, restZone = 1, lo = 2, hi = 10, workLabel, restLabel, cue, restCue }) {
  const main = Math.max(workSec / 60, min - warmMin - coolMin);
  const n = fit(main, workSec, restSec, lo, hi);
  return [
    warm(warmMin, "Start easy and build gradually."),
    ...reps(n, { label: workLabel, kind: "work", sec: workSec, zone, cue }, restSec ? { label: restLabel ?? "Easy", kind: "rest", sec: restSec, zone: restZone, cue: restCue ?? "Recover. Breathe." } : null),
    cool(coolMin),
  ];
}

/**
 * The steps of a session.
 * ctx: { sport, minutes, level, phase, weekIndex, eventId, profile? , raceSec? }
 */
export function buildSteps(type, ctx) {
  const { sport, minutes: min, level = "regular", weekIndex = 0, eventId } = ctx;
  const event = eventById.get(eventId);
  const rowRate = z => (sport === "row" ? ` Rate ${["", "18–20", "18–22", "22–24", "24–28", "30–34", "36+"][z]}.` : "");

  switch (type) {
    case "runwalk": {
      const run = clamp(2 + weekIndex, 2, 9);
      const walk = run >= 6 ? 1 : 1.5;
      const n = fit(min - 10, m(run), m(walk), 3, 12);
      return [
        warm(5, "Brisk walk to warm up."),
        ...reps(n, { label: "Run", kind: "work", sec: m(run), zone: 2, cue: "Run gently. Easy enough to talk." }, { label: "Walk", kind: "rest", sec: m(walk), zone: 1, cue: "Walk briskly." }),
        cool(5),
      ];
    }
    case "easy":
      return [warm(5, "Ease in."), steady(Math.max(5, min - 10), 2, sport === "row" ? "Steady state" : "Easy", `Relaxed and steady.${rowRate(2)}`), cool(5)];
    case "recovery":
      return [steady(Math.max(10, min), 1, "Recovery", `Very easy. If in doubt, slower.${rowRate(1)}`)];
    case "long": {
      const racePaceFinish = ctx.phase === "peak" && event?.longRacePace;
      if (racePaceFinish) {
        const finish = Math.round(min * 0.25);
        return [warm(10, "Very easy first miles."), steady(min - 15 - finish, 2, "Steady", "Easy, steady and patient. Practice eating and drinking."), steady(finish, raceZoneFor(eventId), "Race pace finish", "Pick it up to race pace and hold it."), cool(5)];
      }
      const climbs = sport === "ride" && ctx.phase !== "base" && min >= 120;
      if (climbs) {
        const blocks = clamp(Math.floor(min / 60), 2, 4);
        const each = (min - 20) / blocks;
        const parts = [];
        for (let i = 0; i < blocks; i += 1) {
          parts.push(steady(each - 12, 2, "Endurance", "Steady endurance pace. Eat every 30–45 minutes."));
          parts.push({ label: "Tempo block", kind: "work", sec: m(12), zone: 3, cue: "Settle into tempo, like a long climb.", rep: [i + 1, blocks] });
        }
        return [warm(10, "Spin easy."), ...parts, cool(10)];
      }
      return [warm(10, "Start easy."), steady(Math.max(10, min - 15), 2, "Endurance", `Easy and steady.${rowRate(2)} ${min >= 75 ? "Eat and drink as you go." : ""}`.trim()), cool(5)];
    }
    case "strides":
      return [
        warm(5, "Ease in."),
        steady(Math.max(5, min - 15), 2, "Easy", "Relaxed easy running."),
        ...reps(6, { label: "Stride", kind: "work", sec: 20, zone: 6, cue: "Quick and relaxed, not a sprint." }, { label: "Walk back", kind: "rest", sec: 60, zone: 1 }),
        cool(3),
      ];
    case "fartlek":
      return interval({ min, warmMin: 10, coolMin: 5, workSec: 60, restSec: 120, zone: 4, restZone: 2, lo: 4, hi: 12, workLabel: "Surge", restLabel: "Float", cue: "Surge. Strong but smooth.", restCue: "Float back to easy running." });
    case "hills":
      return interval({ min, workSec: level === "new" ? 45 : 75, restSec: 120, zone: 5, lo: 4, hi: 10, workLabel: "Uphill", restLabel: "Jog down", cue: "Up the hill. Drive your arms, tall posture.", restCue: "Jog easy back down." });
    case "speed":
      return interval({ min, warmMin: 15, workSec: 40, restSec: 80, zone: 6, lo: 6, hi: 12, workLabel: "Fast", restLabel: "Walk/jog", cue: "Fast and relaxed. Quick feet." });
    case "tempo": {
      if (sport === "ride" || sport === "row") {
        const work = sport === "ride" ? m(15) : m(level === "new" ? 8 : 12);
        return interval({ min, warmMin: 12, coolMin: 8, workSec: work, restSec: m(4), zone: 3, lo: 2, hi: 4, workLabel: "Tempo", cue: `Comfortably hard and steady.${rowRate(3)}` });
      }
      const main = Math.max(10, min - 22);
      if (main > 30) {
        const half = (main - 3) / 2;
        return [warm(12, "Easy jog, then a few quick strides."), { ...steady(half, 3, "Tempo"), kind: "work", rep: [1, 2], cue: "Comfortably hard. Even effort." }, { ...steady(3, 1, "Easy"), kind: "rest", rep: [1, 2] }, { ...steady(half, 3, "Tempo"), kind: "work", rep: [2, 2], cue: "Same effort as the first." }, cool(10)];
      }
      return [warm(12, "Easy jog, then a few quick strides."), { ...steady(main, 3, "Tempo"), kind: "work", cue: "Comfortably hard. Even effort." }, cool(10)];
    }
    case "ut1":
      return interval({ min, warmMin: 10, coolMin: 5, workSec: m(level === "new" ? 10 : 15), restSec: m(3), zone: 3, lo: 2, hi: 4, workLabel: "UT1", cue: `Firm and steady.${rowRate(3)}` });
    case "threshold": {
      const work = sport === "ride" ? (level === "experienced" && min >= 75 ? m(20) : m(10)) : sport === "row" ? m(8) : m(level === "new" ? 5 : 8);
      const rest = sport === "ride" ? m(work >= m(20) ? 5 : 3) : sport === "row" ? m(2) : 90;
      return interval({ min, workSec: work, restSec: rest, zone: 4, lo: 2, hi: 6, workLabel: "Threshold", cue: `Hard but controlled. Hold it even.${rowRate(4)}` });
    }
    case "vo2": {
      const work = sport === "ride" ? m(4) : sport === "row" ? m(4) : m(3);
      const rest = sport === "ride" ? m(4) : sport === "row" ? m(3) : m(2);
      return interval({ min, warmMin: 15, workSec: work, restSec: rest, zone: 5, lo: 3, hi: 7, workLabel: "Hard", cue: `Hard. Smooth form, strong breathing.${rowRate(5)}` });
    }
    case "cadence":
      return [
        warm(10, "Spin easy."),
        ...reps(fit(Math.max(10, min - 25), 60, 120, 4, 10), { label: "Fast spin", kind: "work", sec: 60, zone: 2, cue: "Spin 100 to 110 rpm, smooth and quiet on the saddle." }, { label: "Easy", kind: "rest", sec: 120, zone: 2, cue: "Back to normal cadence." }),
        steady(Math.max(5, min - 10 - 25), 2, "Endurance", "Steady endurance riding."),
        cool(5),
      ].filter(s => s.sec > 0);
    case "sprints":
      return interval({ min, warmMin: 15, workSec: 15, restSec: m(4), zone: 6, lo: 5, hi: 10, workLabel: "Sprint", cue: "Sprint! Out of the saddle, everything you have.", restCue: "Spin easy and recover fully." });
    case "starts":
      return interval({ min, warmMin: 15, workSec: 30, restSec: m(2), zone: 6, lo: 6, hi: 10, workLabel: "Start", cue: "Start sequence: three short, then lengthen and settle.", restCue: "Paddle easy." });
    case "racesim": {
      if (eventId === "ride-crit") {
        const sets = clamp(Math.round((min - 30) / 12), 2, 4);
        const set = reps(10, { label: "Jump", kind: "work", sec: 30, zone: 5, cue: "Out of the corner! Jump." }, { label: "Settle", kind: "rest", sec: 30, zone: 3, cue: "Settle in the bunch." });
        const out = [warm(15, "Spin easy, then a couple of short efforts.")];
        for (let i = 0; i < sets; i += 1) {
          out.push(...set.map(s => ({ ...s, label: `${s.label} (set ${i + 1})` })));
          if (i < sets - 1) out.push({ label: "Recover", kind: "rest", sec: m(5), zone: 1, cue: "Easy spin between sets." });
        }
        return [...out, cool(10)];
      }
      return interval({ min, workSec: m(4), restSec: m(3), zone: 5, lo: 3, hi: 6, workLabel: "Over-under", cue: "Hard surge, then hold threshold. Don't sit up." });
    }
    case "racepace": {
      const z = raceZoneFor(eventId);
      const [work, rest] = z >= 5 ? [m(3), m(2)] : z === 4 ? [m(8), m(2)] : [m(15), m(3)];
      return interval({ min, workSec: work, restSec: rest, zone: z, lo: 2, hi: 6, workLabel: "Race pace", cue: `Race pace. Lock in the rhythm you will race at.${rowRate(z)}` });
    }
    case "shakeout":
      return [
        steady(Math.max(8, min - 6), 2, "Easy", "Very easy, just loosening up."),
        ...reps(4, { label: "Quick", kind: "work", sec: 20, zone: 5, cue: "A quick, relaxed burst." }, { label: "Easy", kind: "rest", sec: 60, zone: 1 }),
        steady(2, 1, "Easy"),
      ];
    case "race":
    case "test": {
      const z = raceZoneFor(eventId);
      const sec = ctx.raceSec ?? estimateRaceSec(eventId, level, type === "test");
      const name = type === "test" ? event?.testName ?? "Test" : event?.name ?? "Race";
      const timed = type === "test" && event?.testMinutes;
      return [
        warm(15, "Easy, then a few short efforts at race pace."),
        { label: name, kind: "work", sec: timed ? m(event.testMinutes) : Math.round(sec), zone: z, open: !timed, cue: "Start controlled, settle in, and finish strong." },
        cool(10),
      ];
    }
    default:
      return [steady(min, 2, "Steady")];
  }
}

/** A rough race or test length in seconds, for planning and the live guide. */
export function estimateRaceSec(eventId, level = "regular", isTest = false) {
  const event = eventById.get(eventId);
  if (!event) return 3600;
  if (isTest && event.testMinutes) return event.testMinutes * 60;
  const dist = isTest ? event.testDistanceM : event.distanceM;
  if (!dist) return (event.raceMinutes ?? 60) * 60;
  const v = ROUGH_SPEED[event.sport]?.[level] ?? 3;
  // Longer races go slower.
  const slow = event.sport === "run" ? Math.pow(dist / 5000, 0.06) : 1;
  return dist / (v / slow);
}

export const stepsSeconds = steps => steps.reduce((n, s) => n + s.sec, 0);

/** Group repeats for display: [{ step } | { set: [work, rest], n }]. */
export function groupSteps(steps) {
  const out = [];
  for (let i = 0; i < steps.length; i += 1) {
    const s = steps[i];
    if (s.rep && s.rep[0] === 1) {
      const n = s.rep[1];
      const work = s;
      const rest = steps[i + 1]?.rep && steps[i + 1].kind === "rest" ? steps[i + 1] : null;
      const span = rest ? n * 2 - 1 : n;
      const block = steps.slice(i, i + span);
      // Only group when the block really is the same pair repeated.
      if (block.every(b => b.rep && b.rep[1] === n)) {
        out.push({ set: true, n, work, rest });
        i += span - 1;
        continue;
      }
    }
    out.push({ step: s });
  }
  return out;
}

// Energy per sport and zone (METs, from the Compendium of Physical Activities).
const MET = { run: [0, 7, 8.5, 10, 11, 11.5, 12], ride: [0, 5.5, 6.8, 8.5, 10, 11, 12], row: [0, 4.8, 7, 8.5, 10, 12, 12] };

/** The average MET of a list of steps. */
export function averageMet(steps, sport) {
  const table = MET[sport] ?? MET.run;
  const total = stepsSeconds(steps);
  if (!total) return table[2];
  return steps.reduce((n, s) => n + table[clamp(s.zone, 1, 6)] * s.sec, 0) / total;
}
export const metFor = (sport, zone) => (MET[sport] ?? MET.run)[clamp(zone, 1, 6)];
