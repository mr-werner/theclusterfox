// Builds a jump-higher plan from a few choices. The plan is worked out
// again from its options whenever it's shown, so only the options (and
// what you've ticked off) are saved. Same options in, same plan out.
//
// The shape follows how jump coaches usually build a block: learn to land
// and strengthen tendons first, then get strong, then turn that strength
// into speed off the ground, then back off the volume and test. The number
// of foot contacts in a session is capped by your level, so the plan
// never asks for more jumping than your knees and ankles are ready for.

import { drillsById } from "../data/drills.js";
import { GEAR, goalById } from "../data/goals.js";
import { canDo, exercisesById } from "../../lift/data/exercises.js";

export const WEEK_OPTIONS = [6, 8, 12];
export const DAY_OPTIONS = [2, 3, 4];

export const PHASES = {
  F: { id: "F", name: "Foundation", blurb: "Learn to land, strengthen tendons, build a base.", tier: 0, contacts: 0.7, plyoSets: 3,
    main: [3, 10, "Controlled, 3 seconds on the way down"], single: [3, 8], calf: [3, 15] },
  S: { id: "S", name: "Strength", blurb: "Heavier lifting while the jumps get bigger.", tier: 1, contacts: 0.85, plyoSets: 3,
    main: [4, 5, "Heavy. Stop with 2 good reps left"], single: [3, 6], calf: [3, 12] },
  P: { id: "P", name: "Power", blurb: "Lighter, faster lifts and quick, springy jumps.", tier: 2, contacts: 1, plyoSets: 4,
    main: [3, 3, "Lighter than last phase. Move it as fast as you can"], single: [3, 5], calf: [3, 10] },
  R: { id: "R", name: "Recovery week", blurb: "Half the work, so the last block lands.", tier: 0, contacts: 0.5, plyoSets: 2,
    main: [2, 6, "Light. It should feel easy"], single: [2, 6], calf: [2, 12] },
  T: { id: "T", name: "Peak & test", blurb: "Less volume, fresh legs, then see how high you go.", tier: 2, contacts: 0.5, plyoSets: 2,
    main: [2, 3, "Fast and crisp, nowhere near failure"], single: [2, 4], calf: [2, 10] },
};

const PATTERNS = { 6: "FSSPPT", 8: "FFSSSPPT", 12: "FFFSSSSRPPPT" };

// Foot contacts per session at full volume, by level.
const CONTACTS = { 1: 60, 2: 85, 3: 110 };
const IN_SEASON = 0.6;

const DAY_TYPES = { 2: ["power", "elastic"], 3: ["power", "speed", "elastic"], 4: ["power", "speed", "elastic", "sport"] };
const DAY_OFFSETS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5] };

export const SESSION_TYPES = {
  power: { name: "Jump & strength", blurb: "Big jumps, then heavy legs." },
  speed: { name: "Speed & run-ups", blurb: "Sprints, approach jumps and hips." },
  elastic: { name: "Bounce & single leg", blurb: "Quick contacts and one-leg strength." },
  sport: { name: "Sport jumps & tendon care", blurb: "Your event's drills, at low volume." },
  test: { name: "Test day", blurb: "Warm up well and see what you've got." },
};

// Jump drills for each job in a session, by side and tier (easy to hard).
const ROLES = {
  prep: {
    two: [["snap-down", "drop-landing"], ["pogo-hops", "line-hops"], ["pogo-hops"]],
    one: [["single-leg-stick"], ["single-leg-pogo", "single-leg-stick"], ["single-leg-pogo"]],
  },
  up: {
    two: [["squat-jump-stick", "box-jump"], ["box-jump", "max-vertical"], ["depth-jump", "max-vertical", "tuck-jump"]],
    one: [["power-skip"], ["single-leg-box-jump", "power-skip"], ["one-foot-approach", "single-leg-box-jump"]],
  },
  out: {
    two: [["broad-jump"], ["broad-jump", "split-squat-jump"], ["hurdle-hops", "broad-jump"]],
    one: [["skater-bound"], ["bounding", "skater-bound"], ["bounding", "single-leg-hops"]],
  },
  quick: {
    two: [["line-hops", "pogo-hops"], ["pogo-hops", "tuck-jump"], ["hurdle-hops", "tuck-jump", "pogo-hops"]],
    one: [["power-skip"], ["single-leg-pogo", "power-skip"], ["single-leg-pogo", "bounding"]],
  },
  runup: {
    two: [["approach-jump"], ["approach-jump"], ["approach-jump", "repeat-jumps"]],
    one: [["one-foot-approach"], ["one-foot-approach"], ["one-foot-approach"]],
  },
  lateral: {
    two: [["line-hops"], ["lateral-hops", "line-hops"], ["lateral-hops"]],
    one: [["skater-bound"], ["skater-bound"], ["skater-bound"]],
  },
};

