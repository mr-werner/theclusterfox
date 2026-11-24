// TrailFox checks: node src/features/hike/tests/validate.mjs
import assert from "node:assert/strict";

import { bearing, cardinal, dist, isLoop, lineLength, locateOnLine, resample, simplifyTo, stitch, stitchToOne } from "../model/geo.js";
import { climb, difficulty, summarize, toblerKmh, tripProfile, walkMinutes } from "../model/profile.js";
import { bestStarts, clock, fromHhmm, hhmm, scoreStart, turnaround } from "../model/weather.js";
import { gearList } from "../model/gear.js";
import { parseGpx, toGpx } from "../model/gpx.js";
import { addFix, shouldKeep, trackStats } from "../model/track.js";
import { inUS, offlinePlan, tilesInBox } from "../model/tiles.js";
import { cleanTrail, normalizeData, upsertTrail } from "../state/hikeStore.js";
import { planItems, launchTargets } from "../model/planLink.js";
import { finishTrail, parseFeatures, parseHikeForecast, parseTrails, pickTrailhead } from "../api.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b} ± ${tol}, got ${a}`);

// A 2 km line due north from Boulder, CO.
const north = Array.from({ length: 21 }, (_, i) => [40 + (i * 0.1) / 111.2, -105.3]);

test("distance and bearing", () => {
  near(dist([40, -105], [41, -105]), 111195, 50);
  near(bearing([40, -105], [41, -105]), 0, 0.01);
  near(bearing([40, -105], [40, -104]), 89.7, 0.5);
  assert.equal(cardinal(225), "SW");
  assert.equal(cardinal(359), "N");
  near(lineLength(north), 2000, 5);
});

test("OSM pieces in any direction stitch into one line", () => {
  const a = north.slice(0, 8);
  const b = north.slice(7, 15).reverse();
  const c = north.slice(14);
  const lines = stitch([c, a, b]);
  assert.equal(lines.length, 1);
  near(lineLength(lines[0]), 2000, 5);
  // A far-away piece with the same name is left out.
  const far = [[45, -110], [45.01, -110]];
  near(lineLength(stitchToOne([a, b, c, far])), 2000, 5);
});

test("resampling, simplifying and locating on a line", () => {
  const r = resample(north, 5);
  assert.equal(r.length, 5);
  near(r[2].d, 1000, 3);
  near(dist(r[4].p, north[20]), 0, 0.5);
  assert.equal(simplifyTo(north, 10).length, 2); // a straight line needs two points
  const at = locateOnLine(north, [40 + 0.5 / 111.2, -105.3 + 0.1 / 85]);
  near(at.along, 500, 5);
  near(at.off, 100, 5);
  assert.equal(isLoop(north), false);
  const loop = [...north, ...north.slice().reverse().map(p => [p[0], p[1] + 0.001])];
  assert.equal(isLoop(loop), true);
});

test("climb ignores noise, out-and-back doubles", () => {
  const prof = [[0, 1000], [500, 1002], [1000, 1100], [1500, 1098], [2000, 1200]];
  const c = climb(prof);
  assert.equal(c.gain, 200);
  assert.equal(c.loss, 0);
  const trip = tripProfile(prof, "out-back");
  assert.equal(trip[trip.length - 1][0], 4000);
  assert.equal(trip[trip.length - 1][1], 1000);
  const s = summarize(prof, "out-back", 1);
  assert.equal(s.distanceM, 4000);
  assert.equal(s.gain, 200);
  near(s.loss, 200, 4);
});

test("Tobler time is sensible, pace scales it", () => {
  near(toblerKmh(0), 5.04, 0.01);
  assert.ok(toblerKmh(-0.05) > toblerKmh(0.1));
  const flat5k = [[0, 100], [5000, 100]];
  near(walkMinutes(flat5k), 65, 3); // 5 km at ~5 km/h plus breaks
  assert.ok(walkMinutes(flat5k, 1.2) < walkMinutes(flat5k, 1));
  const steep = [[0, 1000], [3000, 1900]];
  assert.ok(walkMinutes(steep) > walkMinutes([[0, 1000], [3000, 1000]]) * 1.8);
});

