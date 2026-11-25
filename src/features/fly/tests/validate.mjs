// PilotFox checks: node src/features/fly/tests/validate.mjs
import assert from "node:assert/strict";

import { ceilingFt, flightCategory, magVar, parseAirports, parseHazards, parseMetars, parseTraffic, visibilityMiles } from "../../../../api/fly/_parse.js";
import { fdCode } from "../../../services/weather/windsAloft.js";
import { airportsAlong, courseDeg, densityAltitude, distanceNm, fuelStops, hazardsOnRoute, inPolygon, planFlight, samplePoints, windTriangle } from "../model/nav.js";
import { decodeFb, GENERATORS, makeQuestion } from "../model/generators.js";
import { QUESTIONS } from "../data/questions.js";
import { EXAMS } from "../data/exams.js";
import { TOPICS, topicsById } from "../data/topics.js";
import { normalizeData, progressFor, recordAnswer } from "../state/flyStore.js";
import { planItems } from "../model/planLink.js";
import { FT, KT, SCENARIOS, levelThrottle, readout, scenarioById, stallSpeedKt, step } from "../model/sim.js";
import { papiColors } from "../model/simView.js";
import { fmtFreq, gradeCall, normalizeCall, parseFreq, turnKnob } from "../model/radio.js";
import { FREQS, LESSONS } from "../data/radio.js";
import { alongAtTime, assessLanding, corridorGrid, flyingWeather, hourAt, mergePlaces, parseRouteHours, pickLandingSpots, placesFromWikipedia, pointAlong, runwayNeedFt, timeAtAlong, weatherStretches } from "../model/trip.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

test("winds-aloft codes decode back to what the shared module encodes", () => {
  assert.equal(fdCode({ dir: 270, speedKt: 25, tempC: -8 }, 9000), "2725-08");
  assert.deepEqual(decodeFb("2725-08"), { dir: 270, kt: 25, tempC: -8 });
  assert.deepEqual(decodeFb("7315", 30000), { dir: 230, kt: 115, tempC: null });
  assert.equal(decodeFb(fdCode({ dir: 230, speedKt: 115, tempC: -52 }, 30000), 30000).tempC, -52);
  assert.equal(decodeFb("9900+05").kt, 0);
});

test("great-circle distance and course", () => {
  const den = { lat: 39.8617, lon: -104.6732 };
  const lax = { lat: 33.9425, lon: -118.4081 };
  near(distanceNm(den, lax), 749, 6, "DEN-LAX");
  near(courseDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 90, 0.01);
  near(courseDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 0, 0.01);
});

test("wind triangle matches an E6B", () => {
  const t = windTriangle(90, 120, { dir: 0, kt: 20 });
  near(t.wca, -9.6, 0.1);
  near(t.gs, 118.3, 0.3);
  const head = windTriangle(360, 100, { dir: 360, kt: 20 });
  near(head.gs, 80, 0.01);
  assert.equal(windTriangle(0, 50, { dir: 90, kt: 60 }), null, "too much crosswind");
});

test("density altitude follows the pilot's rule of thumb", () => {
  near(densityAltitude(5000, 29.92, 30), 8000, 1); // ISA at 5,000 ft is 5 °C: 5,000 + 120 × 25
  near(densityAltitude(0, 29.92, 15), 0, 0.01);
});

test("a flight plan adds up legs, time and fuel, and flags fuel stops", () => {
  const a = { id: "A", lat: 30, lon: -97 };
  const b = { id: "B", lat: 33.4, lon: -112 };
  const samples = samplePoints([a, b], 30);
  assert.equal(samples[0].alongNm, 0);
  const plan = planFlight({ waypoints: [a, b], aircraft: { tas: 120, gph: 9, usableGal: 40, taxiGal: 1 }, altitudeFt: 7500, departAt: 0, samples, profiles: null });
  near(plan.totalNm, distanceNm(a, b), 1);
  near(plan.totalMin, (plan.totalNm / 120) * 60, 0.5);
  const stops = fuelStops(plan, { tas: 120, gph: 9, usableGal: 40, taxiGal: 1 });
  assert.ok(stops.length >= 1, "a 700 nm trip on 40 gallons needs fuel");
  // 39 gal - 4.5 gal reserve = 34.5 gal = 3.83 h = 460 nm
  near(stops[0].alongNm, 460, 10);
  const shortPlan = planFlight({ waypoints: [a, { id: "C", lat: 30.5, lon: -97.5 }], aircraft: { tas: 120, gph: 9, usableGal: 40 }, altitudeFt: 5500, samples: samplePoints([a, { lat: 30.5, lon: -97.5 }], 30), profiles: null });
  assert.equal(fuelStops(shortPlan, { gph: 9, usableGal: 40 }).length, 0);
});