// LiftFox exercises for each strength job, best first. The first one your
// gear and level allow is used; the last is always bodyweight.
const LIFTS = {
  squat: ["back-squat", "goblet-squat", "kb-goblet-squat", "bulgarian-split-squat", "split-squat"],
  hinge: ["romanian-deadlift", "db-rdl", "single-leg-rdl", "hamstring-walkout"],
  power: ["kb-swing", "jump-squat", "glute-bridge"],
  glute: ["hip-thrust", "db-hip-thrust", "single-leg-bridge", "glute-bridge"],
  single: ["bulgarian-split-squat", "db-lunge", "step-up", "split-squat"],
  hamstring: ["nordic-curl", "band-leg-curl", "hamstring-walkout"],
  calf: ["db-calf-raise", "calf-raise"],
  core: [["pallof-press", "side-plank"], ["dead-bug", "plank"], ["side-plank", "dead-bug"]],
};

/** Every LiftFox exercise a plan can use, for the drills page. */
export const LIFT_IDS = [...new Set(Object.values(LIFTS).flat(2))];

// ---- dates ---------------------------------------------------------------

export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const DAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
/** "Mon, Nov 30" */
export const fmtDay = iso => DAY_FMT.format(new Date(`${iso}T00:00:00Z`));

export const toIsoDay = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// ---- options -------------------------------------------------------------

export function defaultOptions(today) {
  return { goal: "basketball", takeoff: "both", leg: null, level: 1, gear: "none", days: 3, weeks: 8, inSeason: false, start: today };
}

export function cleanOptions(o, today) {
  const base = defaultOptions(today);
  if (!o || typeof o !== "object") return base;
  const goal = goalById.get(o.goal) ?? goalById.get(base.goal);
  const takeoff = goal.fixed ? goal.takeoff : ["two", "one", "both"].includes(o.takeoff) ? o.takeoff : goal.takeoff;
  const inSeason = Boolean(o.inSeason);
  const days = DAY_OPTIONS.includes(o.days) ? o.days : base.days;
  return {
    goal: goal.id,
    takeoff,
    leg: o.leg === "left" || o.leg === "right" ? o.leg : null,
    level: [1, 2, 3].includes(o.level) ? o.level : 1,
    gear: GEAR.some(g => g.id === o.gear) ? o.gear : "none",
    days: inSeason ? Math.min(days, 2) : days,
    weeks: WEEK_OPTIONS.includes(o.weeks) ? o.weeks : base.weeks,
    inSeason,
    start: typeof o.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.start) ? o.start : base.start,
  };
}

// ---- picking -------------------------------------------------------------

function pickDrill(list, rotate, level, used) {
  const ok = list.filter(id => drillsById.get(id)?.level <= level && !used.has(id));
  if (!ok.length) return null;
  return ok[rotate % ok.length];
}

function roleDrill(role, side, tier, rotate, level, used) {
  const tiers = ROLES[role][side];
  for (let t = tier; t >= 0; t -= 1) {
    const id = pickDrill(tiers[t], rotate, level, used);
    if (id) return id;
  }
  return null;
}

function pickLift(list, gear, level, used) {
  return list.find(id => {
    const ex = exercisesById.get(id);
    return ex && canDo(ex, gear) && ex.level <= level && !used.has(id);
  }) ?? list[list.length - 1];
}

const sideFor = (takeoff, n) => (takeoff === "both" ? (n % 2 ? "one" : "two") : takeoff);

// ---- items ---------------------------------------------------------------

function legNote(drill, opts) {
  if (!drill.perSide && drill.legs !== "one") return null;
  if (opts.leg && opts.takeoff !== "two") return `Start on your takeoff leg (${opts.leg}), then the other.`;
  return null;
}

function drillItem(id, sets, opts, extra = {}) {
  const drill = drillsById.get(id);
  return { src: "leap", id, sets, reps: drill.reps, unit: drill.unit, perSide: drill.perSide, rest: drill.rest, note: legNote(drill, opts), ...extra };
}

// Bodyweight moves without any load need more reps to be hard enough.
const UNLOADED = new Set(["split-squat", "bulgarian-split-squat", "step-up", "single-leg-rdl", "glute-bridge", "single-leg-bridge", "hamstring-walkout", "calf-raise"]);

function liftItem(id, [sets, reps, note], opts) {
  const ex = exercisesById.get(id);
  const timed = ex.timed;
  const s = opts.inSeason ? Math.max(2, sets - 1) : sets;
  if (UNLOADED.has(id) && opts.gear === "none" && reps < 8) {
    reps = 10;
    note = "Bodyweight: take 3 seconds down. Hold a backpack when it gets easy";
  }
  return {
    src: "lift",
    id,
    sets: s,
    reps: timed ? Math.max(20, reps * 4) : reps,
    unit: timed ? "sec" : "reps",
    perSide: ex.perSide,
    rest: reps <= 5 ? 150 : 75,
    note: note ?? null,
  };
}

