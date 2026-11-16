// FlyFox checks: node src/features/fly/tests/validate.mjs
import assert from "node:assert/strict";

import { ceilingFt, flightCategory, magVar, parseAirports, parseHazards, parseMetars, parseTraffic, visibilityMiles } from "../../../../api/fly/_parse.js";
import { decodeFb, fbCode, fbRows, freezingLevel, parseWindsAloft, windAt } from "../model/windsAloft.js";
import { airportsAlong, courseDeg, densityAltitude, distanceNm, fuelStops, hazardsOnRoute, inPolygon, planFlight, samplePoints, windTriangle } from "../model/nav.js";
import { GENERATORS, makeQuestion } from "../model/generators.js";
import { QUESTIONS } from "../data/questions.js";
import { EXAMS } from "../data/exams.js";
import { TOPICS, topicsById } from "../data/topics.js";
import { normalizeData, progressFor, recordAnswer } from "../state/flyStore.js";
import { planItems } from "../model/planLink.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

test("winds-aloft codes encode and decode like the FB forecast", () => {
  assert.equal(fbCode({ dir: 270, kt: 25, tempC: -8 }, 9000), "2725-08");
  assert.equal(fbCode({ dir: 230, kt: 115, tempC: -52 }, 30000), "731552");
  assert.equal(fbCode({ dir: 90, kt: 3, tempC: 5 }, 6000), "9900+05");
  assert.equal(fbCode({ dir: 360, kt: 20, tempC: 10 }, 3000), "3620");
  assert.deepEqual(decodeFb("7315", 30000), { dir: 230, kt: 115, tempC: null });
  assert.deepEqual(decodeFb("2725-08"), { dir: 270, kt: 25, tempC: -8 });
  assert.equal(decodeFb("731552", 30000).tempC, -52);
});

const body = {
  latitude: 40,
  longitude: -105,
  elevation: 1600,
  utc_offset_seconds: 0,
  hourly: {
    time: [1800000000],
    wind_speed_10m: [10], wind_direction_10m: [180], temperature_2m: [12],
    wind_speed_850hPa: [20], wind_direction_850hPa: [350], temperature_850hPa: [8], geopotential_height_850hPa: [1500],
    wind_speed_700hPa: [30], wind_direction_700hPa: [10], temperature_700hPa: [0], geopotential_height_700hPa: [3000],
    wind_speed_500hPa: [50], wind_direction_500hPa: [270], temperature_500hPa: [-20], geopotential_height_500hPa: [5600],
    wind_speed_1000hPa: [5], wind_direction_1000hPa: [90], temperature_1000hPa: [15], geopotential_height_1000hPa: [100],
  },
};

test("winds aloft parse skips levels under the ground and interpolates by vector", () => {
  const p = parseWindsAloft(body);
  near(p.elevationFt, 5249, 1);
  assert.deepEqual(p.hours[0].levels.map(l => l.hPa), [700, 500]); // 1000 and 850 hPa are underground
  const lo = { altFt: 1000, dir: 350, kt: 20, tempC: 8 };
  const hi = { altFt: 2000, dir: 10, kt: 20, tempC: 0 };
  const mid = windAt([lo, hi], 1500);
  assert.equal(mid.dir, 0, "350° and 010° average to north, not south");
  near(mid.kt, 19.7, 0.2);
  near(mid.tempC, 4, 0.01);
  assert.deepEqual(windAt([lo, hi], 500), { dir: 350, kt: 20, tempC: 8 });
  near(freezingLevel([lo, hi]), 2000, 1);
  assert.equal(freezingLevel([{ altFt: 0, tempC: 10 }, { altFt: 9000, tempC: 1 }]), null);
});

test("the FB table leaves out levels within 1,500 ft of the ground", () => {
  const hour = { levels: [{ altFt: 2000, dir: 200, kt: 10, tempC: 10 }, { altFt: 40000, dir: 270, kt: 100, tempC: -56 }] };
  const rows = fbRows(hour, 5000);
  assert.equal(rows[0].altFt, 9000);
  assert.ok(rows.every(r => r.altFt - 5000 >= 1500));
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

test("saved data is cleaned, study progress tracked, and flights go to PlanFox", () => {
  assert.equal(normalizeData(null).aircraft.tas, 120);
  const d = normalizeData({ aircraft: { tas: 9999, gph: "x" }, route: [{ id: "KDEN", lat: 39, lon: -104 }, { bad: 1 }], flights: [{ id: "f1", route: [{ id: "A", lat: 1, lon: 1 }, { id: "B", lat: 2, lon: 2 }], departAt: "2026-11-20T15:30:00.000Z", minutes: 75 }] });
  assert.equal(d.aircraft.tas, 600);
  assert.equal(d.route.length, 1);
  let study = recordAnswer({}, "par", "as1", true);
  study = recordAnswer(study, "par", "as2", false);
  assert.deepEqual(progressFor(study, "par", ["as1", "as2", "as3"]), { seen: 2, mastered: 1, missed: 1, total: 3 });
  const items = planItems(d, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1);
  assert.equal(items[0].href, "/fly?flight=f1");
  assert.equal(planItems(d, "2026-12-01", "2026-12-31").length, 0);
});

console.log(`FlyFox: ${passed} checks passed.`);
