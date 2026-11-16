// The practical exam simulator. Pure functions over a plain run object, so
// the page can keep it in React state and the tests can drive it directly.
//
// Three ways to run a station:
//   crawl  get every step right. Out-of-order and wrong picks are explained
//          and you try again. A clean run has no mistakes.
//   walk   the same station against a clock. Each clean pass shrinks the
//          next target time, down to a floor you can still make.
//   run    a random patient, randomized vitals and surprises mid-scenario
//          that you must handle on the spot, against the real time limit.
//
// The clock is simulated: each action costs about what it takes on a real
// station (step.secs), plus the time you actually spend deciding.
import { covers, levelById } from "../data/levels.js";

export const MODES = [
  { id: "crawl", name: "Crawl", hint: "Learn the steps. Mistakes are explained and you try again." },
  { id: "walk", name: "Walk", hint: "Get it right against a clock that gets shorter each time you pass." },
  { id: "run", name: "Run", hint: "Random patient, changing vitals and surprises. Real time limit." },
];
export const MODE_IDS = MODES.map(m => m.id);

export const PASS_SHARE = 0.8; // share of points needed to pass walk and run
const WRONG_PENALTY = 10; // seconds added to the clock for a wrong pick
const THINK_CAP = 45; // most real seconds counted for one decision
const WALK_SHRINK = 0.85;
const MAX_EVENTS = 2;

// ── Seeded random numbers, so a run can be replayed and tested ─────────
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
export function shuffle(rand, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Building a station for a level and scenario ────────────────────────

/** The steps, distractors and events a station has for one scenario at one level. */
export function resolveStation(skill, scenarioId, level) {
  const scenario = skill.scenarios.find(s => s.id === scenarioId) ?? skill.scenarios[0];
  const removed = new Set(scenario.remove ?? []);
  const all = [...skill.steps.filter(s => !removed.has(s.id)), ...(scenario.add ?? [])];
  const steps = [];
  const distractors = [...skill.distractors, ...(scenario.distractors ?? [])];
  const short = levelById.get(level)?.short ?? "this level";
  for (const step of all) {
    if (covers(level, step.min ?? "emr")) steps.push({ pts: 1, secs: 10, ...step });
    // A step above your level becomes a trap: doing it is outside your scope.
    else distractors.push({ id: step.id, group: step.group, label: step.label, why: `${step.why} But it's outside the ${short} scope of practice, so here you'd leave it for a higher level of care.`, danger: `Performed a skill outside the ${short} scope of practice` });
  }
  const events = (skill.events ?? []).filter(e => !e.scenarios || e.scenarios.includes(scenario.id));
  return { scenario, steps, distractors, events };
}

const fmtBp = v => (v.sys ? `${v.sys}/${v.dia}` : "none");

/** Fill {hr} {bp} {rr} {spo2} {bgl} {psi} in a finding. */
export function fillVitals(text, vitals) {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    if (k === "bp") return fmtBp(vitals);
    return vitals[k] !== undefined ? String(vitals[k]) : m;
  });
}

// Run level: nudge the vitals within believable ranges, keeping the picture.
function jitterVitals(rand, v) {
  const n = (x, spread) => (x ? Math.round(x + (rand() * 2 - 1) * spread) : x);
  const out = { ...v };
  out.hr = n(v.hr, 10);
  out.sys = n(v.sys, 10);
  out.dia = v.dia ? Math.min(n(v.dia, 6), (out.sys ?? 0) - 20) : v.dia;
  out.rr = v.rr ? Math.max(4, n(v.rr, 4)) : v.rr;
  out.spo2 = v.spo2 ? Math.min(100, n(v.spo2, 2)) : v.spo2;
  if (v.bgl) out.bgl = Math.max(20, n(v.bgl, 8));
  if (v.psi) out.psi = Math.round(n(v.psi, 150) / 50) * 50;
  return out;
}

/** The shortest the station could possibly take: every action, no thinking. */
export const minimumSecs = steps => steps.reduce((s, x) => s + x.secs, 0);

/** Walk target in seconds after `passes` clean passes. */
export function walkTarget(skill, steps, passes = 0) {
  const limit = skill.minutes * 60;
  const floor = Math.round(minimumSecs(steps) * 1.1 + steps.length * 3);
  return Math.max(Math.min(floor, limit), Math.round(limit * WALK_SHRINK ** passes));
}

/**
 * Start a run. opts: { level, mode, seed, scenarioId?, walkPasses? }.
 * Crawl and walk use the scenario's own vitals; run randomizes them and
 * schedules up to two surprises.
 */
