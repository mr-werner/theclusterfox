// Builds a week-by-week plan from today to your test day.
//
// The plan trains every event on your job's test: running speed and
// distance, swimming (for the water tests), calisthenics sets built from
// your current maxes, and strength work for the Army deadlift and
// sprint-drag-carry. Volume builds for three weeks and eases off in the
// fourth, a practice test closes each block, and the last week tapers.
// It is general guidance in the style of the services' own prep guides,
// not an official program.

import { EVENTS } from "../data/jobs.js";
import { standardsFor } from "./scoring.js";
import { addDays, daysBetween, fmtTime, toIsoDay, weekday } from "./units.js";

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 26;

const liftLink = ex => `/lift?tab=library&ex=${encodeURIComponent(ex)}`;
const round5 = n => Math.max(5, Math.round(n / 5) * 5);

/** What the test needs you to train. */
export function needsOf(job) {
  const ids = job.test.events.map(e => e.id);
  const sports = new Set(ids.map(id => EVENTS[id].sport));
  return {
    swim: sports.has("swim") && ids.some(id => EVENTS[id].kind === "time" && EVENTS[id].sport === "swim"),
    underwater: ids.includes("afUnderwater"),
    strength: sports.has("strength"),
    sprint: sports.has("sprint"),
    ruck: job.branch === "airforce" && job.selective ? true : job.id === "army-combat",
    ids,
  };
}

/** Estimated current result for an event: your logged score, or a cautious guess below the minimum. */
function current(id, std, baseline) {
  const ev = EVENTS[id];
  const v = baseline?.[id];
  if (v != null && v !== "" && ev.kind !== "pass") return Number(v);
  const min = typeof std.min === "object" && std.min ? Object.values(std.min)[0] : std.min;
  if (min == null) return null;
  if (ev.kind === "time") return Math.round(min * 1.12);
  return Math.max(1, Math.round(min * 0.7));
}

/** Where to aim: the higher score if chosen (and published), else a little past the minimum. */
function goal(id, std, target, now) {
  const ev = EVENTS[id];
  let g = target === "aim" && std.aim != null ? std.aim : std.min;
  if (g && typeof g === "object") g = Object.values(g)[0];
  if (g == null) return now;
  // Train for a margin over the line; tests are taken tired.
  g = ev.kind === "time" ? Math.round(g * 0.97) : Math.ceil(g * 1.1);
  if (now == null) return g;
  // Already past it: keep improving a little.
  if (ev.kind === "time" ? now <= g : now >= g) g = ev.kind === "time" ? Math.round(now * 0.97) : Math.ceil(now * 1.08);
  return g;
}

/** The result to train at in a given week, moving from now to the goal. */
const stepToward = (now, g, frac) => now + (g - now) * Math.min(1, Math.max(0, frac));

function phaseOf(w, weeks) {
  if (w === weeks - 1) return "taper";
  if ((w + 1) % 4 === 0) return "ease";
  const f = w / Math.max(1, weeks - 1);
  return f < 0.4 ? "base" : f < 0.8 ? "build" : "sharpen";
}

export const PHASE_NAMES = {
  base: "Base",
  build: "Build",
  sharpen: "Sharpen",
  ease: "Easier week",
  taper: "Taper",
};

const PHASE_LOAD = { base: 1, build: 1.15, sharpen: 1.2, ease: 0.7, taper: 0.55 };

/* ---------------- session builders ---------------- */

function runEventOf(ids) {
  return ids.find(id => EVENTS[id].sport === "run");
}

function runSpeed(ctx) {
  const { ids, std, week, phase, load } = ctx;
  const id = runEventOf(ids);
  if (!id) return null;
  const s = std[id];
  const miles = id === "run2" ? 2 : id === "run3Af" ? 3 : 1.5;
  const goalSec = ctx.goals[id];
  const perMile = goalSec / miles;
  const per400 = perMile / 4.023;
  const lines = ["Warm up: 10 minutes easy jog, then 4 × 20-second strides."];
  if (phase === "base" || phase === "ease" || phase === "taper") {
    const reps = Math.max(3, Math.round((5 + week * 0.5) * load));
    lines.push(`${reps} × 400 m in ${fmtTime(per400 + 4)} each, walking or jogging 90 seconds between.`);
  } else if (phase === "build") {
    const reps = Math.max(3, Math.round(4 * load));
    lines.push(`${reps} × 800 m in ${fmtTime(per400 * 2)} each (your goal pace), 2 minutes easy between.`);
  } else {
    lines.push(`3 × 1,200 m in ${fmtTime(per400 * 3 - 3)} each (a little faster than goal pace), 3 minutes easy between.`);
  }
  lines.push("Cool down: 10 minutes easy.");
  return {
    kind: "run",
    title: "Run: speed",
    minutes: 40,
    blocks: [{ title: `Goal pace ${fmtTime(perMile)} per mile (${fmtTime(goalSec)} for the ${s.event.name.toLowerCase()})`, lines }],
  };
}

