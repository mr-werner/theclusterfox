// SnowFox checks: node src/features/snow/tests/validate.mjs
import assert from "node:assert/strict";

import { RESORTS } from "../data/resorts.js";
import { BACKCOUNTRY } from "../data/backcountry.js";
import { ROAD_SITES } from "../data/roads.js";
import { crowdOutlook, dailyFrom, fmtSnow, liftFraction, fmtTemp, inGeometry, REGIONS, roadWeather, samplePath, scoreDay, skiHolidays, snowTotals, windHold, worstRoad } from "../model/snow.js";
import { normalizeData } from "../state/snowStore.js";
import { launchTargets, planItems } from "../model/planLink.js";
import { parseTrailMap } from "../api.js";
import { parseLiftie, parseSnotelData, parseStations, summarizeSnotel } from "../../../../api/plan/_snow.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("every ski area and backcountry spot is complete and sensible", () => {
  const ids = new Set();
  for (const r of [...RESORTS, ...BACKCOUNTRY]) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.ok(r.lat > 30 && r.lat < 65 && r.lon < -60 && r.lon > -160, `${r.id} position`);
    assert.ok(REGIONS.some(g => g.states.includes(r.state)), `${r.id} region for ${r.state}`);
  }
  for (const r of RESORTS) {
    assert.ok(r.summit > r.base && r.summit - r.base < 6000, `${r.id} elevations`);
    assert.ok(/^https?:\/\//.test(r.status), `${r.id} status page`);
  }
  for (const b of BACKCOUNTRY) assert.ok(b.elev > 500 && b.note, `${b.id}`);
  for (const st of new Set(RESORTS.map(r => r.state))) assert.ok(ROAD_SITES[st] || ["MI"].includes(st), `road site for ${st}`);
  assert.ok(RESORTS.length > 140);
});

test("units", () => {
  assert.equal(fmtSnow(25.4), "10″");
  assert.equal(fmtSnow(2.54 * 1.5), "1.5″");
  assert.equal(fmtSnow(0), "0″");
  assert.equal(fmtSnow(30, "metric"), "30 cm");
  assert.equal(fmtTemp(-10), "14°F");
});

const H = 3600000;
const now = Date.UTC(2026, 11, 10, 18); // 11 AM in a UTC-7 resort
const mkHours = (snowAt, extra = {}) =>
  Array.from({ length: 24 * 6 }, (_, i) => {
    const time = new Date(now - 72 * H + i * H);
    const local = new Date(time.getTime() - 7 * H);
    return { time, localDay: local.toISOString().slice(0, 10), localHour: local.getUTCHours(), temp: -6, feels: -12, wind: 5, gust: 9, code: 3, snow: snowAt(i, local) ? 1 : 0, rain: 0, cloud: 60, vis: 20000, freeze: 2500, ...extra };
  });

test("snow totals look back and ahead from now", () => {
  const hours = mkHours(i => i < 72);
  const t = snowTotals(hours, now);
  assert.equal(t.past24, 24);
  assert.equal(t.past72, 72);
  assert.equal(t.next24, 0);
});

test("days split overnight snow from snow while lifts run", () => {
  // Snow from 10 PM to 6 AM local
  const hours = mkHours((i, local) => local.getUTCHours() >= 22 || local.getUTCHours() < 6);
  const days = dailyFrom(hours);
  const full = days.find(d => d.hours === 24 && d.overnight > 0);
  assert.equal(full.overnight, 8);
  assert.equal(full.openSnow, 0);
});

test("a powder day scores as one; wind and rain take it down", () => {
  const pow = scoreDay({ overnight: 30, openSnow: 0, gust: 8, feels: -8, temp: -6, rain: 0, vis: 5000, cloud: 80 });
  assert.equal(pow.label, "Powder day");
  const windy = scoreDay({ overnight: 0, openSnow: 0, gust: 25, feels: -20, temp: -10, rain: 0, vis: 5000, cloud: 80 });
  assert.equal(windy.label, "Tough");
  const rain = scoreDay({ overnight: 0, openSnow: 0, gust: 5, feels: 2, temp: 3, rain: 0, vis: 9000, cloud: 90 }, { rain: 4, temp: 6 });
  assert.ok(rain.score < 45);
  assert.equal(windHold(23).level, "likely");
  assert.equal(windHold(18).level, "possible");
  assert.equal(windHold(8).level, "unlikely");
});

test("holidays and crowds", () => {
  const h = skiHolidays(2027);
  assert.equal(h.get("2027-01-18"), "MLK Day");
  assert.equal(h.get("2027-02-15"), "Presidents' Day");
  assert.equal(skiHolidays(2026).get("2026-11-26"), "Thanksgiving");
  assert.equal(crowdOutlook("2027-01-12").label, "Quiet"); // a Tuesday
  assert.equal(crowdOutlook("2027-01-16", 20).label, "Very busy"); // MLK Saturday, powder
  assert.equal(crowdOutlook("2027-01-09").label, "Moderate"); // Saturday
});