export function startRun(skill, { level = "emt", mode = "crawl", seed = 1, scenarioId = null, walkPasses = 0 } = {}) {
  const rand = rng(seed);
  const scenario = scenarioId ? skill.scenarios.find(s => s.id === scenarioId) ?? pick(rand, skill.scenarios) : pick(rand, skill.scenarios);
  const station = resolveStation(skill, scenario.id, level);
  const vitals = mode === "run" ? jitterVitals(rand, scenario.vitals) : { ...scenario.vitals };
  const target = mode === "walk" ? walkTarget(skill, station.steps, walkPasses) : mode === "run" ? skill.minutes * 60 : null;

  // Surprises fire after a random number of completed steps, past the opening.
  let events = [];
  if (mode === "run" && station.events.length) {
    const count = Math.min(MAX_EVENTS, station.events.length, 1 + Math.floor(rand() * 2));
    const n = station.steps.length;
    events = shuffle(rand, station.events).slice(0, count).map(e => ({ id: e.id, at: Math.max(3, Math.floor(n * (0.3 + rand() * 0.55))) }));
    events.sort((a, b) => a.at - b.at);
  }

  // The action board: every real step and every trap, mixed within each group.
  const actions = shuffle(rand, [...station.steps.map(s => s.id), ...station.distractors.map(d => d.id)]);

  return {
    skillId: skill.id,
    level,
    mode,
    seed,
    scenarioId: scenario.id,
    vitals,
    target,
    walkPasses,
    actions,
    done: {}, // stepId -> { at (sim secs), late }
    log: [], // { kind, id, text, detail?, at }
    mistakes: 0,
    criticals: [], // critical-fail lines
    events, // scheduled: [{ id, at }]
    firedEvents: [], // ids
    pendingEvent: null, // { id, options (shuffled indexes) }
    simSecs: 0,
    lastTick: null, // real ms of the last decision, set by the page
    finished: false,
  };
}

// ── Playing ─────────────────────────────────────────────────────────────

function context(skill, run) {
  return resolveStation(skill, run.scenarioId, run.level);
}

/** The phase you are working on: the earliest one with steps still to do. */
export function currentPhase(steps, done) {
  const open = steps.filter(s => !done[s.id]).map(s => s.phase);
  return open.length ? Math.min(...open) : Infinity;
}

function thinkSecs(run, now) {
  if (run.lastTick == null || now == null) return 0;
  return Math.min(THINK_CAP, Math.max(0, (now - run.lastTick) / 1000));
}

function findingFor(step, scenario, vitals) {
  const raw = scenario.findings?.[step.id] ?? step.find ?? "Done.";
  return fillVitals(raw, vitals);
}

function stepsByPhase(steps, phase, done) {
  return steps.filter(s => s.phase === phase && !done[s.id]);
}

/**
 * Do one action. Returns { run, feedback } where feedback is
 * { kind: "ok" | "late" | "early" | "wrong" | "danger" | "repeat" | "blocked", title, text, finding? }.
 * `now` is Date.now() from the page (null in tests: no thinking time).
 */
export function act(skill, run, actionId, now = null) {
  if (run.finished) return { run, feedback: { kind: "blocked", title: "Station finished", text: "Start a new run to try again." } };
  if (run.pendingEvent) return { run, feedback: { kind: "blocked", title: "Something changed", text: "Deal with the patient's change first." } };
  const { scenario, steps, distractors } = context(skill, run);
  const think = thinkSecs(run, now);
  const step = steps.find(s => s.id === actionId);
  const trap = distractors.find(d => d.id === actionId);
  const next = { ...run, lastTick: now ?? run.lastTick, log: [...run.log], done: { ...run.done }, criticals: [...run.criticals] };

  if (!step && !trap) return { run, feedback: { kind: "blocked", title: "Unknown action", text: "" } };

  if (step && run.done[step.id]) {
    return { run: next, feedback: { kind: "repeat", title: "Already done", text: "You've already done that one." } };
  }

  if (trap) {
    next.mistakes += 1;
    next.simSecs += think + WRONG_PENALTY;
    if (trap.danger && run.mode !== "crawl") next.criticals.push(trap.danger);
    next.log.push({ kind: trap.danger ? "danger" : "wrong", id: trap.id, text: trap.label, detail: trap.why, at: next.simSecs });
    const feedback = trap.danger
      ? { kind: "danger", title: run.mode === "crawl" ? "That would be a critical fail" : "Critical fail", text: trap.why }
      : { kind: "wrong", title: "Not that", text: trap.why };
    return { run: maybeAutoFinish(skill, next), feedback };
  }

  const phase = currentPhase(steps, run.done);
  if (step.phase > phase) {
    const waiting = stepsByPhase(steps, phase, run.done);
    const phaseName = skill.phases[phase] ?? "the earlier part";
    if (run.mode === "crawl") {
      next.mistakes += 1;
      next.simSecs += think;
      next.log.push({ kind: "early", id: step.id, text: step.label, detail: `Too early: finish ${phaseName.toLowerCase()} first.`, at: next.simSecs });
      return {
        run: next,
        feedback: { kind: "early", title: "Not yet", text: `Finish ${phaseName.toLowerCase()} first. ${waiting.length === 1 ? "One step" : `${waiting.length} steps`} left there.` },
      };
    }
    // Walk and run let you go on, but it counts against you.
    next.mistakes += 1;
    if (step.orderCritical) next.criticals.push(step.orderCritical);
  }

  next.simSecs += think + step.secs;
  const late = step.phase > phase;
  next.done[step.id] = { at: next.simSecs, late };
  const finding = findingFor(step, scenario, run.vitals);
  next.log.push({ kind: late ? "late" : "ok", id: step.id, text: step.label, detail: finding, at: next.simSecs });

  let result = { run: next, feedback: { kind: late ? "late" : "ok", title: late ? "Out of order" : "Done", text: late ? `${step.why} You skipped ahead of ${(skill.phases[phase] ?? "an earlier phase").toLowerCase()}.` : step.why, finding } };
  result.run = scheduleEvent(skill, result.run);
  result.run = maybeAutoFinish(skill, result.run);
  return result;
}

