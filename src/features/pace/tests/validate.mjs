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
import { ROW_WORKOUTS, ROW_GROUPS, LENGTHS, rowWorkoutSteps, timeOnly, hasDistanceSteps } from "../data/rowWorkouts.js";
import { trackDistanceStep, endDistanceStep, paceCallout, progressCallout, readyAnnouncement } from "../model/live.js";
import { parsePm5General, parsePm5Additional, parsePm5Stroke } from "../model/bluetooth.js";
import { parseFit, sampleSplits, unzip, readActivityFile, importedActivity } from "../model/fileImport.js";

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
  assert.equal(d.prefs.batterySaver, false, "battery saver is off unless chosen");
  assert.equal(normalizeData({ prefs: { batterySaver: true } }).prefs.batterySaver, true);
  assert.deepEqual(d.plans, []);
  assert.deepEqual(d.activities, []);
  assert.equal(d.profile.ftp, null);
  assert.equal(d.profile.age, 30);
});

check("TaskFox and the diet planner see the plan", () => {
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

// ---- Rowing workouts ---------------------------------------------------------

check("every rowing workout builds sensible steps at every length", () => {
  const groups = new Set(ROW_GROUPS.map(g => g.id));
  assert(ROW_WORKOUTS.length >= 12);
  assert.equal(new Set(ROW_WORKOUTS.map(w => w.id)).size, ROW_WORKOUTS.length);
  for (const w of ROW_WORKOUTS) {
    assert(groups.has(w.group), `${w.id} group`);
    for (const len of LENGTHS.map(l => l.id)) {
      for (const profile of [null, { row2k: 420 }]) {
        const steps = rowWorkoutSteps(w.id, len, profile);
        assert(steps.length >= 2, `${w.id} steps`);
        assert(steps.every(st => st.sec > 0 && st.zone >= 1 && st.zone <= 6 && st.label), `${w.id} ${len} steps valid`);
        assert(steps.some(st => st.kind === "work" || st.kind === "steady"), `${w.id} has work`);
        assert(steps.every(st => !st.meters || (st.meters >= 250 && st.kind === "work")), `${w.id} distance steps`);
        const min = stepsSeconds(steps) / 60;
        assert(min >= 12 && min <= 90, `${w.id} ${len} is ${min} min`);
        assert(typeof w.detail(len) === "string" && w.detail(len).length > 3);
        // Rest only ever sits between pieces, never at the end.
        assert.notEqual(steps.at(-1).kind, "rest");
      }
    }
  }
  // Longer is longer.
  assert(stepsSeconds(rowWorkoutSteps("8x500", "long")) > stepsSeconds(rowWorkoutSteps("8x500", "short")));
  // A faster rower's distance pieces are estimated shorter.
  const slow = rowWorkoutSteps("4x1000", "standard", { row2k: 540 }).find(st => st.meters);
  const fast = rowWorkoutSteps("4x1000", "standard", { row2k: 400 }).find(st => st.meters);
  assert(fast.sec < slow.sec);
  // 4 x 1000 m with 3 rests between, grouped for display.
  const four = rowWorkoutSteps("4x1000", "standard", null);
  assert.equal(four.filter(st => st.meters === 1000).length, 4);
  assert.equal(four.filter(st => st.kind === "rest").length, 3);
  const g = groupSteps(four).find(x => x.set);
  assert.equal(g.n, 4);
  assert.equal(g.work.meters, 1000);
  // Without anything measuring distance, pieces run on time.
  assert(hasDistanceSteps(four));
  assert(!hasDistanceSteps(timeOnly(four)));
  assert(timeOnly(four).filter(st => st.estimated).length === 4);
});

check("distance pieces end on the meter, then the rest runs on time", () => {
  const steps = [
    { label: "Warm up", kind: "warm", sec: 60, zone: 1 },
    { label: "500 m", kind: "work", meters: 500, sec: 120, zone: 5, rep: [1, 2] },
    { label: "Rest", kind: "rest", sec: 90, zone: 1, rep: [1, 2] },
    { label: "500 m", kind: "work", meters: 500, sec: 120, zone: 5, rep: [2, 2] },
  ];
  let live = { ...newLive({ sport: "row", mode: "indoor", steps, now: 0 }), meters: 0 };
  const at = (sec, l = live) => stepAt(steps, sec, l.marks);
  assert.equal(at(30).index, 0);
  assert.equal(at(30).left, 30);
  // Into the first piece: no time left, it runs until 500 m.
  let a = at(100);
  assert.equal(a.index, 1);
  assert.equal(a.left, null);
  live = { ...live, meters: 120 };
  let r = trackDistanceStep(live, a, 100);
  live = r.live;
  assert.equal(live.mStart[1], 120);
  assert.equal(r.metersLeft, 500);
  // Still going at 250 s (slow rower): still the piece.
  live = { ...live, meters: 500 };
  r = trackDistanceStep(live, at(250), 250);
  assert.equal(r.metersLeft, 120);
  assert.equal(at(250).index, 1);
  // Done at 280 s with a little overshoot.
  live = { ...live, meters: 630 };
  r = trackDistanceStep(live, at(280), 280);
  live = r.live;
  assert.equal(live.marks[1], 280);
  assert.equal(live.mStart[2], 620, "overshoot carries into the next step");
  a = at(300);
  assert.equal(a.index, 2);
  assert.equal(a.left, 70);
  // After the rest, the second piece starts.
  assert.equal(at(371).index, 3);
  // Skip ends a distance piece right away, and the last one ends the session.
  live = endDistanceStep(live, 3, 400);
  assert(at(401).done);
});

check("rowing callouts: rest says what's next, splits, halfway, get ready", () => {
  const rest = { label: "Rest", kind: "rest", sec: 120, zone: 1, cue: "Breathe." };
  const piece = { label: "1000 m", kind: "work", meters: 1000, sec: 230, zone: 4, rep: [2, 4] };
  const t = zoneTarget(4, "row", { row2k: 420 });
  const sayRest = stepAnnouncement(rest, null, "mi", piece, t);
  assert.match(sayRest, /^Rest, 2 minutes\./);
  assert.match(sayRest, /Next: 1000 meters, at 1 \d\d to 1 \d\d splits\./);
  const sayPiece = stepAnnouncement(piece, t, "mi");
  assert.match(sayPiece, /^2 of 4\. 1000 m, 1000 meters\. Aim for/);
  assert.equal(paceCallout(112, "ok"), "1 52 split. On target.");
  assert.equal(paceCallout(125, "slow"), "2 oh 5 split. Push a little.");
  assert.equal(paceCallout(null, "ok"), null);
  assert.equal(progressCallout(piece, { metersLeft: 490 })?.key, "half");
  assert.equal(progressCallout(piece, { metersLeft: 240 })?.key, "250");
  assert.equal(progressCallout(piece, { metersLeft: 700 }), null);
  const timedPiece = { label: "8 min", kind: "work", sec: 480, zone: 4 };
  assert.equal(progressCallout(timedPiece, { into: 241, left: 239 })?.key, "half");
  assert.equal(progressCallout(timedPiece, { into: 451, left: 29 })?.key, "30");
  assert.equal(readyAnnouncement(piece), "Ten seconds. Piece 2 of 4. Get ready.");
});

// ---- Concept2 PM5 ----------------------------------------------------------------

check("Concept2 PM5 status data", () => {
  const g = new DataView(new Uint8Array([0x10, 0x27, 0x00, 0xe8, 0x03, 0x00, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 120]).buffer);
  const gen = parsePm5General(g);
  assert.equal(gen.elapsed, 100);
  assert.equal(gen.distance, 100);
  // speed 4.2 m/s, rate 28, hr 255 (none), pace 1:59.04
  const a = new DataView(new Uint8Array([0, 0, 0, 0x68, 0x10, 28, 255, 0x80, 0x2e, 0, 0]).buffer);
  assert.deepEqual(parsePm5Additional(a), { speed: 4.2, strokeRate: 28, split: 119.04 });
  const st = new DataView(new Uint8Array([0, 0, 0, 0xc8, 0x00, 0, 0]).buffer);
  assert.deepEqual(parsePm5Stroke(st), { power: 200 });
});

// ---- Watch files --------------------------------------------------------------------

/** A tiny FIT file: a session and some records, little-endian. */
function makeFit({ sport = 15, records, session }) {
  const out = [];
  const u8 = n => out.push(n & 0xff);
  const u16 = n => { u8(n); u8(n >> 8); };
  const u32 = n => { u16(n & 0xffff); u16(n >>> 16); };
  const i32 = n => u32(n >>> 0);
  // Definition local 0 = record: timestamp(253,u32) lat(0,s32) lon(1,s32) hr(3,u8) dist(5,u32) power(7,u16)
  u8(0x40); u8(0); u8(0); u16(20); u8(6);
  [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [3, 1, 0x02], [5, 4, 0x86], [7, 2, 0x84]].forEach(([a, b, c]) => { u8(a); u8(b); u8(c); });
  for (const r of records) {
    u8(0x00); u32(r.ts); i32(r.lat == null ? 0x7fffffff : Math.round(r.lat / (180 / 2 ** 31))); i32(r.lon == null ? 0x7fffffff : Math.round(r.lon / (180 / 2 ** 31))); u8(r.hr ?? 0xff); u32(Math.round(r.d * 100)); u16(r.power ?? 0xffff);
  }
  // A compressed-timestamp record (local 1 = record without timestamp): +3 s
  u8(0x41); u8(0); u8(0); u16(20); u8(1); u8(5); u8(4); u8(0x86);
  const last = records.at(-1);
  u8(0x80 | (1 << 5) | ((last.ts + 3) & 0x1f)); u32(Math.round((last.d + 12) * 100));
  // Definition local 2 = session: start(2) sport(5,enum) timer(8) dist(9) hrAvg(16) hrMax(17)
  u8(0x42); u8(0); u8(0); u16(18); u8(6);
  [[2, 4, 0x86], [5, 1, 0x00], [8, 4, 0x86], [9, 4, 0x86], [16, 1, 0x02], [17, 1, 0x02]].forEach(([a, b, c]) => { u8(a); u8(b); u8(c); });
  u8(0x02); u32(session.start); u8(sport); u32(session.timer * 1000); u32(session.dist * 100); u8(session.hrAvg); u8(session.hrMax);
  const data = Uint8Array.from(out);
  const header = new Uint8Array(14);
  const hv = new DataView(header.buffer);
  hv.setUint8(0, 14); hv.setUint8(1, 0x20); hv.setUint16(2, 2132, true); hv.setUint32(4, data.length, true);
  header.set([0x2e, 0x46, 0x49, 0x54], 8);
  const file = new Uint8Array(14 + data.length + 2);
  file.set(header);
  file.set(data, 14);
  return file;
}

const FIT_TS = 1100000000; // 2024-11-08 in FIT seconds
const fitRow = makeFit({
  records: Array.from({ length: 41 }, (_, i) => ({ ts: FIT_TS + i * 30, d: i * 125, hr: 140 + (i % 10), power: 180 })),
  session: { start: FIT_TS, timer: 1200, dist: 5000, hrAvg: 145, hrMax: 162 },
});

check("reads a FIT file from a watch or rowing machine", () => {
  const w = parseFit(fitRow);
  assert.equal(w.type, "rowing");
  assert.equal(w.start, (FIT_TS + 631065600) * 1000);
  assert.equal(w.sec, 1200);
  assert.equal(w.meters, 5000);
  assert.equal(w.hrAvg, 145);
  assert.equal(w.hrMax, 162);
  assert.equal(w.powerAvg, 180);
  assert.equal(w.points.length, 0, "an indoor row has no route");
  assert.equal(w.samples.length, 42, "the compressed-timestamp record is read too");
  assert.equal(w.samples.at(-1).t - w.samples.at(-2).t, 3000);
  // 500 m every 2 minutes.
  const sp = sampleSplits(w.samples, 500);
  assert.equal(sp.length, 10);
  assert(sp.every(x => Math.abs(x - 120) < 0.01));
  const { activity, track } = importedActivity(w, { unit: "mi" });
  assert.equal(activity.sport, "row");
  assert.equal(activity.splitUnit, "500m");
  assert.equal(activity.source, "watch");
  assert.equal(track, null);
  assert(normalizeData({ activities: [activity] }).activities[0].source === "watch");

  // An outdoor run with GPS.
  const run = parseFit(makeFit({
    sport: 1,
    records: Array.from({ length: 60 }, (_, i) => ({ ts: FIT_TS + i * 5, lat: 40 + i * 0.0001, lon: -105, d: i * 15, hr: 150 })),
    session: { start: FIT_TS, timer: 300, dist: 885, hrAvg: 150, hrMax: 155 },
  }));
  assert.equal(run.type, "running");
  assert.equal(run.points.length, 60);
  assert(Math.abs(run.points[10].lat - 40.001) < 1e-6);
  const r = importedActivity(run, { unit: "km" });
  assert.equal(r.activity.sport, "run");
  assert(r.track.length > 10);
});

check("a FIT workout counts for that day's plan session", () => {
  const w = parseFit(fitRow);
  const day = new Date(w.start).toISOString().slice(0, 10);
  const plan = makePlan({ eventId: "row-2k", raceDate: addDays(day, 70), today: addDays(day, -14), days: 6, level: "regular" });
  const has = allSessions(plan).find(x => x.day === day);
  const { activity } = importedActivity(w, { plans: [plan] });
  if (has) {
    assert.equal(activity.planId, plan.id);
    assert.equal(activity.sessionId, has.id);
  }
  const { activity: none } = importedActivity(w, { plans: [{ ...plan, sport: "run" }] });
  assert.equal(none.sessionId, null);
});

assert.throws(() => parseFit(new Uint8Array(20)), /isn't a FIT file/);

// Zip (Garmin's Export Original) and gzip (Strava's bulk export).
async function deflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function makeZip(name, data, compressed) {
  const enc = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + enc.length + compressed.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true); lv.setUint32(18, compressed.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, enc.length, true);
  local.set(enc, 30); local.set(compressed, 30 + enc.length);
  const central = new Uint8Array(46 + enc.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, 8, true); cv.setUint32(20, compressed.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, enc.length, true); cv.setUint32(42, 0, true);
  central.set(enc, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true); ev.setUint32(12, central.length, true); ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + central.length + end.length);
  out.set(local); out.set(central, local.length); out.set(end, local.length + central.length);
  return out;
}
const zip = makeZip("12345_ACTIVITY.fit", fitRow, await deflate(fitRow, "deflate-raw"));
const inside = await unzip(zip);
assert.equal(inside.length, 1);
assert.deepEqual([...inside[0].bytes], [...fitRow]);
const fromZip = await readActivityFile("export.zip", zip);
assert.equal(fromZip[0].workout.meters, 5000);
const fromGz = await readActivityFile("activity.fit.gz", await deflate(fitRow, "gzip"));
assert.equal(fromGz[0].workout.sec, 1200);
passed += 1;
console.log("  ✓ reads zip and gzip exports");

console.log(`PaceFox: ${passed} checks passed.`);