test("points in avalanche zones", () => {
  const square = { type: "MultiPolygon", coordinates: [[[[-106, 39], [-105, 39], [-105, 40], [-106, 40], [-106, 39]]]] };
  assert.equal(inGeometry(39.5, -105.5, square), true);
  assert.equal(inGeometry(41, -105.5, square), false);
});

test("sampling a drive and judging road weather", () => {
  const pts = samplePath([[-105, 39.7], [-105.5, 39.7], [-106, 39.7]], 5);
  assert.equal(pts.length, 5);
  assert.ok(Math.abs(pts[2].lon + 105.5) < 0.01);
  assert.equal(roadWeather([{ temp: -3, snow: 1.2, rain: 0 }]).level, "snow");
  assert.equal(roadWeather([{ temp: 0, snow: 0, rain: 1 }]).level, "icy");
  assert.equal(roadWeather([{ temp: 8, snow: 0, rain: 0 }]).level, "ok");
  assert.equal(worstRoad([{ level: "wet", text: "Rain" }, { level: "snow", text: "Light snow" }]).level, "snow");
});

test("saved data is cleaned and ski days reach TaskFox", () => {
  const d = normalizeData({ favorites: ["vail", "vail", 3], units: "metric", trips: [{ id: "t1", spot: "alta", day: "2026-12-12", time: "08:30" }, { id: "bad", spot: "x", day: "soon" }], custom: [{ id: "place-1", name: "Mt X", lat: 40, lon: -110 }] });
  assert.deepEqual(d.favorites, ["vail"]);
  assert.equal(d.trips.length, 1);
  assert.equal(d.custom[0].summit, 8000);
  const items = planItems({ trips: [{ id: "t1", spot: "alta", day: "2026-12-12", time: "08:30" }, { id: "t2", spot: "teton-pass", day: "2026-12-13" }] }, "2026-12-01", "2026-12-31");
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Ski Alta");
  assert.equal(items[0].href, "/snow?spot=alta&day=2026-12-12");
  assert.equal(items[1].title, "Tour Teton Pass");
  assert.equal(planItems(null, "2026-12-01", "2026-12-31").length, 0);
  assert.ok(launchTargets({ favorites: ["vail"] }).some(t => t.href === "/snow?spot=vail"));
});

test("trail map from OpenStreetMap", () => {
  const map = parseTrailMap({
    elements: [
      { type: "way", id: 1, tags: { "piste:type": "downhill", "piste:difficulty": "intermediate", name: "Ramshorn" }, geometry: [{ lat: 39.6, lon: -106.3 }, { lat: 39.61, lon: -106.31 }] },
      { type: "way", id: 2, tags: { aerialway: "chair_lift", name: "Chair 4", "aerialway:occupancy": "6" }, geometry: [{ lat: 39.6, lon: -106.3 }, { lat: 39.62, lon: -106.32 }] },
      { type: "way", id: 3, tags: { aerialway: "zip_line" }, geometry: [{ lat: 39.6, lon: -106.3 }, { lat: 39.62, lon: -106.32 }] },
    ],
  });
  assert.equal(map.runs[0].diff, "intermediate");
  assert.equal(map.lifts.length, 1);
  assert.equal(map.lifts[0].seats, 6);
});

test("lift status and SNOTEL parsing", () => {
  const l = parseLiftie({ lifts: { status: { "Gondola One": "open", "Chair 2": "hold", "Chair 3": "closed", Odd: "weird" } } });
  assert.equal(l.open, 1);
  assert.equal(l.hold, 1);
  assert.equal(l.closed, 2);
  assert.equal(parseLiftie({}), null);
  assert.deepEqual(liftFraction(l), { open: 1, total: 4 });
  assert.equal(liftFraction({ lifts: [], open: 0 }), null);
  assert.equal(liftFraction(null), null);
  const st = parseStations([{ stationTriplet: "842:CO:SNTL", name: "Vail Mountain", latitude: 39.62, longitude: -106.38, elevation: 10300, endDate: "2100-01-01 00:00" }, { stationTriplet: "1:CO:SNTL", latitude: 1, longitude: 1, endDate: "2010-01-01" }]);
  assert.equal(st.length, 1);
  const data = parseSnotelData([{ stationTriplet: "842:CO:SNTL", data: [{ stationElement: { elementCode: "SNWD" }, values: [{ date: "2026-12-07", value: 20 }, { date: "2026-12-08", value: 22 }, { date: "2026-12-09", value: 23 }, { date: "2026-12-10", value: 30 }] }, { stationElement: { elementCode: "WTEQ" }, values: [{ date: "2026-12-10", value: 5.1 }] }] }]);
  const sum = summarizeSnotel(data["842:CO:SNTL"]);
  assert.equal(sum.depthIn, 30);
  assert.equal(sum.depth24, 7);
  assert.equal(sum.depth72, 10);
  assert.equal(sum.sweIn, 5.1);
});

console.log(`SnowFox: ${passed} checks passed`);