function runLong(ctx) {
  const { week, load, weeks, needs } = ctx;
  const base = 25 + Math.round((week / Math.max(1, weeks - 1)) * 30);
  const minutes = Math.max(20, Math.round(base * load));
  const blocks = [
    {
      title: `${minutes} minutes easy`,
      lines: [
        "Easy enough to hold a conversation the whole way.",
        "Flat roads or trails are fine; this builds the engine your fast runs sit on.",
      ],
    },
  ];
  if (needs.ruck && ctx.phase !== "taper" && week % 2 === 1) {
    const ruckMin = Math.min(60, 30 + week * 3);
    blocks.push({
      title: `Instead, every other week: ruck ${ruckMin} minutes with ${week < 6 ? 20 : 30} lb`,
      lines: ["Walk briskly in boots you'll train in. Build weight slowly; stop if anything hurts more than tired muscles."],
    });
  }
  return { kind: "run", title: "Run: long and easy", minutes, blocks };
}

function calisthenics(ctx, variant = "sets") {
  const { ids, frac, load, now } = ctx;
  const blocks = [];
  for (const id of ids) {
    const ev = EVENTS[id];
    if (!["push", "pull", "core"].includes(ev.sport)) continue;
    if (ev.kind === "hold") {
      const target = stepToward(now[id] ?? 40, ctx.goals[id] ?? 60, frac);
      const hold = Math.max(20, Math.round((target * 0.6 * load) / 5) * 5);
      blocks.push({
        title: "Plank",
        lines: [`3 holds of ${fmtTime(hold)}, 1 minute rest between.`, "Add 2 sets of 30-second side planks each side."],
        link: liftLink("plank"),
      });
      continue;
    }
    if (ev.kind !== "reps") continue;
    const nowV = now[id] ?? 5;
    const g = ctx.goals[id] ?? nowV + 5;
    const maxNow = stepToward(nowV, g, frac);
    const isPull = ev.sport === "pull";
    const name = ev.options ? "Pull-ups (or push-ups)" : ev.short;
    if (isPull && maxNow < 4) {
      blocks.push({
        title: name,
        lines: [
          `${Math.round(4 * load) || 3} sets of 3 slow pull-up lowers (5 seconds down from the top).`,
          "Then 3 dead hangs as long as you can hold.",
          "Try one strict pull-up at the start of each session; count any you get.",
        ],
        link: liftLink("negative-pull-up"),
      });
      continue;
    }
    if (variant === "ladder") {
      const top = Math.max(3, Math.round(maxNow / (isPull ? 2.5 : 3)));
      blocks.push({
        title: `${name}: ladder`,
        lines: [`1 rep, rest, 2 reps, rest, … up to ${top}, then back down to 1. Rest as long as the last set took.`],
        link: liftLink(isPull ? "pull-up" : ev.sport === "push" ? "push-up" : "crunch"),
      });
      continue;
    }
    const sets = Math.max(3, Math.round((isPull ? 5 : 4) * load));
    const reps = Math.max(2, Math.round(maxNow * (isPull ? 0.5 : 0.55)));
    blocks.push({
      title: name,
      lines: [`${sets} sets of ${reps}, 60–90 seconds rest. Every rep to the test's standard.`],
      link: liftLink(isPull ? "pull-up" : ev.sport === "push" ? "push-up" : "crunch"),
    });
  }
  if (!blocks.length) return null;
  return {
    kind: "cals",
    title: variant === "ladder" ? "Calisthenics: ladders" : "Calisthenics",
    minutes: 35,
    blocks: [{ title: "Warm up", lines: ["5 minutes easy cardio, arm circles, and a few easy reps of each exercise."] }, ...blocks],
  };
}