function scheduleEvent(skill, run) {
  if (run.mode !== "run" || run.pendingEvent) return run;
  const doneCount = Object.keys(run.done).length;
  const due = run.events.find(e => !run.firedEvents.includes(e.id) && doneCount >= e.at);
  if (!due) return run;
  const event = skill.events.find(e => e.id === due.id);
  const order = shuffle(rng(run.seed + doneCount * 7919), event.options.map((_, i) => i));
  return { ...run, pendingEvent: { id: event.id, order }, firedEvents: [...run.firedEvents, event.id] };
}

/** The event waiting for an answer, with its options in display order. */
export function pendingEvent(skill, run) {
  if (!run.pendingEvent) return null;
  const event = skill.events.find(e => e.id === run.pendingEvent.id);
  return { ...event, options: run.pendingEvent.order.map(i => ({ ...event.options[i], index: i })) };
}

/** Answer the surprise by the option's original index. */
export function answerEvent(skill, run, optionIndex, now = null) {
  const event = pendingEvent(skill, run);
  if (!event) return { run, feedback: null };
  const option = event.options.find(o => o.index === optionIndex);
  const next = { ...run, pendingEvent: null, lastTick: now ?? run.lastTick, log: [...run.log], criticals: [...run.criticals] };
  next.simSecs += thinkSecs(run, now) + (option.ok ? 15 : WRONG_PENALTY);
  next.log.push({ kind: option.ok ? "event-ok" : "event-bad", id: event.id, text: event.text, detail: `${option.label}. ${option.why}`, at: next.simSecs });
  if (!option.ok) {
    next.mistakes += 1;
    next.criticals.push(event.critical);
  }
  return {
    run: maybeAutoFinish(skill, next),
    feedback: { kind: option.ok ? "ok" : "danger", title: option.ok ? "Good call" : "Critical fail", text: option.why },
  };
}

function maybeAutoFinish(skill, run) {
  if (run.pendingEvent) return run;
  const { steps } = context(skill, run);
  return steps.every(s => run.done[s.id]) ? { ...run, finished: true } : run;
}

/** End the station now, even with steps left. */
export const finishRun = run => ({ ...run, finished: true, pendingEvent: null });

// ── Scoring ─────────────────────────────────────────────────────────────

/**
 * The score sheet: { points, possible, share, pass, clean, criticals, missed, late, secs, target, overTime }.
 * Crawl passes on a clean, complete run. Walk and run pass with at least
 * 80% of the points, no critical fails, and inside the time.
 */
export function scoreRun(skill, run) {
  const { steps } = context(skill, run);
  const possible = steps.reduce((s, x) => s + x.pts, 0);
  let points = 0;
  const missed = [];
  const late = [];
  const criticals = [...run.criticals];
  for (const s of steps) {
    const d = run.done[s.id];
    if (d) {
      points += s.pts;
      if (d.late) late.push(s);
    } else {
      missed.push(s);
      if (s.critical) criticals.push(s.critical);
    }
  }
  const secs = Math.round(run.simSecs);
  const overTime = run.target != null && secs > run.target;
  if (overTime) criticals.push(run.mode === "walk" ? "Went over the target time" : "Went over the station's time limit");
  const unique = [...new Set(criticals)];
  const share = possible ? points / possible : 0;
  const complete = missed.length === 0;
  const clean = complete && run.mistakes === 0 && unique.length === 0;
  const pass = run.mode === "crawl" ? clean : share >= PASS_SHARE && unique.length === 0;
  return { points, possible, share, pass, clean, complete, criticals: unique, missed, late, secs, target: run.target, overTime, mistakes: run.mistakes };
}

/** A hint for crawl: one step you could do right now. */
export function hint(skill, run) {
  const { steps } = context(skill, run);
  const phase = currentPhase(steps, run.done);
  return stepsByPhase(steps, phase, run.done)[0] ?? null;
}

/** "4:05" for a number of seconds. */
export function clock(secs) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