test("difficulty ratings", () => {
  assert.equal(difficulty(3200, 60).id, "easy");
  assert.equal(difficulty(16000, 1000).id, "very"); // 10 mi, 3,280 ft
  assert.equal(difficulty(8000, 300).id, "moderate");
  assert.equal(difficulty(2000, 50, "alpine_hiking").id, "strenuous");
});

// A synthetic day: clear morning, storms from 1 PM up high, sunset 5:30 PM.
const day = "2026-07-10";
const mk = (hour, o = {}) => ({ t: Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`) + 6 * 3600000, local: Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`), temp: 15, apparent: 15, precipProb: 5, precip: 0, code: 1, wind: 10, gust: 20, uv: 5, cape: 100, snowfall: 0, snowDepth: 0, freezing: 4000, ...o });
const base = Array.from({ length: 24 }, (_, i) => mk(i, { apparent: i > 11 && i < 17 ? 31 : 18 }));
const high = Array.from({ length: 24 }, (_, i) => mk(i, i >= 13 && i <= 16 ? { code: 95, precipProb: 70 } : {}));
const sun = { sunrise: 6 * 60, sunset: 17 * 60 + 30 };

test("start-time scoring prefers dry daylight, flags storms and dark", () => {
  const early = scoreStart({ base, high, sun, day, start: 7 * 60, minutes: 300 });
  const late = scoreStart({ base, high, sun, day, start: 11 * 60, minutes: 300 });
  assert.ok(early.score > late.score);
  assert.ok(late.notes.some(n => /Thunderstorms/.test(n.text)));
  const dark = scoreStart({ base, high, sun, day, start: 14 * 60, minutes: 300 });
  assert.ok(dark.notes.some(n => /after sunset/.test(n.text)));
  const { options } = bestStarts({ base, high, sun, day, minutes: 300, exposed: true });
  assert.ok(options[0].start <= 8 * 60, `best start ${clock(options[0].start)}`);
  assert.ok(options.every((o, i) => options.every((p, j) => i === j || Math.abs(o.start - p.start) >= 90)));
});

test("turnaround keeps an out-and-back in daylight and before storms", () => {
  const t = turnaround({ start: 8 * 60, minutes: 360, shape: "out-back", sun, storm: null });
  assert.equal(t, 8 * 60 + 180 + 90 > 17 * 60 - 180 ? 17 * 60 - 180 : 8 * 60 + 180 + 90);
  const storm = turnaround({ start: 8 * 60, minutes: 360, shape: "out-back", sun, storm: high[13] });
  assert.ok(storm < t);
  assert.equal(turnaround({ start: 480, minutes: 300, shape: "loop", sun }), null);
  assert.equal(clock(0), "12:00 AM");
  assert.equal(clock(13 * 60 + 5), "1:05 PM");
  assert.equal(hhmm(fromHhmm("06:45")), "06:45");
});

test("gear list sizes water and adds what the weather needs", () => {
  const trip = { minutes: 360, distanceM: 16000, gain: 900, maxEle: 3500, startMin: 360, sun };
  const worst = scoreStart({ base, high, sun, day, start: 11 * 60, minutes: 360 }).worst;
  const g = gearList(trip, { ...worst, maxApparent: 31 });
  const ids = g.map(i => i.id);
  for (const id of ["water", "food", "nav", "light", "first-aid", "shell", "poles", "altitude", "trip-plan", "salt"]) assert.ok(ids.includes(id), `missing ${id}`);
  assert.ok(/[4-6](\.5)? L/.test(g.find(i => i.id === "water").name));
  const snowy = gearList({ ...trip, minutes: 120 }, { snowDepth: 0.2, snow: 0, rain: 0, cold: { apparent: -12 }, gust: 0, uv: 2, freezing: 1000, maxApparent: -5 });
  assert.ok(snowy.some(i => i.id === "traction") && snowy.some(i => i.id === "puffy"));
  assert.ok(!gearList({ ...trip, minutes: 60, gain: 50 }, null).some(i => i.id === "poles"));
});