function swim(ctx, second = false) {
  const { ids, phase, load, needs } = ctx;
  const id = ids.find(x => EVENTS[x].sport === "swim" && EVENTS[x].kind === "time");
  if (!id) return null;
  const ev = EVENTS[id];
  const units = id === "swim500y" || id === "swim500yAirr" ? "yd" : "m";
  const lengths = id === "swim1500m" ? 15 : 5;
  const per100 = ctx.goals[id] / lengths;
  const stroke = id === "swim500y" ? "side-stroke or breaststroke (the test strokes)" : "your test stroke";
  const lines = [`Warm up: 200 ${units} easy, any stroke.`];
  if (second) {
    lines.push(`Technique: 8 × 50 ${units} of ${stroke}, focusing on a long glide each stroke. 20 seconds rest.`);
    const dist = Math.round((600 + ctx.week * 50) * load / 50) * 50;
    lines.push(`Then ${dist} ${units} steady and smooth without stopping.`);
  } else if (phase === "base" || phase === "ease" || phase === "taper") {
    const reps = Math.max(4, Math.round(6 * load));
    lines.push(`${reps} × 100 ${units} ${stroke} in ${fmtTime(per100 + 5)} each, 30 seconds rest.`);
  } else if (phase === "build") {
    const reps = Math.max(3, Math.round(4 * load));
    lines.push(`${reps} × 200 ${units} ${stroke} in ${fmtTime(per100 * 2)} each, 45 seconds rest.`);
  } else {
    lines.push(`2 × 300 ${units} at goal pace (${fmtTime(per100 * 3)}), 1 minute rest, then 4 × 50 ${units} fast.`);
  }
  lines.push(`Cool down: 100 ${units} easy.`);
  const blocks = [{ title: `Goal ${fmtTime(ctx.goals[id])} for the ${ev.name.toLowerCase()} (${fmtTime(per100)} per 100 ${units})`, lines }];
  if (needs.underwater && !second && phase !== "taper") {
    blocks.push({
      title: "Underwater 25 m practice",
      lines: [
        "Only with a lifeguard or a trained partner watching you from the side, never alone.",
        "2 to 4 easy attempts with full recovery between. Don't hyperventilate first: that is how swimmers black out.",
      ],
    });
  }
  return { kind: "swim", title: second ? "Swim: technique and distance" : "Swim: pace", minutes: 45, blocks };
}

function strength(ctx) {
  const { ids, frac, load, now, phase } = ctx;
  if (!ids.includes("mdl")) return null;
  const rm = stepToward(now.mdl ?? 150, ctx.goals.mdl ?? 200, frac);
  const work = round5(rm * (phase === "taper" ? 0.7 : 0.85));
  const sets = Math.max(3, Math.round(5 * load));
  const blocks = [
    { title: "Hex-bar or barbell deadlift", lines: [`Warm-up sets, then ${sets} × 3 at ${work} lb. Same form every rep: flat back, push the floor away.`], link: liftLink("deadlift") },
  ];
  if (ids.includes("sdc")) {
    const sdcNow = now.sdc ?? 160;
    blocks.push({
      title: "Sprint-drag-carry practice",
      lines: [
        `4 rounds: 2 × 25 m sprint, 2 × 25 m heavy drag (sled, or a loaded tire or towel on turf), 2 × 25 m side shuffle, 2 × 25 m carry with two 40-lb kettlebells or dumbbells.`,
        `Rest 3 minutes between rounds. Your last full run-through was about ${fmtTime(sdcNow)}; aim for ${fmtTime(ctx.goals.sdc)}.`,
      ],
      link: liftLink("farmer-carry"),
    });
  }
  return { kind: "strength", title: "Strength and power", minutes: 50, blocks };
}

function recovery(ctx) {
  return {
    kind: "recovery",
    title: ctx.needs.ruck ? "Ruck or easy cardio" : "Easy cardio and mobility",
    minutes: 40,
    blocks: [
      {
        title: ctx.needs.ruck ? `Ruck ${Math.min(60, 30 + ctx.week * 2)} minutes with ${ctx.week < 6 ? 20 : 30} lb, or 30 minutes easy bike/row` : "30 minutes easy bike, row or swim",
        lines: ["Then 10 minutes of hips, hamstrings, shoulders and calves."],
      },
    ],
  };
}

