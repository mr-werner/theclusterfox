// Checks PaceFox's plan builder, zones, GPS math, sensor parsing and links:
// node src/features/pace/tests/validate.mjs
import assert from "node:assert/strict";

import { EVENTS, eventById } from "../data/events.js";
import { makePlan, allSessions, nextSession, moveSession, weekSlots, planWeeks } from "../model/plan.js";
import { buildSteps, stepsSeconds, groupSteps, KINDS, averageMet } from "../model/sessions.js";
import { zoneTarget, runThreshold, judge, maxHrFor, hrRange } from "../model/zones.js";
import { haversine, stepFor, splits, downsample, toGpx, routePath, trackDistance } from "../model/geo.js";
import { parseHeartRate, parsePower, parseRower, parseIndoorBike, parseTreadmill } from "../model/bluetooth.js";
import { newLive, addFix, addSensor, pause, resume, activeSec, stepAt, finishLive, stepAnnouncement } from "../model/live.js";
import { normalizeData } from "../state/paceStore.js";
import { planItems, launchTargets } from "../model/planLink.js";
import { paceWorkouts } from "../model/fuelLink.js";
import { addDays, fmtClock, parseClock, weekdayOf, fmtPace } from "../model/units.js";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const TODAY = "2026-11-16"; // a Monday

check("every event makes a sensible plan at every level", () => {
  for (const e of EVENTS) {
    for (const level of ["new", "regular", "experienced"]) {
      for (const days of [2, 3, 4, 5, 6]) {
        const raceDate = e.noRace ? null : addDays(TODAY, e.weeks.typical * 7 - 2);
        const plan = makePlan({ eventId: e.id, raceDate, today: TODAY, days, level, longDay: 5 });
        assert.equal(plan.sport, e.sport);
        const all = allSessions(plan);
        assert(all.length > 0, `${e.id} has sessions`);
        for (const s of all) {
          assert(KINDS.includes(s.type), `${s.type} is known`);
          assert(s.day >= TODAY);
          const steps = buildSteps(s.type, { sport: plan.sport, minutes: s.minutes, level, phase: s.week.phase, weekIndex: s.week.index, eventId: e.id });
          assert(steps.length > 0 && steps.every(st => st.sec > 0 && st.zone >= 1 && st.zone <= 6), `${e.id} ${s.type} steps`);
          if (s.minutes) assert(Math.abs(stepsSeconds(steps) / 60 - s.minutes) <= Math.max(25, s.minutes * 0.45), `${e.id} ${s.type} ${s.minutes} min vs ${stepsSeconds(steps) / 60}`);
        }
        // No more sessions in a week than training days, and one per day.
        for (const w of plan.weeks) {
          assert(w.sessions.length <= days + 1, `${e.id} week ${w.index} has ${w.sessions.length} sessions for ${days} days`);
          assert.equal(new Set(w.sessions.map(s => s.day)).size, w.sessions.length);
          assert(w.minutes <= e.weekCap[level] * 1.1 + 60, `${e.id} ${level} week ${w.minutes} under cap`);
        }
        const last = all.at(-1);
        assert.equal(last.type, e.noRace ? "test" : "race");
        if (!e.noRace) assert.equal(last.day, raceDate);
      }
    }
  }
});

check("plans taper into the race and build before it", () => {
  const plan = makePlan({ eventId: "run-marathon", raceDate: addDays(TODAY, 18 * 7 - 1), today: TODAY, days: 5, level: "regular" });
  const phases = plan.weeks.map(w => w.phase);
  assert.equal(phases[0], "base");
  assert.equal(phases.at(-1), "taper");
  assert(phases.includes("build") && phases.includes("peak"));
  const peak = Math.max(...plan.weeks.map(w => w.minutes));
  assert(plan.weeks.at(-2).minutes < peak * 0.8, "taper week is lighter");
  assert(plan.weeks[0].minutes < peak, "starts below the peak");
  const longs = allSessions(plan).filter(s => s.type === "long").map(s => s.minutes);
  assert(Math.max(...longs) <= eventById.get("run-marathon").longCap.regular);
  // Race day falls on a Sunday; a shakeout the day before.
  const race = allSessions(plan).at(-1);
  assert.equal(weekdayOf(race.day), 6);
  assert.equal(allSessions(plan).at(-2).type, "shakeout");
});

