// Training plans built from published exercise guidelines. Plain
// functions, testable in Node.
//
// - WHO 2020 physical activity guidelines: 150–300 min/week of moderate
//   aerobic activity (or 75–150 vigorous) plus muscle strengthening for all
//   major muscle groups on 2+ days a week.
// - ACSM position stand on resistance training progression (2009): novices
//   train each muscle group 2–3 days a week with 1–3 sets of 8–12 reps;
//   add 2–10% load once you can do 1–2 reps more than the target.
// - Weekly set volume: around 10+ hard sets per muscle per week gives more
//   growth than fewer (Schoenfeld, Ogborn & Krieger 2017 meta-analysis).
// - Endurance: most elite and recreational endurance training is easy, with
//   a smaller share hard ("polarized", about 80/20; Seiler 2010). 4 × 4 min
//   at about 90–95% of max heart rate raises VO2max more than steady
//   running (Helgerud et al. 2007).
// - Build volume gradually and ease off every few weeks: a lighter
//   (deload) week every fourth week is common practice in periodized
//   plans; run/walk progressions for new runners follow the same idea.

import { addDays, parseDay } from "./dates.js";

export const GOALS = [
  { id: "general", name: "General fitness", hint: "Hit the WHO guidelines: cardio most days, strength twice a week" },
  { id: "strength", name: "Get stronger", hint: "Three full-body strength days with steady progression" },
  { id: "cardio", name: "Better cardio", hint: "Mostly easy aerobic work plus one hard interval day" },
  { id: "5k", name: "First 5K", hint: "Run/walk to running 30 minutes without stopping" },
];

export const LEVELS = [
  { id: "new", name: "New to it" },
  { id: "some", name: "Some experience" },
];

export const CARDIO_TYPES = [
  { id: "run", name: "Running", activityId: "run-easy" },
  { id: "bike", name: "Cycling", activityId: "bike-easy" },
  { id: "walk", name: "Brisk walking", activityId: "brisk" },
];

export const TIMES = [
  { id: "any", name: "Any time", earliest: 6, latest: 21 },
  { id: "morning", name: "Mornings", earliest: 5, latest: 11 },
  { id: "midday", name: "Midday", earliest: 10, latest: 15 },
  { id: "evening", name: "Evenings", earliest: 16, latest: 21 },
];

const STRENGTH_A = ["Squat (goblet or barbell)", "Push-up or bench press", "One-arm dumbbell row", "Romanian deadlift", "Plank"];
const STRENGTH_B = ["Split squat or lunge", "Overhead press", "Pull-up or lat pulldown", "Hip thrust or glute bridge", "Side plank"];