test("GPX in and out", () => {
  const xml = `<?xml version="1.0"?><gpx version="1.1"><metadata><name>Royal Arch &amp; Back</name></metadata>
  <wpt lat="39.99" lon="-105.29"><name>Arch</name></wpt>
  <trk><name>ignored</name><trkseg>
  <trkpt lat="40.0" lon="-105.3"><ele>1700</ele><time>2026-07-10T14:00:00Z</time></trkpt>
  <trkpt lat="40.001" lon="-105.3"><ele>1710</ele></trkpt>
  <trkpt lat='40.002' lon='-105.301'/>
  </trkseg></trk></gpx>`;
  const g = parseGpx(xml);
  assert.equal(g.name, "Royal Arch & Back");
  assert.equal(g.line.length, 3);
  assert.equal(g.line[0][2], 1700);
  assert.equal(g.waypoints[0].name, "Arch");
  assert.throws(() => parseGpx("<kml/>"));
  const out = toGpx({ name: "A <b>", points: [[40, -105, 1700, 1783000000], [40.001, -105, null, 1783000060]] });
  assert.ok(out.includes("A &lt;b&gt;"));
  assert.equal(parseGpx(out).line.length, 2);
});

test("tracking keeps only accurate fixes that moved", () => {
  let pts = [];
  pts = addFix(pts, { lat: 40, lon: -105, alt: 1700, accuracy: 10, time: 1000 });
  assert.equal(pts.length, 1);
  pts = addFix(pts, { lat: 40.00002, lon: -105, alt: 1700, accuracy: 10, time: 1010 }); // 2 m
  assert.equal(pts.length, 1);
  pts = addFix(pts, { lat: 40.001, lon: -105, alt: 1700, accuracy: 120, time: 1020 }); // inaccurate
  assert.equal(pts.length, 1);
  pts = addFix(pts, { lat: 40.001, lon: -105, alt: 1712, accuracy: 8, time: 1060 });
  pts = addFix(pts, { lat: 40.002, lon: -105, alt: 1730, accuracy: 8, time: 1120 });
  assert.equal(pts.length, 3);
  assert.equal(shouldKeep(null, { lat: 40, lon: -105, accuracy: 200, time: 0 }), false);
  const st = trackStats(pts);
  near(st.distance, 222, 2);
  assert.equal(st.gain, 30);
  assert.equal(st.moving, 120);
});

test("offline tiles respect each map's limits", () => {
  assert.equal(inUS(40, -105.3), true);
  assert.equal(inUS(46.5, 8), false);
  const box = [39.98, -105.32, 40.02, -105.27];
  assert.ok(tilesInBox(box, 14).length >= 4);
  const usgs = offlinePlan(box, "usgs");
  assert.ok(usgs.tiles.length <= 2400 && usgs.maxZoom === 16);
  const otm = offlinePlan(box, "otm");
  const high = otm.tiles.filter(t => t.z >= 13).length;
  assert.ok(high <= 250, `${high} high-zoom tiles`);
  assert.ok(otm.tiles[0].url.startsWith("https://tile.opentopomap.org/10/"));
});

const osmBody = {
  elements: [
    { type: "relation", id: 77, tags: { route: "hiking", name: "Mesa Trail", distance: "10.5", network: "lwn" }, center: { lat: 39.95, lon: -105.28 } },
    { type: "way", id: 1, tags: { highway: "path", name: "Royal Arch Trail", sac_scale: "mountain_hiking" }, geometry: north.slice(0, 11).map(([lat, lon]) => ({ lat, lon })) },
    { type: "way", id: 2, tags: { highway: "path", name: "Royal Arch Trail" }, geometry: north.slice(10).map(([lat, lon]) => ({ lat, lon })) },
    { type: "way", id: 3, tags: { highway: "footway", name: "Main Street" }, geometry: north.map(([lat, lon]) => ({ lat, lon: lon + 0.01 })) },
    { type: "way", id: 4, tags: { highway: "path", name: "Mesa Trail" }, geometry: north.map(([lat, lon]) => ({ lat, lon: lon + 0.02 })) },
    { type: "way", id: 5, tags: { highway: "path", name: "Tiny Spur" }, geometry: north.slice(0, 2).map(([lat, lon]) => ({ lat, lon })) },
  ],
};

test("Overpass trails: routes first, named paths joined, sidewalks and spurs dropped", () => {
  const list = parseTrails(osmBody, { lat: 40, lon: -105.3 });
  assert.deepEqual(list.map(t => t.name), ["Mesa Trail", "Royal Arch Trail"]);
  assert.equal(list[0].lengthM, 10500);
  near(list[1].lengthM, 2000, 5);
  assert.equal(list[1].ref, "way/1,2");
  assert.equal(list[1].sac, "mountain_hiking");
});