check("new runners start with run/walk and no hard days", () => {
  const plan = makePlan({ eventId: "run-5k", raceDate: addDays(TODAY, 10 * 7 - 2), today: TODAY, days: 3, level: "new" });
  const first = plan.weeks[0].sessions.map(s => s.type);
  assert(first.every(t => t === "runwalk"), first.join());
  const steps = buildSteps("runwalk", { sport: "run", minutes: 30, weekIndex: 0 });
  assert(steps.some(s => s.label === "Walk"));
});

check("a race too far away caps the plan at 24 weeks; late in the week starts next Monday", () => {
  const plan = makePlan({ eventId: "run-half", raceDate: addDays(TODAY, 300), today: TODAY, days: 4, level: "regular" });
  assert.equal(plan.weeks.length, 24);
  const fri = makePlan({ eventId: "run-fit", today: "2026-11-20", days: 3, level: "regular" });
  assert.equal(fri.weeks[0].start, "2026-11-23");
  assert.equal(planWeeks("run-10k", "2026-12-20", TODAY), 5);
  assert.throws(() => makePlan({ eventId: "run-10k", raceDate: "2026-11-01", today: TODAY, days: 4 }));
});

check("week slots put the long day on the weekend and key days apart", () => {
  assert.deepEqual(weekSlots(3, 5).slots, [1, 3, 5]);
  assert.deepEqual(weekSlots(4, 6).slots, [1, 3, 5, 6]);
  assert.equal(weekSlots(4, 5).after, 6);
});

check("moving a session and finding the next one", () => {
  const plan = makePlan({ eventId: "ride-tt", raceDate: addDays(TODAY, 60), today: TODAY, days: 4, level: "regular" });
  const first = allSessions(plan)[0];
  const moved = moveSession(plan, first.id, addDays(first.day, 1));
  assert.equal(allSessions(moved).find(s => s.id === first.id).day, addDays(first.day, 1));
  const done = { ...plan, completed: { [first.id]: true } };
  assert.notEqual(nextSession(done, TODAY).id, first.id);
});

check("interval sessions repeat and group for display", () => {
  const steps = buildSteps("vo2", { sport: "run", minutes: 50, level: "regular" });
  const work = steps.filter(s => s.kind === "work");
  assert(work.length >= 3 && work.every(s => s.zone === 5));
  const groups = groupSteps(steps);
  assert(groups.some(g => g.set && g.n === work.length));
  const crit = buildSteps("racesim", { sport: "ride", minutes: 60, eventId: "ride-crit" });
  assert(crit.filter(s => s.label.startsWith("Jump")).length >= 20);
  assert(averageMet(steps, "run") > averageMet(buildSteps("easy", { sport: "run", minutes: 50 }), "run"));
});

check("zones from a recent race, FTP, 2K and age", () => {
  const profile = { age: 40, runRace: { distanceM: 5000, seconds: 25 * 60 }, ftp: 250, row2k: 7 * 60 + 20 };
  const t = runThreshold(profile);
  assert(t > 0.3 && t < 0.4, `threshold ${t}`); // about 8:30/mi for a 25-minute 5K
  const z2 = zoneTarget(2, "run", profile, "mi");
  assert.equal(z2.metric, "pace");
  assert(z2.low < z2.high);
  assert.match(z2.target, /\/mi$/);
  const z4 = zoneTarget(4, "ride", profile);
  assert.equal(z4.target, "228–263 W");
  const row = zoneTarget(2, "row", profile);
  assert.equal(row.metric, "split");
  assert.match(row.rate, /spm/);
  assert.equal(maxHrFor(profile), 180);
  assert.deepEqual(hrRange(2, profile), [108, 126]);
  const bare = zoneTarget(3, "run", {}, "mi");
  assert.equal(bare.metric, null);
  assert(bare.feel.length > 0);
  assert.equal(judge("pace", 400, 420, 380), "fast");
  assert.equal(judge("pace", 400, 420, 410), "ok");
  assert.equal(judge("power", 200, 240, 180), "slow");
});