test("the planner reads winds from the shared winds-aloft profiles", () => {
  const a = { id: "A", lat: 40, lon: -100 };
  const b = { id: "B", lat: 40, lon: -98 };
  const hour = { time: new Date(0), surface: { speedKt: null }, levels: [{ altitudeFt: 1000, speedKt: 20, dir: 270, tempC: 10 }, { altitudeFt: 20000, speedKt: 20, dir: 270, tempC: -20 }] };
  const samples = samplePoints([a, b], 20);
  const profiles = samples.map(() => ({ elevationFt: 0, hours: [hour] }));
  const plan = planFlight({ waypoints: [a, b], aircraft: { tas: 100, gph: 8, usableGal: 40 }, altitudeFt: 5500, departAt: 0, samples, profiles });
  near(plan.legs[0].gs, 120, 1, "a 20 kt tailwind on an eastbound leg");
  near(plan.legs[0].wind.dir, 270, 1);
});

test("airports along the route and hazards it crosses", () => {
  const route = [{ lat: 40, lon: -100 }, { lat: 40, lon: -98 }];
  const along = airportsAlong(route, [{ id: "ON", lat: 40.05, lon: -99 }, { id: "FAR", lat: 41, lon: -99 }]);
  assert.deepEqual(along.map(x => x.id), ["ON"]);
  near(along[0].alongNm, distanceNm(route[0], { lat: 40, lon: -99 }), 2);
  const poly = [[39.5, -99.5], [40.5, -99.5], [40.5, -98.5], [39.5, -98.5]];
  assert.ok(inPolygon({ lat: 40, lon: -99 }, poly));
  assert.ok(!inPolygon({ lat: 41, lon: -99 }, poly));
  const hz = hazardsOnRoute(samplePoints(route, 10), [{ id: "h", hazard: "ICE", baseFt: 8000, topFt: 16000, coords: poly }], 5500);
  assert.equal(hz.length, 1);
  assert.equal(hz[0].atAltitude, false, "5,500 ft is below icing from 8,000");
});

test("aviation weather parsing", () => {
  assert.equal(visibilityMiles("10+"), 10);
  assert.equal(visibilityMiles("1 1/2"), 1.5);
  assert.equal(visibilityMiles("P6SM"), 6);
  assert.equal(ceilingFt([{ cover: "FEW", base: 800 }, { cover: "BKN", base: 1500 }, { cover: "OVC", base: 3000 }]), 1500);
  assert.equal(flightCategory(2500, 10), "MVFR");
  assert.equal(flightCategory(800, 10), "IFR");
  assert.equal(flightCategory(null, 0.5), "LIFR");
  assert.equal(flightCategory(5000, 10), "VFR");
  assert.equal(magVar("08E"), 8);
  assert.equal(magVar("12W"), -12);
  const [m] = parseMetars([{ icaoId: "KDEN", lat: 39.8, lon: -104.6, elev: 1656, obsTime: 1794804780, rawOb: "METAR KDEN", temp: 4, dewp: 0, wdir: 230, wspd: 6, visib: "10+", altim: 1022.1, clouds: [{ cover: "BKN", base: 2200 }], name: "Denver Intl, CO, US" }]);
  assert.equal(m.category, "MVFR");
  assert.equal(m.altimInHg, 30.18);
  assert.equal(m.name, "Denver Intl");
  const [a] = parseAirports([{ icaoId: "KAPA", name: "DENVER/CENTENNIAL ", lat: 39.57, lon: -104.85, elev: 1794, magdec: "08E", tower: "T", services: "S", runways: [{ id: "17L/35R", dimension: "10001x100", surface: "A", alignment: 178 }], freqs: "LCL/P,118.9;ATIS,120.3" }]);
  assert.equal(a.name, "Denver/Centennial");
  assert.equal(a.runways[0].lengthFt, 10001);
  assert.deepEqual(a.freqs[0], { name: "TWR", mhz: "118.9" });
  const hz = parseHazards([{ tag: "1C", hazard: "ICE", geometryType: "AREA", forecastHour: 3, validTime: "2026-11-16T06:00:00Z", base: "080", top: "160", coords: [{ lat: "1", lon: "1" }, { lat: "2", lon: "1" }, { lat: "2", lon: "2" }] }, { tag: "1C", hazard: "ICE", geometryType: "AREA", forecastHour: 6, coords: [{ lat: "1", lon: "1" }, { lat: "2", lon: "1" }, { lat: "2", lon: "2" }] }], []);
  assert.equal(hz.length, 1, "keeps only the soonest forecast");
  assert.equal(hz[0].baseFt, 8000);
  const t = parseTraffic({ ac: [{ hex: "a1", lat: 1, lon: 1, alt_baro: "ground", flight: "N1 ", dst: 4 }, { hex: "b2", lat: 1, lon: 1, alt_baro: 5000, dst: 2 }, { hex: "c3" }] });
  assert.deepEqual(t.map(x => x.hex), ["b2", "a1"]);
  assert.equal(t[1].ground, true);
  assert.equal(t[1].callsign, "N1");
});

