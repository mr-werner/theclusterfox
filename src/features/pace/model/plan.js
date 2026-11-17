// Builds a training plan toward a race (or an eight-week fitness block).
//
// The weeks run Monday to Sunday. A plan moves through four phases:
//   base   easy volume grows, light quality work
//   build  the key workouts for the event arrive
//   peak   race-specific work at the biggest volume
//   taper  volume drops so you arrive fresh; the race closes the last week
// Volume grows gradually from what you do now, every fourth week is
// easier, and the long session and the week stay under a cap for the
// event and your level.

import { eventById, LEVEL_IDS, START_MINUTES } from "../data/events.js";
import { addDays, daysBetween, mondayOf, toIsoDay, weekdayOf } from "./units.js";
import { isQuality } from "./sessions.js";

export const MAX_WEEKS = 24;
export const PHASE_NAMES = { base: "Base", build: "Build", peak: "Peak", taper: "Taper" };

const round5 = n => Math.max(5, Math.round(n / 5) * 5);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Weekdays (0 = Mon) holding sessions, and which are the key days. */
export function weekSlots(days, longDay = 5) {
  const L = longDay === 6 ? 6 : 5;
  const O = L === 5 ? 6 : 5;
  const patterns = { 2: [2, L], 3: [1, 3, L], 4: [1, 3, L, O], 5: [1, 2, 3, L, O], 6: [1, 2, 3, 4, L, O] };
  const slots = patterns[clamp(days, 2, 6)];
  return { slots: [...slots].sort((a, b) => a - b), quality: days === 2 ? [2] : [1, 3], long: L, after: L === 5 ? O : null };
}

/** How many weeks a plan would have from today to the race. */
export function planWeeks(eventId, raceDate, today) {
  const event = eventById.get(eventId);
  const first = firstWeek(today);
  if (!event) return 0;
  if (event.noRace) return event.weeks.typical;
  if (!raceDate) return 0;
  return Math.floor(daysBetween(first, mondayOf(raceDate)) / 7) + 1;
}

// Late in the week? Start fresh next Monday.
const firstWeek = today => (weekdayOf(today) >= 4 ? addDays(mondayOf(today), 7) : mondayOf(today));

function phasesFor(n, event) {
  if (event.noRace) {
    const base = Math.max(1, Math.round(n * 0.375));
    const build = Math.max(1, Math.round(n * 0.375));
    return [...Array(base).fill("base"), ...Array(build).fill("build"), ...Array(Math.max(0, n - base - build)).fill("peak")];
  }
  const taper = n <= 3 ? 1 : n < 10 ? 1 : Math.min(event.taperWeeks ?? 2, n - 3);
  const rest = n - taper;
  const peak = Math.round(rest * 0.25);
  const build = Math.round(rest * 0.35);
  const base = rest - peak - build;
  return [...Array(base).fill("base"), ...Array(build).fill("build"), ...Array(peak).fill("peak"), ...Array(taper).fill("taper")];
}

function qualityCount(level, phase, days, recovery) {
  let q;
  if (phase === "taper") q = 1;
  else if (level === "new") q = phase === "base" ? 0 : 1;
  else if (level === "regular") q = phase === "base" || days < 4 ? 1 : 2;
  else q = days < 4 && phase === "base" ? 1 : 2;
  if (recovery && q > 1) q -= 1;
  return Math.min(q, days - 1);
}

/**
 * Make a plan.
 * opts: { id, sport, eventId, raceDate, today, days, longDay, level, startMinutes }
 */