function practiceTest(ctx, final = false) {
  const { job } = ctx;
  const lines = job.test.order.map(o => {
    const ev = EVENTS[o.event];
    return `${ev.name}${o.rest ? `, then rest ${fmtTime(o.rest)}` : ""}`;
  });
  return {
    kind: final ? "test" : "practice",
    title: final ? `Test day: ${job.test.name}` : "Practice test",
    minutes: 75,
    blocks: [
      {
        title: final ? "In order, as on the day" : "Take the whole test, in order, with the real rests",
        lines: [...lines, final ? "Sleep well, eat what you know, and warm up properly. You've trained for this." : "Log your scores on the Test tab so the plan's numbers stay right."],
      },
    ],
    href: final ? null : "/ready?tab=test",
  };
}

/* ---------------- the plan ---------------- */

/**
 * plan: { jobId, start, testDay, days: [0-6], target: "min"|"aim", baseline: {eventId: value}, profile: {sex, age} }
 * Returns weeks: [{ index, phase, start, sessions: [{ id, day, kind, title, minutes, blocks }] }]
 */
export function buildPlan(plan, job, tables) {
  if (!plan || !job) return [];
  const start = plan.start;
  const testDay = plan.testDay;
  const span = Math.max(0, daysBetween(start, testDay));
  const weeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil(span / 7)));
  const days = [...new Set(plan.days ?? [1, 2, 4, 5, 6])].sort((a, b) => a - b);
  const needs = needsOf(job);
  const stdList = standardsFor(job, plan.profile, tables);
  const std = Object.fromEntries(stdList.map(s => [s.id, s]));
  const now = {};
  const goals = {};
  for (const s of stdList) {
    now[s.id] = current(s.id, s, plan.baseline);
    goals[s.id] = goal(s.id, s, plan.target, now[s.id]);
  }

  const out = [];
  for (let w = 0; w < weeks; w++) {
    const phase = phaseOf(w, weeks);
    const ctx = {
      job,
      ids: needs.ids,
      needs,
      std,
      now,
      goals,
      week: w,
      weeks,
      phase,
      load: PHASE_LOAD[phase],
      frac: (w + 1) / weeks,
    };
    // The order of a week, by how many days you train.
    const A = () => runSpeed(ctx);
    const B = () => calisthenics(ctx);
    const C = () => (needs.swim ? swim(ctx) : needs.strength ? strength(ctx) : calisthenics(ctx, "ladder"));
    const D = () => runLong(ctx);
    const E = () => (needs.swim ? swim(ctx, true) : needs.strength ? calisthenics(ctx, "ladder") : recovery(ctx));
    const F = () => recovery(ctx);
    // Three days a week: the calisthenics ride along with the speed run.
    const AB = () => {
      const run = A();
      const cals = B();
      if (!run || !cals) return run ?? cals;
      return { ...run, title: `${run.title} + calisthenics`, minutes: run.minutes + 25, blocks: [...run.blocks, ...cals.blocks.slice(1)] };
    };
    const order = { 3: [AB, C, D], 4: [A, C, B, D], 5: [A, C, B, D, E], 6: [A, C, B, D, E, F], 7: [A, C, B, D, E, F, F] }[Math.min(7, Math.max(3, days.length))];

    const weekStart = addDays(start, w * 7);
    const sessions = [];
    const dayList = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (d >= testDay) break;
      if (days.includes(weekday(d))) dayList.push(d);
    }
    dayList.forEach((day, i) => {
      const make = order[i % order.length];
      let s = make() ?? calisthenics(ctx) ?? recovery(ctx);
      const isLastOfWeek = i === dayList.length - 1;
      if (isLastOfWeek && phase === "ease") s = practiceTest(ctx);
      sessions.push({ ...s, id: `w${w + 1}d${i + 1}`, day, week: w });
    });
    if (w === weeks - 1 || addDays(weekStart, 7) > testDay) {
      sessions.push({ ...practiceTest(ctx, true), id: "test", day: testDay, week: w });
    }
    out.push({ index: w, phase, start: weekStart, sessions });
    if (sessions.some(s => s.id === "test")) break;
  }
  return out;
}

export const allSessions = weeks => weeks.flatMap(w => w.sessions);

export function nextSession(weeks, plan, today = toIsoDay(new Date())) {
  return allSessions(weeks).find(s => s.day >= today && !plan.completed?.[s.id]) ?? null;
}

/** Default test day: 12 weeks from today. */
export const defaultTestDay = (today = toIsoDay(new Date())) => addDays(today, 12 * 7);