test("the question bank is well formed and covers every test", () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
    ids.add(q.id);
    assert.equal(q.choices.length, 3, q.id);
    assert.equal(new Set(q.choices).size, 3, q.id);
    assert.ok(q.answer >= 0 && q.answer < 3, q.id);
    assert.ok(q.why && q.ref, q.id);
    assert.ok(topicsById.has(q.topic), `${q.id} topic ${q.topic}`);
    assert.ok(q.exams.every(e => EXAMS.some(x => x.id === e)), q.id);
  }
  for (const e of EXAMS) {
    assert.ok(QUESTIONS.filter(q => q.exams.includes(e.id)).length >= 10, `${e.id} needs questions`);
    assert.ok(TOPICS.some(t => t.exams.includes(e.id)), `${e.id} needs notes`);
  }
});

test("generated questions always have three different choices and the right answer", () => {
  for (const g of GENERATORS) {
    for (let seed = 1; seed <= 400; seed++) {
      const q = makeQuestion(g, seed);
      assert.equal(q.choices.length, 3, `${g.id}#${seed}`);
      assert.equal(new Set(q.choices).size, 3, `${g.id}#${seed}: ${q.choices}`);
      assert.ok(q.answer >= 0, `${g.id}#${seed}`);
      assert.ok(topicsById.has(q.topic));
    }
    assert.deepEqual(makeQuestion(g, 42), makeQuestion(g, 42), `${g.id} repeats with a seed`);
  }
  // Spot-check the math in a few.
  const fb = makeQuestion(GENERATORS.find(g => g.id === "g-fb"), 7);
  const code = fb.text.match(/reads (\d+[+-]?\d*)\./)[1];
  const alt = Number(fb.text.match(/for ([\d,]+) ft/)[1].replace(/,/g, ""));
  const d = decodeFb(code, alt);
  assert.ok(fb.choices[fb.answer].startsWith(`${String(d.dir).padStart(3, "0")}° true at ${d.kt} knots`));
});

test("saved data is cleaned, study progress tracked, and flights go to TaskFox", () => {
  assert.equal(normalizeData(null).aircraft.tas, 120);
  const d = normalizeData({ aircraft: { tas: 9999, gph: "x" }, route: [{ id: "KDEN", lat: 39, lon: -104 }, { bad: 1 }], flights: [{ id: "f1", route: [{ id: "A", lat: 1, lon: 1 }, { id: "B", lat: 2, lon: 2 }], departAt: "2026-11-20T15:30:00.000Z", minutes: 75 }] });
  assert.equal(d.aircraft.tas, 600);
  assert.equal(d.route.length, 1);
  let study = recordAnswer({}, "par", "as1", true);
  study = recordAnswer(study, "par", "as2", false);
  assert.deepEqual(progressFor(study, "par", ["as1", "as2", "as3"]), { seen: 2, mastered: 1, missed: 1, total: 3 });
  const items = planItems(d, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1);
  assert.equal(items[0].href, "/pilot?flight=f1");
  assert.equal(planItems(d, "2026-12-01", "2026-12-31").length, 0);
});