test("features along a trail and the trailhead", () => {
  const body = {
    elements: [
      { type: "node", id: 1, lat: north[20][0], lon: north[20][1] + 0.001, tags: { natural: "peak", name: "Green Mtn", ele: "2484" } },
      { type: "node", id: 2, lat: north[0][0] - 0.001, lon: north[0][1], tags: { amenity: "parking", name: "Chautauqua" } },
      { type: "node", id: 3, lat: 40.5, lon: -105.3, tags: { tourism: "viewpoint" } }, // far away
      { type: "node", id: 4, lat: north[5][0], lon: north[5][1], tags: { amenity: "parking", access: "private" } },
    ],
  };
  const pois = parseFeatures(body, north);
  assert.deepEqual(pois.map(p => p.kind), ["parking", "peak"]);
  assert.equal(pois[1].ele, 2484);
  near(pois[1].d, 2000, 5);
  const th = pickTrailhead(north, pois);
  assert.equal(th.name, "Chautauqua");
});

test("a trail is turned around to start at its trailhead", () => {
  const rev = north.slice().reverse();
  const profile = [[0, 2400], [2000, 1800]];
  const t = finishTrail({ id: "x", name: "X", line: rev, profile, pois: [], trailhead: { name: "P", lat: north[0][0], lon: north[0][1] } });
  near(dist(t.line[0], north[0]), 0, 1);
  assert.equal(t.profile[0][1], 1800);
  assert.equal(t.shape, "out-back");
});

test("forecast parsing gives local hours and sun times", () => {
  const f = parseHikeForecast({
    utc_offset_seconds: -21600,
    hourly: { time: [1783684800], temperature_2m: [12], apparent_temperature: [10], precipitation_probability: [40], weather_code: [95], wind_gusts_10m: [30] },
    daily: { time: [1783663200], sunrise: [1783684800], sunset: [1783738800] },
  });
  assert.equal(f.hours[0].code, 95);
  assert.equal(new Date(f.hours[0].local).getUTCHours(), 6);
  assert.equal(f.days[0].sunrise, 360);
  assert.equal(f.days[0].day, "2026-07-10");
});

test("saved data is cleaned, recent views capped, saved trails kept", () => {
  assert.deepEqual(normalizeData(null).trails, []);
  assert.equal(cleanTrail({ id: "a", line: [[1, 2]] }), null);
  const mkTrail = (i, extra = {}) => ({ id: `t${i}`, name: `T${i}`, line: north, profile: [[0, 1], [10, 2]], viewedAt: new Date(2026, 0, i + 1).toISOString(), ...extra });
  let trails = [];
  for (let i = 0; i < 20; i++) trails = upsertTrail(trails, mkTrail(i, i === 0 ? { saved: true } : {}));
  assert.equal(trails.length, 13);
  assert.ok(trails.some(t => t.id === "t0"));
  const d = normalizeData({ units: "metric", pace: 7, trails: [mkTrail(1, { plan: { day: "2026-07-10", start: "06:30" }, shape: "nope" })], active: { id: "h", points: [[40, -105, null, 5], ["x"]] } });
  assert.equal(d.units, "metric");
  assert.equal(d.pace, 1);
  assert.equal(d.trails[0].shape, "out-back");
  assert.equal(d.active.points.length, 1);
});

test("planned hikes show up in TaskFox", () => {
  const raw = { trails: [{ id: "osm-r77", name: "Mesa Trail", line: north, profile: [[0, 1700], [2000, 1900]], plan: { day: "2026-07-10", start: "06:30" } }] };
  const items = planItems(raw, "2026-07-01", "2026-07-31");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Hike Mesa Trail");
  assert.equal(items[0].time, "06:30");
  assert.equal(items[0].href, "/hike?trail=osm-r77");
  assert.ok(/2\.5 mi/.test(items[0].detail));
  assert.equal(planItems(raw, "2026-08-01", "2026-08-31").length, 0);
  assert.equal(planItems(null, "2026-07-01", "2026-07-31").length, 0);
  assert.ok(launchTargets(raw).some(t => t.href === "/hike?trail=osm-r77"));
});

console.log(`TrailFox: ${passed} checks passed.`);