export function itemContacts(item) {
  if (item.src === "lift") return item.id === "jump-squat" ? item.sets * item.reps : 0;
  const drill = drillsById.get(item.id);
  if (!drill) return 0;
  return item.sets * item.reps * drill.contacts * (item.perSide ? 2 : 1);
}

/** Cut sets from the biggest jump items until the session fits its budget. */
function fitBudget(items, budget) {
  const total = () => items.reduce((n, it) => n + itemContacts(it), 0);
  let guard = 50;
  while (total() > budget && guard-- > 0) {
    const big = items.filter(it => itemContacts(it) > 0 && it.sets > 2).sort((a, b) => itemContacts(b) - itemContacts(a))[0];
    if (!big) break;
    big.sets -= 1;
  }
  // Then trim reps, down to about 60% of the drill's usual set.
  while (total() > budget && guard-- > -100) {
    const big = items
      .filter(it => itemContacts(it) > 0 && it.src === "leap" && it.reps > Math.ceil(drillsById.get(it.id).reps * 0.6))
      .sort((a, b) => itemContacts(b) - itemContacts(a))[0];
    if (!big) break;
    big.reps -= 1;
  }
  while (total() > budget * 1.2 && items.filter(it => itemContacts(it) > 0).length > 2) {
    const idx = items.map(itemContacts).lastIndexOf(Math.max(...items.map(itemContacts)));
    items.splice(idx, 1);
  }
  return items;
}

function itemMinutes(item) {
  const work = item.unit === "sec" ? item.reps : item.unit === "round" ? 300 : item.unit === "m" ? 6 : Math.min(60, 4 * item.reps);
  return (item.sets * (work * (item.perSide ? 2 : 1) + item.rest)) / 60;
}

// ---- sessions ------------------------------------------------------------

function jumpItems(type, ctx) {
  const { opts, goal, phase, week, n } = ctx;
  const tier = phase.tier;
  const used = new Set();
  const ids = [];
  const add = id => {
    if (id && !used.has(id)) {
      used.add(id);
      ids.push(id);
    }
  };
  const role = (name, k) => add(roleDrill(name, sideFor(opts.takeoff, n + k), tier, week, opts.level, used));
  const sport = k => add(pickDrill(goal.sport, week + k, opts.level, used));

  if (type === "power") {
    role("prep", 0);
    role("up", 1);
    role("out", 0);
  } else if (type === "speed") {
    if (goal.approach && phase.id !== "R") add("acceleration-sprint");
    role("runup", 0);
    sport(0);
    role("lateral", 1);
  } else if (type === "elastic") {
    role("quick", 0);
    role("out", 1);
    sport(1);
  } else if (type === "sport") {
    sport(0);
    sport(1);
    role("prep", 1);
  }

  const sets = phase.plyoSets;
  return ids.map(id => {
    const drill = drillsById.get(id);
    if (drill.kind === "sprint") return drillItem(id, phase.tier === 2 ? 6 : 4, opts);
    return drillItem(id, drill.kind === "technique" ? Math.min(sets, 3) : sets, opts);
  });
}

function strengthItems(type, ctx) {
  const { opts, phase, week } = ctx;
  const gear = GEAR.find(g => g.id === opts.gear).lift;
  const used = new Set();
  const lift = (pool, dose) => {
    const id = pickLift(pool, gear, opts.level, used);
    used.add(id);
    return liftItem(id, dose, opts);
  };
  const core = () => lift(LIFTS.core[week % LIFTS.core.length], [opts.inSeason ? 2 : 3, 10]);
  const tendon = (id, sets) => drillItem(id, opts.inSeason ? Math.max(2, sets - 1) : sets, opts);

  if (type === "power") {
    const items = [lift(LIFTS.squat, phase.main)];
    items.push(phase.id === "P" || phase.id === "T" ? lift(LIFTS.power, [3, 5, "Explosive. Quality over quantity"]) : lift(LIFTS.hinge, phase.main));
    items.push(lift(LIFTS.calf, phase.calf));
    return items;
  }
  if (type === "speed") return [lift(LIFTS.glute, [phase.main[0], Math.max(6, phase.single[1])]), tendon("tib-raise", 2), core()];
  if (type === "elastic") return [lift(LIFTS.single, phase.single), lift(LIFTS.hamstring, [phase.single[0], 6]), tendon("single-leg-calf", phase.calf[0])];
  return [tendon(phase.id === "F" ? "spanish-squat" : "iso-split-squat", 3), core(), tendon("tib-raise", 2)];
}