const fly = (s, c, seconds) => {
  for (let i = 0; i < seconds * 60; i += 1) s = step(s, typeof c === "function" ? c(s) : c, 1 / 60);
  return s;
};
const hands = s => ({ elevator: 0, aileron: 0, rudder: 0, throttle: s.throttle, flaps: s.flaps, brakes: false });

test("the simulator's trainer flies like a 172: stall speeds, trimmed cruise holds level", () => {
  near(stallSpeedKt(0), 48, 2, "clean stall");
  near(stallSpeedKt(30), 41, 2, "full-flap stall");
  near(stallSpeedKt(0, 2), 48 * Math.SQRT2, 2, "60° bank stall");
  assert.ok(levelThrottle(100) < 0.8 && levelThrottle(130) > 1, "100 kt is cruise power, 130 kt is beyond full power");
  const s0 = scenarioById("cruise").make();
  const s = fly(s0, hands(s0), 30);
  near(readout(s).alt, 3000, 30, "hands-off altitude");
  near(readout(s).kt, 100, 2, "hands-off speed");
});

test("the simulator takes off, turns with bank, stalls past the critical angle and judges landings", () => {
  const t0 = scenarioById("takeoff").make();
  const up = fly(t0, s => ({ ...hands(s), throttle: 1, elevator: readout(s).kt > 55 ? 0.5 : 0 }), 25);
  assert.equal(up.onGround, false);
  assert.ok(readout(up).alt > 150, `climbing after takeoff, got ${readout(up).alt}`);

  const c0 = scenarioById("cruise").make();
  const banked = fly({ ...c0, phi: (30 * Math.PI) / 180 }, s => ({ ...hands(s), elevator: 0.12 }), 10);
  // g·tan(30°) / 100 kt ≈ 6.3°/s
  near(readout(banked).turnRate, 6.3, 0.8, "30° bank turn rate at 100 kt");

  const st0 = scenarioById("stalls").make();
  const stalled = fly(st0, s => ({ ...hands(s), throttle: 0, elevator: 1 }), 25);
  assert.ok(stalled.stalled || stalled.warn === "stall", "full back stick at idle stalls the wing");

  const hard = step({ ...c0, h: 0.1, gamma: (-20 * Math.PI) / 180, v: 60 * KT }, hands(c0), 1 / 30);
  assert.equal(hard.outcome, "crash");
  const f0 = scenarioById("final").make();
  let soft = { ...f0, x: 0, y: 0, h: 1, gamma: (-1 * Math.PI) / 180, alpha: (6 * Math.PI) / 180, v: 55 * KT };
  for (let i = 0; i < 600 && !soft.outcome; i += 1) soft = step(soft, { ...hands(f0), throttle: 0 }, 1 / 60);
  assert.equal(soft.outcome, "landed");
  assert.equal(soft.touchdown.where, "runway");
  assert.ok(SCENARIOS.every(sc => sc.make().v >= 0));
});

test("PAPI lights show two white, two red on the 3° glide path", () => {
  const f0 = scenarioById("final").make();
  const on = papiColors(f0).colors.filter(c => c === "#ff3b30").length;
  assert.equal(on, 2);
  assert.equal(papiColors({ ...f0, h: f0.h * 1.6 }).colors.filter(c => c === "#ff3b30").length, 0, "high is all white");
  assert.equal(papiColors({ ...f0, h: f0.h * 0.5 }).colors.filter(c => c === "#ff3b30").length, 4, "low is all red");
  assert.ok(FT > 0);
});