check("GPS: distance, jitter, jumps and gaps", () => {
  const a = { lat: 40, lon: -105, t: 0, acc: 5 };
  const b = { lat: 40.001, lon: -105, t: 30000, acc: 5 };
  const d = haversine(a, b);
  assert(Math.abs(d - 111.2) < 1, `${d}`);
  assert.equal(stepFor(a, { ...b, acc: 80 }).accept, false, "inaccurate fix dropped");
  assert.equal(stepFor(a, { ...b, t: 2000 }, "run").accept, false, "55 m/s is a jump");
  assert.equal(stepFor(a, { ...a, lat: 40.00001, t: 1000 }).accept, false, "jitter ignored");
  const g = stepFor(a, { ...b, lat: 40.01, t: 300000 }, "run");
  assert(g.accept && g.gap, "a long gap is noted");
});

check("a recording: fixes, pause, steps, sensors and finishing", () => {
  const steps = buildSteps("threshold", { sport: "run", minutes: 50, level: "regular" });
  let live = newLive({ sport: "run", mode: "gps", steps, sessionType: "threshold", now: 0 });
  // 3 m/s north for 10 minutes, a fix a second.
  for (let i = 0; i <= 600; i += 1) live = addFix(live, { lat: 40 + (i * 3) / 111195, lon: -105, t: i * 1000, acc: 5, hr: 150 });
  live = addSensor(live, { hr: 150 });
  assert(Math.abs(live.meters - 1800) < 20, `${live.meters}`);
  live = pause(live, 600000);
  const frozen = addFix(live, { lat: 41, lon: -105, t: 610000, acc: 5 });
  assert.equal(frozen.meters, live.meters, "paused ignores fixes");
  live = resume(live, 700000);
  assert.equal(activeSec(live, 760000), 660);
  const at = stepAt(steps, 13 * 60);
  assert.equal(at.step.kind, "work");
  assert.match(stepAnnouncement(at.step, { metric: "pace", low: 430, high: 445 }, "mi"), /Aim for 7 10 to 7 25 per mile/);
  const { activity, track } = finishLive(live, 760000, { unit: "mi" });
  assert.equal(activity.splits.length, 1);
  assert(track.length > 10 && track.length <= 600);
  assert.equal(activity.hrAvg, 150);
  // The saved activity is valid data.
  const data = normalizeData({ activities: [activity] });
  assert.equal(data.activities.length, 1);
});

check("indoor machines count their own distance", () => {
  let live = newLive({ sport: "row", mode: "indoor", now: 0 });
  live = addSensor(live, { distance: 1000 });
  live = addSensor(live, { distance: 1500, power: 200 });
  assert.equal(live.meters, 500);
  assert.equal(live.power.n, 1);
});

check("Bluetooth messages decode", () => {
  const view = bytes => new DataView(Uint8Array.from(bytes).buffer);
  assert.equal(parseHeartRate(view([0x00, 72])), 72);
  assert.equal(parseHeartRate(view([0x01, 0x2c, 0x01])), 300);
  assert.equal(parsePower(view([0x00, 0x00, 0xfa, 0x00])).power, 250);
  const crank = parsePower(view([0x20, 0x00, 0xc8, 0x00, 0x0a, 0x00, 0x00, 0x04]));
  assert.equal(crank.crankRevs, 10);
  // Rower: stroke rate 26 spm (52/2), 120 strokes, distance 1234 m, split 1:55 (115 s), power 180 W.
  const rower = parseRower(view([0x2c, 0x00, 52, 120, 0, 0xd2, 0x04, 0x00, 115, 0, 180, 0]));
  assert.deepEqual(rower, { strokeRate: 26, strokes: 120, distance: 1234, split: 115, power: 180 });
  // Bike: speed 30 km/h, cadence 90, power 200, HR 140.
  const bike = parseIndoorBike(view([0x44, 0x02, 0xb8, 0x0b, 180, 0, 200, 0, 140]));
  assert.equal(Math.round(bike.speed * 3.6), 30);
  assert.equal(bike.cadence, 90);
  assert.equal(bike.power, 200);
  assert.equal(bike.hr, 140);
  const tread = parseTreadmill(view([0x04, 0x00, 0x20, 0x03, 0x10, 0x27, 0x00]));
  assert.equal(tread.distance, 10000);
});