// Which weekdays (0 = Sunday) get a session, spread out across the week.
const DAY_PATTERNS = {
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

// Session types for each goal and number of days, in weekday order.
const TEMPLATES = {
  general: {
    3: ["strengthA", "easy", "strengthB"],
    4: ["strengthA", "easy", "strengthB", "long"],
    5: ["easy", "strengthA", "easy", "strengthB", "long"],
    6: ["easy", "strengthA", "easy", "strengthB", "easy", "long"],
  },
  strength: {
    3: ["strengthA", "strengthB", "strengthA"],
    4: ["strengthA", "easy", "strengthB", "strengthA"],
    5: ["strengthA", "easy", "strengthB", "easy", "strengthA"],
    6: ["strengthA", "easy", "strengthB", "easy", "strengthA", "long"],
  },
  cardio: {
    3: ["easy", "intervals", "long"],
    4: ["easy", "intervals", "strengthA", "long"],
    5: ["easy", "intervals", "easy", "strengthA", "long"],
    6: ["easy", "intervals", "easy", "strengthA", "easy", "long"],
  },
};

// Weeks of a run/walk progression to 30 minutes of running.
const FIVE_K = [
  { run: 1, walk: 1.5, reps: 8 },
  { run: 1.5, walk: 2, reps: 6 },
  { run: 2, walk: 2, reps: 6 },
  { run: 3, walk: 2, reps: 5 },
  { run: 5, walk: 2, reps: 4 },
  { run: 8, walk: 2, reps: 3 },
  { run: 12, walk: 2, reps: 2 },
  { run: 20, walk: 0, reps: 1 },
  { run: 30, walk: 0, reps: 1 },
];

const isDeload = week => week % 4 === 3;

// How much a week builds on the first: about 8% a week, lighter weeks
// don't count toward the build, and volume tops out at +60%.
export function weekFactor(week) {
  const built = week - Math.floor((week + 1) / 4);
  const factor = Math.min(1.6, 1 + 0.08 * built);
  return isDeload(week) ? Math.round(factor * 0.7 * 100) / 100 : Math.round(factor * 100) / 100;
}

const round5 = minutes => Math.max(10, Math.round(minutes / 5) * 5);

function strengthSession(kind, week, level) {
  const list = kind === "strengthA" ? STRENGTH_A : STRENGTH_B;
  const deload = isDeload(week);
  // Two sets to start, three from week 3, back to two on lighter weeks.
  const sets = deload ? 2 : level === "new" && week < 2 ? 2 : 3;
  const reps = level === "new" ? "10–12" : week % 8 < 4 ? "8–10" : "6–8";
  return {
    type: "strength",
    title: kind === "strengthA" ? "Strength A" : "Strength B",
    minutes: sets === 2 ? 40 : 50,
    intensity: deload ? "Lighter week: same exercises, fewer sets" : "Stop each set with 1–3 reps left in the tank",
    steps: [
      "Warm up 5–10 minutes: easy cardio, then a light set of the first exercise",
      ...list.map(name => `${name}: ${sets} × ${name.includes("lank") ? "30–45 s" : reps}`),
      "Rest 1–2 minutes between sets. When every set reaches the top of the rep range, add a little weight next time (about 2–10%).",
    ],
    outdoor: false,
  };
}

function cardioSession(kind, week, level, cardio) {
  const base = level === "new" ? { easy: 25, long: 35, intervals: 30 } : { easy: 35, long: 55, intervals: 40 };
  const f = weekFactor(week);
  const verb = cardio.name.replace(/^Brisk walking$/, "Brisk walk").replace(/^Running$/, "Run").replace(/^Cycling$/, "Ride");
  if (kind === "intervals") {
    const reps = isDeload(week) ? 2 : level === "new" ? 3 : 4;
    return {
      type: "cardio",
      title: `Intervals: ${reps} × 4 min`,
      minutes: round5(base.intervals + (reps - 3) * 7),
      intensity: "Hard intervals at about 90–95% of max heart rate (breathing hard, a few words at a time)",
      steps: ["Warm up 10 minutes easy", `${reps} × 4 minutes hard, with 3 minutes easy between`, "Cool down 5–10 minutes easy"],
      outdoor: true,
    };
  }
  const minutes = round5(base[kind] * f);
  return {
    type: "cardio",
    title: `${kind === "long" ? "Long" : "Easy"} ${verb.toLowerCase()}: ${minutes} min`,
    minutes,
    intensity: "Easy, conversational pace: you could talk in full sentences",
    steps: [kind === "long" ? "Keep it easy the whole way. This builds your aerobic base." : "Easy effort. Most of your training should feel like this."],
    outdoor: true,
  };
}

function fiveKSession(week) {
  const step = FIVE_K[Math.min(week, FIVE_K.length - 1)];
  const minutes = round5(10 + step.reps * (step.run + step.walk));
  return {
    type: "cardio",
    title: step.walk ? `Run/walk: ${step.reps} × ${step.run} min run` : `Run ${step.run} min`,
    minutes,
    intensity: "Run slowly enough to talk. Walking breaks are part of the plan.",
    steps: [
      "Warm up with a 5-minute brisk walk",
      step.walk ? `${step.reps} rounds: run ${step.run} min, walk ${step.walk} min` : `Run ${step.run} minutes without stopping`,
      "Cool down with a 5-minute walk",
    ],
    outdoor: true,
  };
}

/**
 * Every session of a plan: [{ id, day, week, title, minutes, type,
 * intensity, steps, outdoor, activityId }]. program: { id, goal, level,
 * days, start (day key), weeks, cardio, time }.
 */
export function planSessions(program) {
  if (!program?.start) return [];
  const cardio = CARDIO_TYPES.find(c => c.id === program.cardio) ?? CARDIO_TYPES[0];
  const days = program.goal === "5k" ? 3 : Math.min(6, Math.max(3, program.days || 3));
  const pattern = DAY_PATTERNS[days];
  const weeks = program.goal === "5k" ? FIVE_K.length : program.weeks || 12;
  // Plans start on the Sunday of the start week; days before the start are skipped.
  const first = addDays(program.start, -parseDay(program.start).getDay());
  const out = [];
  for (let week = 0; week < weeks; week++) {
    pattern.forEach((weekday, i) => {
      const day = addDays(first, week * 7 + weekday);
      if (day < program.start) return;
      const kind = program.goal === "5k" ? "5k" : TEMPLATES[program.goal]?.[days]?.[i] ?? "easy";
      const session =
        kind === "5k" ? fiveKSession(week) : kind.startsWith("strength") ? strengthSession(kind, week, program.level) : cardioSession(kind, week, program.level, cardio);
      out.push({
        ...session,
        id: `${program.id}:${day}`,
        day,
        week: week + 1,
        deload: isDeload(week) && program.goal !== "5k",
        activityId: session.outdoor ? (program.goal === "5k" ? "run-easy" : cardio.activityId) : null,
      });
    });
  }
  return out;
}

/** Weekly totals, for checking a plan against the guidelines. */
export function weeklyMinutes(sessions) {
  const weeks = new Map();
  for (const s of sessions) {
    const w = weeks.get(s.week) ?? { cardio: 0, strengthDays: 0 };
    if (s.type === "cardio") w.cardio += s.minutes;
    else w.strengthDays += 1;
    weeks.set(s.week, w);
  }
  return weeks;
}

export function describeProgram(program) {
  const goal = GOALS.find(g => g.id === program.goal);
  const days = program.goal === "5k" ? 3 : program.days;
  const weeks = program.goal === "5k" ? FIVE_K.length : program.weeks;
  return `${goal?.name ?? "Plan"} · ${days} days a week · ${weeks} weeks`;
}
