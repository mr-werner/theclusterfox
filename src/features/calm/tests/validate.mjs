import assert from "node:assert/strict";
import { goals, goalsById, sessions } from "../data/sessions.js";
import { patterns, PHASE_TYPES, describePattern } from "../data/breathing.js";
import { buildTimeline, speakSeconds, GAP } from "../model/schedule.js";
import { breathAt, cycleSeconds } from "../model/breath.js";
import { clock, currentStreak, lastDays, longestStreak, summarize } from "../model/stats.js";
import { emptyData, INTERVALS, normalizeData } from "../state/calmStore.js";

// The library is consistent.
const ids = new Set();
for (const s of sessions) {
  assert(!ids.has(s.id), `duplicate session ${s.id}`);
  ids.add(s.id);
  assert(goalsById.has(s.goal), `${s.id}: unknown goal ${s.goal}`);
  assert(["breath", "meditation", "timer"].includes(s.kind), `${s.id}: unknown kind`);
  assert(patterns[s.pattern], `${s.id}: unknown pattern ${s.pattern}`);
  assert(s.title && s.summary && s.minutes > 0, `${s.id}: needs a title, summary and length`);
  if (s.kind !== "timer") {
    assert(s.opening.length >= 2, `${s.id}: needs an opening`);
    assert(s.prompts.length >= 6, `${s.id}: needs at least 6 prompts`);
    assert(s.closing.length >= 2, `${s.id}: needs a closing`);
  }
  if (s.ordered) assert(s.fillers?.length >= 3, `${s.id}: ordered sessions need fillers`);
  if (s.kind === "breath") assert(s.pattern !== "natural", `${s.id}: breathing sessions need a cued pattern`);
  for (const line of [...s.opening, ...s.prompts, ...(s.fillers ?? []), ...s.closing]) {
    assert(typeof line === "string" && line.trim().length > 0, `${s.id}: empty line`);
    assert(speakSeconds(line, 0.85) < 15, `${s.id}: line too long to speak smoothly: ${line}`);
  }
}
for (const g of goals) assert(sessions.some(s => s.goal === g.id), `${g.id}: no sessions`);

// Every pattern breathes in and out, and each phase is well formed.
for (const p of Object.values(patterns)) {
  assert(p.phases.some(ph => ph.type === "in") && p.phases.some(ph => ph.type === "out"), `${p.id}: needs in and out`);
  for (const ph of p.phases) {
    assert(PHASE_TYPES.includes(ph.type), `${p.id}: bad phase type`);
    assert(ph.sec > 0, `${p.id}: phase needs a length`);
  }
  assert.equal(breathAt(p, 0).level, 0, `${p.id}: starts empty`);
  assert(Math.abs(breathAt(p, cycleSeconds(p) - 0.001).level) < 0.01, `${p.id}: ends empty`);
}
assert.equal(describePattern(patterns.relax478), "In 4 · Hold 7 · Out 8");
assert.equal(describePattern(patterns.box, 1.25), "In 5 · Hold 5 · Out 5 · Rest 5");

// The breath moves the right way through each phase.
{
  const box = patterns.box;
  assert.equal(breathAt(box, 1).phase.type, "in");
  assert(breathAt(box, 3).level > breathAt(box, 1).level);
  assert.equal(breathAt(box, 5).phase.type, "hold");
  assert(Math.abs(breathAt(box, 5).level - 1) < 1e-9);
  assert(breathAt(box, 10).level < breathAt(box, 9).level);
  assert.equal(breathAt(box, 17).cycle, 1);
  assert.equal(breathAt(box, 2, 2).phase.type, "in", "pace stretches phases");
  assert.equal(breathAt(box, 9, 2).phase.type, "hold");
  const sigh = patterns.sigh;
  assert(Math.abs(breathAt(sigh, 2.5).level - 0.75) < 0.01, "first sip fills to three quarters");
  assert(breathAt(sigh, 3.4).level > 0.95, "second sip tops up");
}