export function makePlan(opts) {
  const event = eventById.get(opts.eventId);
  if (!event) throw new Error("Unknown event");
  const sport = event.sport;
  const level = LEVEL_IDS.includes(opts.level) ? opts.level : "regular";
  const days = clamp(Math.round(opts.days || 4), 2, 6);
  const today = opts.today;
  const longDay = opts.longDay === 6 ? 6 : 5;

  let start = firstWeek(today);
  let raceDay = null;
  let n;
  if (event.noRace) {
    n = event.weeks.typical;
  } else {
    raceDay = opts.raceDate;
    const raceWeek = mondayOf(raceDay);
    n = Math.floor(daysBetween(start, raceWeek) / 7) + 1;
    if (raceDay < today) throw new Error("The race date has passed");
    if (n < 1) {
      start = raceWeek;
      n = 1;
    }
    if (n > MAX_WEEKS) {
      start = addDays(raceWeek, -7 * (MAX_WEEKS - 1));
      n = MAX_WEEKS;
    }
  }

  const phases = phasesFor(n, event);
  const startVol = clamp(Math.round(opts.startMinutes || START_MINUTES[sport][level]), 30, 1200);
  const ramp = phases.filter(p => p === "base" || p === "build").length;
  const cap = event.weekCap[level];
  const peakVol = Math.max(startVol, Math.min(cap, startVol * 1.8, startVol * Math.pow(1.08, Math.max(1, ramp))));
  const taperShares = event.taperWeeks >= 3 ? [0.75, 0.6, 0.4] : [0.7, 0.4];
  const taperCount = phases.filter(p => p === "taper").length;
  const { slots, quality: qDays, long: L, after } = weekSlots(days, longDay);
  const minEasy = (sport === "ride" ? 30 : 20) + (level === "experienced" ? 10 : 0);

  const weeks = [];
  let ramped = 0;
  for (let i = 0; i < n; i += 1) {
    const phase = phases[i];
    const weekStart = addDays(start, i * 7);
    const last = i === n - 1;
    let vol;
    let recovery = false;
    if (phase === "base" || phase === "build") {
      ramped += 1;
      vol = startVol + ((peakVol - startVol) * ramped) / Math.max(1, ramp);
      if (i % 4 === 3) {
        recovery = true;
        vol *= 0.75;
      }
    } else if (phase === "peak") {
      vol = peakVol;
    } else {
      const k = i - (n - taperCount);
      vol = peakVol * taperShares[Math.min(k + (taperShares.length - taperCount), taperShares.length - 1)];
    }
    if (event.noRace && last) vol *= 0.75;

    const q = qualityCount(level, phase, days, recovery);
    const focus = event.focus[phase === "taper" ? "peak" : phase];
    const qTypes = phase === "taper" ? ["racepace"] : [focus[i % focus.length], focus[(i + 1) % focus.length]];
    const runWalk = sport === "run" && level === "new" && i < 5;
    const roles = slots.map(d => {
      if (d === L) return { d, role: "long" };
      const qi = qDays.indexOf(d);
      if (qi >= 0 && qi < q) return { d, role: "quality", type: qTypes[qi] };
      if (d === after && phase !== "base") return { d, role: "recovery" };
      return { d, role: "easy" };
    });
    // A runner in base with no quality day gets strides on one easy day.
    if (sport === "run" && phase !== "taper" && q === 0 && !runWalk) {
      const e = roles.find(r => r.role === "easy");
      if (e) e.type = "strides";
    }

    // The long session grows toward what the event needs, but never takes over the week.
    const progress = phase === "base" || phase === "build" ? ramped / Math.max(1, ramp) : phase === "peak" ? 1 : 0.6;
    const longCap = event.longCap[level];
    const longWant = Math.max(vol * 0.3, longCap * (0.5 + 0.5 * progress) * (recovery ? 0.8 : 1));
    const longMin = clamp(round5(Math.min(longWant, vol * (days <= 3 ? 0.5 : 0.42))), 30, longCap);
    const qShare = { 2: 0.3, 3: 0.22, 4: 0.2, 5: 0.16, 6: 0.14 }[days];
    const qMin = clamp(round5(vol * qShare), sport === "ride" ? 45 : 35, sport === "ride" ? 90 : 75);
    const nEasy = roles.filter(r => r.role === "easy" || r.role === "recovery").length;
    const left = vol - longMin - qMin * roles.filter(r => r.role === "quality").length;
    const easyMin = clamp(round5(nEasy ? left / nEasy : 0), minEasy, Math.max(minEasy, longMin - 10));

    let sessions = roles.map(r => {
      const day = addDays(weekStart, r.d);
      if (r.role === "long") return { day, weekday: r.d, type: runWalk ? "runwalk" : "long", minutes: longMin };
      if (r.role === "quality") return { day, weekday: r.d, type: r.type, minutes: qMin };
      if (r.role === "recovery") return { day, weekday: r.d, type: "recovery", minutes: round5(Math.max(minEasy, easyMin * 0.7)) };
      return { day, weekday: r.d, type: r.type ?? (runWalk ? "runwalk" : "easy"), minutes: easyMin };
    });

    // The race (or the closing test) ends the last week.
    if (last) {
      const goal = event.noRace ? addDays(weekStart, L) : raceDay;
      const gw = weekdayOf(goal);
      sessions = sessions.filter(s => s.weekday < gw - 1);
      sessions = sessions.map(s => (isQuality(s.type) ? { ...s, type: "racepace", minutes: round5(Math.min(s.minutes, 40)) } : s));
      if (gw >= 1) sessions.push({ day: addDays(goal, -1), weekday: gw - 1, type: "shakeout", minutes: 20 });
      sessions.push({ day: goal, weekday: gw, type: event.noRace ? "test" : "race", minutes: 0 });
    }

    sessions = sessions
      .filter(s => s.day >= today)
      .map(s => ({ ...s, id: `w${i + 1}-${s.weekday}` }));
    weeks.push({ index: i, start: weekStart, phase, recovery, minutes: Math.round(sessions.reduce((t, s) => t + s.minutes, 0)), sessions });
  }

  return {
    id: opts.id ?? `p${Date.now().toString(36)}`,
    sport,
    eventId: event.id,
    raceDate: raceDay,
    level,
    days,
    longDay,
    startMinutes: startVol,
    createdAt: today,
    weeks,
    completed: {},
  };
}

export const allSessions = plan => (plan?.weeks ?? []).flatMap(w => w.sessions.map(s => ({ ...s, week: w })));
export const sessionsOn = (plan, day) => allSessions(plan).filter(s => s.day === day);
export const findSession = (plan, id) => allSessions(plan).find(s => s.id === id) ?? null;
export const weekOf = (plan, day) => plan?.weeks.find(w => day >= w.start && day <= addDays(w.start, 6)) ?? null;
export const planEnd = plan => plan?.weeks.at(-1)?.sessions.at(-1)?.day ?? null;

/** The next session not yet done, from today on. */
export function nextSession(plan, today = toIsoDay(new Date())) {
  return allSessions(plan).find(s => s.day >= today && !plan.completed[s.id]) ?? null;
}

/** Move a session to another day (in the same plan), keeping its id. */
export function moveSession(plan, id, day) {
  return {
    ...plan,
    weeks: plan.weeks.map(w => ({
      ...w,
      sessions: w.sessions
        .map(s => (s.id === id ? { ...s, day, weekday: weekdayOf(day) } : s))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
    })),
  };
}