test("radio calls: spoken numbers and letters, frequencies and knobs", () => {
  assert.equal(normalizeCall("Runway two eight, taxi via Alpha, Skyhawk 34A"), "runway 28 taxi via a skyhawk 34 a");
  assert.equal(normalizeCall("contact departure one two four point three five"), "contact departure 124.35");
  assert.equal(normalizeCall("at three thousand five hundred"), "at 3500");
  assert.equal(normalizeCall("niner tree fife"), "935");
  assert.equal(parseFreq("121.7"), 121700);
  assert.equal(parseFreq("1183"), 118300);
  assert.equal(parseFreq("99.5"), null);
  assert.equal(fmtFreq(turnKnob(121975, "small", 1)), "121.000");
  assert.equal(fmtFreq(turnKnob(118000, "big", -1)), "136.000");
});

test("every radio lesson's example call passes its own check, and bad calls don't", () => {
  for (const lesson of LESSONS) {
    for (const st of lesson.steps) {
      assert.ok(FREQS.some(f => f.khz === st.freq), `${lesson.id}: ${st.freq} is on the frequency list`);
      if (st.kind === "listen") {
        assert.ok(st.choices[st.answer], `${lesson.id}: listen step has an answer`);
        continue;
      }
      const g = gradeCall(st.example, st.expect);
      assert.ok(g.ok, `${lesson.id}: "${st.example}" → ${g.norm} misses ${g.parts.filter(p => !p.ok && !p.optional).map(p => p.label).join(", ")}`);
      assert.equal(gradeCall("hello there", st.expect).ok, false, `${lesson.id}: an empty call fails`);
    }
  }
  const spoken = gradeCall("foxfield ground skyhawk one two three four alpha at the FBO with information bravo request taxi", LESSONS[0].steps[1].expect);
  assert.ok(spoken.ok, "a spoken-style ground call passes");
});

test("trip timing: where you are and when you get there", () => {
  const route = [
    { id: "A", lat: 39, lon: -105 },
    { id: "B", lat: 39, lon: -103 },
  ];
  const total = distanceNm(route[0], route[1]);
  const samples = samplePoints(route, 20);
  const plan = planFlight({ waypoints: route, aircraft: { tas: 120, gph: 9, usableGal: 53 }, altitudeFt: 6500, departAt: 0, samples, profiles: null });
  near(plan.totalMin, (total / 120) * 60, 0.5);
  const mid = pointAlong(route, total / 2);
  near(mid.lat, 39, 0.02);
  near(mid.lon, -104, 0.02);
  near(timeAtAlong(plan, total / 2), (plan.totalMin / 2) * 60000, 2000);
  near(alongAtTime(plan, (plan.totalMin / 2) * 60000), total / 2, 0.5);
  assert.equal(alongAtTime(plan, -5), 0);
  near(alongAtTime(plan, 1e12), total, 0.01);
});

test("landing spots: runway, ownership and fuel decide what's realistic", () => {
  const c172 = { id: "c172", name: "Cessna 172S", tas: 120 };
  const rwy = (len, surface = "Asphalt", id = "11/29") => ({ id, lengthFt: len, surface });
  assert.equal(runwayNeedFt(c172, 0), 2800);
  assert.ok(runwayNeedFt(c172, 6000) > 3900, "high fields need more runway");
  assert.equal(assessLanding({ name: "Town Muni", owner: "P", fuel: true, elevFt: 500, runways: [rwy(5400)] }, c172).level, "good");
  assert.equal(assessLanding({ name: "Town Muni", owner: "P", fuel: false, elevFt: 500, runways: [rwy(5400)] }, c172).level, "ok");
  assert.equal(assessLanding({ name: "Farm Strip", owner: "P", fuel: true, elevFt: 500, runways: [rwy(3600, "Turf")] }, c172).level, "ok");
  assert.equal(assessLanding({ name: "Short Field", owner: "P", fuel: true, elevFt: 500, runways: [rwy(1800)] }, c172).level, "short");
  assert.equal(assessLanding({ name: "Buckley Space Force Base", owner: "M", runways: [rwy(11000)] }, c172).level, "no");
  assert.equal(assessLanding({ name: "Hospital", owner: "P", runways: [rwy(60, "Concrete", "H1")] }, c172).level, "no");
  // The parser keeps the owner code these checks use.
  assert.equal(parseAirports([{ icaoId: "KBKF", name: "AURORA/BUCKLEY", owner: "M", runways: [] }])[0].owner, "M");

  const spot = (id, alongNm, level, extra = {}) => ({ id, alongNm, offNm: 3, category: "VFR", landing: { level, longestFt: 5000, needFt: 2800 }, ...extra });
  const picks = pickLandingSpots([spot("K1", 5, "good"), spot("K2", 60, "ok"), spot("K3", 70, "good"), spot("K4", 140, "short"), spot("K5", 150, "good", { category: "IFR" }), spot("K6", 160, "ok")], 200);
  assert.ok(!picks.some(p => p.id === "K1"), "skips the field next to departure");
  assert.ok(!picks.some(p => p.id === "K4"), "skips a runway that's too short");
  assert.ok(picks.some(p => p.id === "K3"), "prefers a good stop over one without fuel");
});