function testNote(goal) {
  return goal.tests.slice(0, 2).map(t => ({ standing: "standing vertical", approach: "approach vertical", "approach-one": "one-foot approach vertical", single: "single-leg vertical (each leg)", broad: "standing broad jump" })[t]).join(" and ");
}

function buildSession(type, ctx, { baseline, finalTest }) {
  const { opts, goal, phase } = ctx;
  const blocks = [{ id: "warm", title: "Warm-up", items: [drillItem("warmup", 1, opts)] }];
  if (finalTest || baseline) {
    blocks.push({ id: "test", title: finalTest ? "Final test" : "Starting test", items: [drillItem("jump-test", 1, opts, { note: `Test your ${testNote(goal)}. Log your best in Tests.` })] });
  }
  if (finalTest) {
    blocks.push({ id: "jump", title: "Easy jumps after", items: [drillItem("pogo-hops", 2, opts)] });
  } else {
    const budget = Math.round(CONTACTS[opts.level] * phase.contacts * (opts.inSeason ? IN_SEASON : 1) * (baseline ? 0.7 : 1));
    const jumps = fitBudget(jumpItems(type, ctx), budget);
    blocks.push({ id: "jump", title: type === "speed" && jumps[0]?.id === "acceleration-sprint" ? "Speed & jumps" : "Jumps", items: jumps });
    blocks.push({ id: "strength", title: type === "sport" ? "Tendon care & core" : "Strength", items: strengthItems(type, ctx) });
  }
  blocks.push({ id: "cool", title: "Cool-down", items: [drillItem("cooldown", 1, opts)] });

  const all = blocks.flatMap(b => b.items);
  const contacts = all.reduce((sum, it) => sum + itemContacts(it), 0);
  const minutes = Math.max(20, Math.round(all.reduce((sum, it) => sum + itemMinutes(it), 0) / 5) * 5);
  const kind = finalTest ? "test" : type;
  return { type: kind, name: SESSION_TYPES[kind].name, blocks, contacts, minutes, test: Boolean(finalTest || baseline) };
}

/** The whole plan: weeks, each with its phase and dated sessions. */
export function buildPlan(rawOpts, today = rawOpts?.start) {
  const opts = cleanOptions(rawOpts, today);
  const goal = goalById.get(opts.goal);
  const pattern = PATTERNS[opts.weeks];
  const types = DAY_TYPES[opts.days];
  const offsets = DAY_OFFSETS[opts.days];
  const weeks = [];
  for (let w = 0; w < pattern.length; w += 1) {
    const phase = PHASES[pattern[w]];
    const start = addDays(opts.start, w * 7);
    const sessions = types.map((type, n) => {
      const lastWeek = w === pattern.length - 1;
      const finalTest = lastWeek && n === types.length - 1;
      const baseline = w === 0 && n === 0;
      const ctx = { opts, goal, phase, week: w, n };
      return { id: `w${w + 1}d${n + 1}`, day: addDays(start, offsets[n]), week: w, ...buildSession(type, ctx, { baseline, finalTest }) };
    });
    weeks.push({ index: w, phase: phase.id, start, sessions });
  }
  return { opts, goal, weeks };
}

export const allSessions = plan => plan.weeks.flatMap(w => w.sessions);

export function findSession(plan, id) {
  return allSessions(plan).find(s => s.id === id) ?? null;
}

/** The first session not yet done, from today or the earliest missed. */
export function nextSession(plan, done = {}, today) {
  const open = allSessions(plan).filter(s => !done[s.id]);
  if (!open.length) return null;
  if (!today) return open[0];
  const missed = open.filter(s => s.day < today);
  // A session missed in the last 3 days can still be caught up; older ones are skipped past.
  const recent = missed.filter(s => s.day >= addDays(today, -3));
  return recent[0] ?? open.find(s => s.day >= today) ?? open[open.length - 1];
}

/** Name and link for an item, from LeapFox's drills or LiftFox's library. */
export function itemInfo(item) {
  if (item.src === "lift") {
    const ex = exercisesById.get(item.id);
    return { name: ex?.name ?? item.id, href: `/lift?tab=library&ex=${encodeURIComponent(item.id)}`, lift: true, ex };
  }
  const drill = drillsById.get(item.id);
  return { name: drill?.name ?? item.id, href: `/leap?tab=drills&drill=${encodeURIComponent(item.id)}`, lift: false, drill };
}

export function doseText(item) {
  if (item.unit === "round") return null;
  const side = item.perSide ? " each side" : "";
  const unit = item.unit === "sec" ? " sec" : item.unit === "m" ? " m" : item.unit === "bounds" ? " bounds" : item.unit === "tries" ? " tries each" : "";
  return `${item.sets} × ${item.reps}${unit}${side}`;
}