check("splits, routes, downsampling and GPX", () => {
  const pts = Array.from({ length: 2001 }, (_, i) => ({ lat: 40 + (i * 2) / 111195, lon: -105, t: i * 1000, seg: 0 }));
  const sp = splits(pts, 1000);
  assert.equal(sp.length, 4);
  assert(Math.abs(sp[0].sec - 500) < 2);
  const small = downsample(pts, 300);
  assert(small.length <= 320 && small[0] === pts[0] && small.at(-1) === pts.at(-1));
  assert(Math.abs(trackDistance(small) - trackDistance(pts)) < 5);
  assert(routePath(small).d.startsWith("M"));
  const gpx = toGpx({ title: "Test <run>", sport: "run", start: new Date(0).toISOString() }, small.slice(0, 3));
  assert.match(gpx, /<trkpt lat="40" lon="-105">/);
  assert.match(gpx, /Test &lt;run&gt;/);
});

check("bad saved data is cleaned up", () => {
  const d = normalizeData({ prefs: { unit: "furlongs" }, plans: [{ eventId: "nope" }, 5], activities: [{ sport: "swim" }, null], profile: { ftp: 9999, age: 30 } });
  assert.equal(d.prefs.unit, "mi");
  assert.deepEqual(d.plans, []);
  assert.deepEqual(d.activities, []);
  assert.equal(d.profile.ftp, null);
  assert.equal(d.profile.age, 30);
});

check("PlanFox and the diet planner see the plan", () => {
  const plan = makePlan({ eventId: "run-10k", raceDate: addDays(TODAY, 8 * 7 - 1), today: TODAY, days: 4, level: "regular" });
  const raw = { plans: [plan], activePlanId: plan.id, prefs: { trainTime: "06:30" }, activities: [{ id: "x1", sport: "ride", title: "Commute", start: "2026-11-17T08:00:00Z", day: "2026-11-17", sec: 1800, meters: 9000 }] };
  const items = planItems(raw, TODAY, addDays(TODAY, 6), TODAY);
  assert(items.length >= 4);
  assert(items.every(i => i.href.startsWith("/pace")));
  assert(items.some(i => i.time === "06:30"));
  assert(items.some(i => i.title === "Commute" && i.done));
  assert(launchTargets(raw).some(t => t.href === "/pace?next=1"));
  const fuel = paceWorkouts(raw, TODAY, addDays(TODAY, 6));
  assert(fuel.length >= 4 && fuel.every(w => w.minutes > 0 && w.met > 3 && w.kind === "cardio"));
  const race = paceWorkouts(raw, addDays(TODAY, 8 * 7 - 1), addDays(TODAY, 8 * 7 - 1));
  assert(race[0].minutes > 40, "race day counts the race");
  assert.deepEqual(paceWorkouts(null, TODAY, TODAY), []);
});

check("clock and pace formatting", () => {
  assert.equal(fmtClock(3725), "1:02:05");
  assert.equal(parseClock("1:02:05"), 3725);
  assert.equal(parseClock("25:00"), 1500);
  assert.equal(parseClock("abc"), null);
  assert.equal(fmtPace(450, "mi"), "7:30 /mi");
});

console.log(`PaceFox: ${passed} checks passed.`);