test("weather along the trip: forecast hours read as flying conditions", () => {
  const hours = parseRouteHours({ hourly: { time: [0, 3600], precipitation: [0, 3], precipitation_probability: [5, 90], weather_code: [1, 95], cloud_cover_low: [0, 80], cloud_cover: [20, 100], visibility: [24000, 3000], wind_gusts_10m: [5, 18], cape: [100, 1800], freezing_level_height: [3500, 3200], temperature_2m: [15, 12] } });
  assert.equal(hours.length, 2);
  near(hours[1].gustKt, 35, 0.1);
  assert.equal(hourAt(hours, 3000 * 1000).t, 3600000);
  assert.equal(hourAt(hours, 20 * 3600000), null, "no hour that far out");
  assert.equal(flyingWeather(hours[0], 5500).level, 0);
  const storm = flyingWeather(hours[1], 5500);
  assert.equal(storm.level, 3);
  assert.ok(storm.flags.includes("Thunderstorms") && storm.flags.includes("Low clouds"));
  assert.equal(flyingWeather(null, 5500).level, null);

  const route = [{ id: "A", lat: 39, lon: -105 }, { id: "B", lat: 39, lon: -103 }];
  const samples = samplePoints(route, 30);
  const grid = corridorGrid(samples, 20);
  assert.equal(grid.length, samples.length * 3);
  near(distanceNm(grid[0], grid[1]), 20, 0.5);
  const plan = planFlight({ waypoints: route, aircraft: { tas: 60, gph: 9, usableGal: 53 }, altitudeFt: 5500, departAt: 0, samples, profiles: null });
  const withHours = grid.map(p => ({ ...p, hours }));
  const stretches = weatherStretches(withHours, { plan, altitudeFt: 5500 });
  assert.equal(stretches[0].level, 0, "clear at departure");
  assert.equal(stretches[stretches.length - 1].level, 3, "storms an hour in");
});

test("things to do: Wikipedia places skip the airport and its neighbors", () => {
  const from = { lat: 38.43, lon: -105.1 };
  const body = { query: { pages: {
    1: { pageid: 1, title: "Fremont County Airport", description: "airport in Colorado", coordinates: [{ lat: 38.43, lon: -105.1 }] },
    2: { pageid: 2, title: "Royal Gorge Bridge", description: "suspension bridge in Colorado", coordinates: [{ lat: 38.46, lon: -105.32 }] },
    3: { pageid: 3, title: "Museum of Colorado Prisons", description: "museum", coordinates: [{ lat: 38.44, lon: -105.24 }] },
    4: { pageid: 4, title: "Cañon City High School", description: "school", coordinates: [{ lat: 38.44, lon: -105.23 }] },
  } } };
  const places = placesFromWikipedia(body, from, { skipName: "Canon City/Fremont County" });
  assert.deepEqual(places.map(p => p.name).sort(), ["Museum of Colorado Prisons", "Royal Gorge Bridge"]);
  assert.equal(places.find(p => p.name.startsWith("Museum")).kind, "Museum");
  const merged = mergePlaces([places, [{ id: "o1", name: "Royal Gorge bridge", kind: "Sight", distNm: 10 }, { id: "o2", name: "Diner", kind: "Food", distNm: 0.4 }]]);
  assert.equal(merged[0].name, "Diner", "food near the field first");
  assert.equal(merged.filter(p => /royal gorge/i.test(p.name)).length, 1, "duplicates merged");
});

console.log(`PilotFox: ${passed} checks passed.`);