// Timelines fit the session, never overlap, and respect the chosen frequency.
function check(session, seconds, interval) {
  const tl = buildTimeline(session, { seconds, interval, rate: 0.85, seed: 7 });
  let prevEnd = -Infinity;
  for (const item of tl) {
    assert(item.at >= 0 && item.end <= seconds + 0.5, `${session.id} ${seconds}s/${interval}: "${item.text}" runs past the end`);
    if (item.text && item.kind !== "bell") {
      assert(item.at >= prevEnd - 0.2, `${session.id} ${seconds}s/${interval}: lines overlap at ${item.at}`);
      prevEnd = item.end;
    }
  }
  for (let i = 1; i < tl.length; i++) assert(tl[i].at >= tl[i - 1].at, `${session.id}: timeline not sorted`);
  return tl;
}
for (const s of sessions) {
  for (const minutes of [1, 3, 5, 10, 30]) {
    for (const interval of INTERVALS) check(s, minutes * 60, interval);
  }
}
{
  const arrive = sessions.find(s => s.id === "arrive");
  const quiet = check(arrive, 600, 0);
  assert(!quiet.some(i => i.kind === "guide"), "start & end only has no middle prompts");
  assert.equal(quiet.at(-1).text, arrive.closing.at(-1), "closing always ends the session");
  assert(600 - quiet.at(-1).end < 10, "closing lands near the end");

  const busy = check(arrive, 600, 20).filter(i => i.kind === "guide");
  const calm = check(arrive, 600, 180).filter(i => i.kind === "guide");
  assert(busy.length > calm.length * 3, "more frequent check-ins say more");
  for (let i = 1; i < calm.length; i++) assert(calm[i].at - calm[i - 1].at >= 180 - 0.5, "prompts honor the interval");

  const tiny = check(arrive, 60, 60);
  assert(tiny.some(i => i.kind === "close"), "even a one-minute session says goodbye");
}
{
  // Ordered sessions play every step, in order, when there's room.
  const scan = sessions.find(s => s.id === "sleep-scan");
  const steps = check(scan, 15 * 60, 300).filter(i => i.kind === "guide").map(i => i.text);
  assert.deepEqual(steps.slice(0, scan.prompts.length), scan.prompts, "all body-scan steps, in order");
  const long = check(scan, 30 * 60, 60).filter(i => i.kind === "guide").map(i => i.text);
  assert(long.length > scan.prompts.length, "fillers follow the steps");
  assert(scan.fillers.includes(long.at(-1)));
}
{
  // Timers ring at each interval and stay silent otherwise.
  const silent = sessions.find(s => s.id === "timer-silent");
  const tl = check(silent, 600, 120);
  assert.deepEqual(tl.map(i => i.at), [120, 240, 360, 480]);
  assert(tl.every(i => i.kind === "bell"));
  assert.equal(check(silent, 600, 0).length, 0);
  const light = sessions.find(s => s.id === "timer-light");
  const lt = check(light, 900, 300);
  assert(lt.some(i => i.kind === "guide") && lt.some(i => i.kind === "bell"));
}
// Shuffles are repeatable per seed and avoid repeats until the pool runs out.
{
  const s = sessions.find(x => x.id === "focus-count");
  const a = buildTimeline(s, { seconds: 1800, interval: 45, seed: 3 }).filter(i => i.kind === "guide").map(i => i.text);
  const b = buildTimeline(s, { seconds: 1800, interval: 45, seed: 3 }).filter(i => i.kind === "guide").map(i => i.text);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.slice(0, s.prompts.length)).size, Math.min(a.length, s.prompts.length));
  assert(GAP > 0);
}

// Stats.
{
  const h = [
    { date: "2026-11-08", minutes: 10 },
    { date: "2026-11-07", minutes: 5 },
    { date: "2026-11-07", minutes: 3 },
    { date: "2026-11-06", minutes: 5 },
    { date: "2026-11-01", minutes: 20 },
    { date: "2026-10-31", minutes: 20 },
  ];
  assert.equal(currentStreak(h, "2026-11-08"), 3);
  assert.equal(currentStreak(h, "2026-11-09"), 3, "today not done yet keeps the streak");
  assert.equal(currentStreak(h, "2026-11-10"), 0);
  assert.equal(longestStreak(h), 3);
  assert.equal(longestStreak([{ date: "2026-12-31" }, { date: "2027-01-01" }]), 2, "streaks cross the year");
  const week = lastDays(h, "2026-11-08", 7);
  assert.equal(week.length, 7);
  assert.equal(week.at(-1).minutes, 10);
  assert.equal(week.at(-2).minutes, 8);
  assert.equal(week[0].date, "2026-11-02");
  assert.deepEqual(summarize(h, "2026-11-08"), { minutes: 63, sessions: 6, streak: 3, best: 3 });
  assert.equal(clock(65), "1:05");
  assert.equal(clock(3605), "1:00:05");
  assert.equal(clock(-3), "0:00");
}

// Stored data is cleaned up.
{
  assert.deepEqual(normalizeData(null), emptyData());
  const d = normalizeData({
    prefs: { interval: 7, rate: 9, ambient: "jackhammer", bells: false, pace: 1.25 },
    favorites: ["arrive", 4, "arrive"],
    history: [{ id: "a", date: "2026-11-08", sessionId: "arrive", minutes: 5, mood: "calmer" }, { id: "b" }, null],
  });
  assert.equal(d.prefs.interval, 60);
  assert.equal(d.prefs.rate, 0.85);
  assert.equal(d.prefs.ambient, "rain");
  assert.equal(d.prefs.bells, false);
  assert.equal(d.prefs.pace, 1.25);
  assert.deepEqual(d.favorites, ["arrive"]);
  assert.equal(d.history.length, 1);
  assert.equal(d.history[0].mood, "calmer");
}

console.log(`CalmFox: ${sessions.length} sessions across ${goals.length} goals, all checks passed.`);
