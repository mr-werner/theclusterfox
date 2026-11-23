// RoadTripFox checks: node src/features/road/tests/validate.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bounds, cumulative, locate, miles, pointAt, sampleEvery, shrink, stateAt, statesAlong } from "../model/geo.js";
import { minutesAt, parseOsrm, pickStops, placeAlong, placesFromOsm, splitDays, stopCount } from "../model/route.js";
import { fuelCost, legRange, parseNrelStation, planStops, stationsFromOsm, stopTargets } from "../model/fuel.js";
import { classify, overpassAlong, THEMES } from "../data/themes.js";
import { gasAreasFor, priceForState, STATES } from "../data/states.js";
import { bingoCard, bingoLines, BINGO_ITEMS, triviaQuestion, seeded } from "../data/games.js";
import { addDays, emptyData, normalizeData } from "../state/roadStore.js";
import { planItems, launchTargets } from "../model/planLink.js";
import { parseEia } from "../../../../api/road/[route].js";
import { dateRange, feel, packingList, parseForecastDays, scheduleStays, shiftYears, summarize, tripLength, typicalDays, weatherSource } from "../model/packing.js";
import { cleanPack } from "../state/roadStore.js";

const shapes = JSON.parse(readFileSync(new URL("../data/stateShapes.json", import.meta.url), "utf8"));

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

const DEN = { lat: 39.7392, lon: -104.9903 };
const SLC = { lat: 40.7608, lon: -111.891 };
// A straight-ish line Denver -> Salt Lake City through Wyoming.
const line = [DEN, { lat: 41.14, lon: -104.82 }, { lat: 41.31, lon: -105.59 }, { lat: 41.59, lon: -109.22 }, { lat: 41.26, lon: -110.96 }, SLC];
const cum = cumulative(line);
const total = cum[cum.length - 1];
const route = { points: line, miles: total, minutes: (total / 62) * 60, legs: [{ miles: total, minutes: (total / 62) * 60 }] };

test("distances in miles", () => {
  near(miles(DEN, SLC), 371, 4, "DEN-SLC as the crow flies");
  near(total, 520, 40, "the line through Wyoming");
  near(miles(pointAt(line, cum, 0), DEN), 0, 0.001);
  near(miles(pointAt(line, cum, total), SLC), 0, 0.001);
  const s = sampleEvery(line, cum, 50);
  assert.equal(s[0].mile, 0);
  near(s[s.length - 1].mile, total, 0.001);
  assert.ok(s.length >= 11);
});

test("placing a point along the route", () => {
  const samples = sampleEvery(line, cum, 2);
  const laramie = { lat: 41.3114, lon: -105.5911 };
  const at = locate(samples, laramie);
  near(at.mile, cum[2], 3, "Laramie's mile");
  assert.ok(at.off < 1);
  const boulder = locate(samples, { lat: 40.015, lon: -105.27 });
  assert.ok(boulder.off > 10 && boulder.off < 25, `Boulder is off the line (${boulder.off})`);
});

test("simplifying keeps the ends and shape", () => {
  const dense = sampleEvery(line, cum, 1);
  const small = shrink(dense, 30);
  assert.ok(small.length <= 30);
  assert.deepEqual([small[0].lat, small[small.length - 1].lat], [dense[0].lat, dense[dense.length - 1].lat]);
  const b = bounds(line);
  assert.ok(b.n > 41.5 && b.w < -111);
});

test("state outlines", () => {
  assert.equal(Object.keys(shapes).length, 51);
  assert.equal(stateAt(shapes, DEN), "CO");
  assert.equal(stateAt(shapes, SLC), "UT");
  assert.equal(stateAt(shapes, { lat: 41.14, lon: -104.82 }), "WY", "Cheyenne");
  assert.equal(stateAt(shapes, { lat: 30.27, lon: -97.74 }), "TX", "Austin");
  assert.equal(stateAt(shapes, { lat: 19.7, lon: -155.5 }), "HI", "Big Island");
  assert.equal(stateAt(shapes, { lat: 48.85, lon: 2.35 }), null, "Paris");
  assert.deepEqual(statesAlong(shapes, line, cum).map(s => s.code), ["CO", "WY", "UT"]);
});

test("OSRM answers", () => {
  const body = { code: "Ok", routes: [{ distance: 160934.4, duration: 5400, geometry: { coordinates: [[-105, 39.7], [-105, 40.7]] }, legs: [{ distance: 80467.2, duration: 2700 }, { distance: 80467.2, duration: 2700 }] }] };
  const [r] = parseOsrm(body);
  near(r.miles, 100, 0.01);
  near(r.minutes, 90, 0.01);
  assert.equal(r.legs.length, 2);
  assert.deepEqual(r.points[0], { lat: 39.7, lon: -105 });
  assert.deepEqual(parseOsrm({ code: "NoRoute" }), []);
  near(minutesAt(r, 50), 45, 0.01);
  near(minutesAt(r, 75), 67.5, 0.01);
});

test("what counts as a stop", () => {
  assert.equal(classify({ name: "Yellowstone", boundary: "national_park" }).label, "National park");
  assert.equal(classify({ name: "Falls", natural: "waterfall", wikidata: "Q1" }).score, 7 + 3);
  assert.equal(classify({ name: "Joe's", amenity: "restaurant", cuisine: "barbecue" }).theme, "food");
  assert.equal(classify({ name: "McDonald's", amenity: "fast_food", brand: "McDonald's" }), null, "chains aren't stops");
  assert.equal(classify({ name: "Fort Laramie", historic: "fort" }).theme, "history");
  assert.equal(classify({ natural: "waterfall" }), null, "unnamed");
  assert.equal(classify({ name: "Private Falls", natural: "waterfall", access: "private" }), null);
  const q = overpassAlong(sampleEvery(line, cum, 50));
  assert.ok(q.startsWith("[out:json]"));
  assert.equal((q.match(/out center tags/g) || []).length, 4, "one output per theme");
  assert.equal((q.match(/\(/g) || []).length, (q.match(/\)/g) || []).length, "balanced");
  assert.equal(THEMES[0].id, "fastest");
});

test("themed stops spread along the route", () => {
  const osm = {
    elements: [
      { type: "node", id: 1, lat: 41.3, lon: -105.5, tags: { name: "Vedauwoo Overlook", tourism: "viewpoint" } },
      { type: "node", id: 2, lat: 41.32, lon: -105.6, tags: { name: "Big Falls", natural: "waterfall", wikidata: "Q2", wikipedia: "en:Big Falls" } },
      { type: "way", id: 3, center: { lat: 41.58, lon: -109.2 }, tags: { name: "Flaming Gorge", boundary: "protected_area", protect_class: "2", wikidata: "Q3" } },
      { type: "node", id: 4, lat: 41.27, lon: -110.9, tags: { name: "Hot Pot", natural: "hot_spring" } },
      { type: "node", id: 5, lat: 41.27, lon: -110.9, tags: { name: "Hot Pot", natural: "hot_spring" } },
      { type: "node", id: 6, lat: 35, lon: -90, tags: { name: "Far Away Falls", natural: "waterfall" } },
      { type: "node", id: 7, lat: 41.15, lon: -104.83, tags: { name: "Cheyenne Diner", amenity: "restaurant", cuisine: "diner" } },
    ],
  };
  const places = placesFromOsm(osm);
  assert.equal(places.length, 6, "the duplicate is dropped");
  assert.equal(places.find(p => p.name === "Big Falls").wiki, "https://en.wikipedia.org/wiki/Big_Falls");
  const placed = placeAlong(places, route, 20);
  assert.ok(!placed.some(p => p.name === "Far Away Falls"), "too far off the route");
  const stops = pickStops(placed, "scenic", total, 3);
  assert.ok(stops.length >= 2 && stops.length <= 3);
  assert.equal(stops[0].name, "Big Falls", "the better place in the same stretch wins");
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].mile > stops[i - 1].mile, "in order");
  assert.deepEqual(pickStops(placed, "food", total, 2).map(s => s.name), ["Cheyenne Diner"], "one stretch has no food stop");
  assert.deepEqual(pickStops(placed.map(p => ({ ...p, mile: 3 })), "food", total, 2), [], "nothing in the first few miles");
  assert.equal(stopCount(40), 1);
  assert.equal(stopCount(500), 3);
  assert.equal(stopCount(3000), 6);
});

test("splitting the drive into days", () => {
  const one = splitDays(route, [], 12);
  assert.equal(one.length, 1);
  assert.equal(one[0].end, null);
  const days = splitDays(route, [{ id: "a", mile: 100, minutes: 60 }, { id: "b", mile: 400, minutes: 30 }], 4);
  assert.ok(days.length === 3 || days.length === 2, `${days.length} days`);
  assert.ok(days.every(d => d.driveMinutes <= 4 * 60 + 21));
  assert.equal(days.flatMap(d => d.stops).length, 2, "every stop lands on a day");
  assert.equal(days[0].stops[0].id, "a");
  assert.equal(days[0].stopMinutes, 60);
  assert.ok(days[0].end && Number.isFinite(days[0].end.lat));
  assert.equal(days[days.length - 1].toMile, Math.round(total));
  assert.equal(days[days.length - 1].end, null);
});

test("fuel and charging stops", () => {
  const car = { kind: "gas", mpg: 25, tankGal: 16 };
  const r = legRange(car);
  assert.equal(r.next, 300);
  assert.deepEqual(stopTargets(1000, r), [300, 600, 900]);
  assert.deepEqual(stopTargets(250, r), []);
  const ev = legRange({ kind: "ev", rangeMi: 300 });
  near(ev.first, 225, 0.01);
  near(ev.next, 195, 0.01);
  const stations = [
    { id: "a", mile: 250, off: 0.2 },
    { id: "b", mile: 290, off: 2.5 },
    { id: "c", mile: 295, off: 0.1 },
    { id: "d", mile: 310, off: 0 },
    { id: "e", mile: 560, off: 0.3 },
  ];
  const plan = planStops(1000, r, stations);
  assert.equal(plan[0].station.id, "c", "nearest the target, not past it, close to the road");
  assert.equal(plan[1].station.id, "e", "counts from the last stop");
  assert.equal(plan[2].station, null, "nothing near the third");
  assert.ok(plan.length >= 3);
});

test("gas prices by state", () => {
  assert.deepEqual(gasAreasFor("CO"), ["SCO", "R40", "NUS"]);
  assert.deepEqual(gasAreasFor("NV"), ["R5XCA", "R50", "NUS"]);
  assert.deepEqual(gasAreasFor("ZZ"), ["NUS"]);
  const prices = { SCO: 3.75, R40: 3.95, NUS: 4.0 };
  assert.equal(priceForState("CO", prices), 3.75);
  assert.equal(priceForState("UT", prices), 3.95);
  assert.equal(priceForState("GA", prices), 4.0);
  assert.equal(STATES.length, 51);
  const c = fuelCost(line, { mpg: 25 }, prices, shapes);
  near(c.gallons, total / 25, 0.01);
  assert.ok(c.cost > (total / 25) * 3.75 && c.cost < (total / 25) * 3.95);
  assert.deepEqual(c.byState.map(s => s.code), ["CO", "WY", "UT"]);
  assert.equal(fuelCost(line, { mpg: 25 }, null, shapes).cost, null);
  const eia = parseEia([
    { period: "2026-11-09", duoarea: "SCO", product: "EPMR", value: "3.746" },
    { period: "2026-11-02", duoarea: "SCO", product: "EPMR", value: "3.9" },
    { period: "2026-11-09", duoarea: "NUS", product: "EPD2D", value: 6.127 },
    { period: "2026-11-09", duoarea: "NUS", product: "EPMP", value: 5 },
  ]);
  assert.deepEqual(eia, { week: "2026-11-09", gas: { SCO: 3.746 }, diesel: { NUS: 6.127 } });
});

test("stations from NREL and OpenStreetMap", () => {
  const s = parseNrelStation({ id: 9, station_name: "Fast Stop", latitude: 41, longitude: -105, ev_network: "Electrify_America", ev_dc_fast_num: 4, ev_connector_types: ["J1772COMBO", "CHADEMO"], city: "Laramie", state: "WY" });
  assert.equal(s.network, "Electrify America");
  assert.deepEqual(s.plugs, ["CCS", "CHAdeMO"]);
  assert.equal(parseNrelStation({}), null);
  const list = stationsFromOsm({
    elements: [
      { type: "node", id: 1, lat: 41, lon: -105, tags: { amenity: "fuel", brand: "Shell", "fuel:diesel": "yes", opening_hours: "24/7" } },
      { type: "node", id: 2, lat: 41, lon: -105, tags: { amenity: "charging_station", network: "Tesla", "socket:tesla_supercharger": "8" } },
      { type: "node", id: 3, lat: 41.3, lon: -105.6, tags: { place: "town", name: "Laramie", population: "32000" } },
    ],
  });
  assert.deepEqual(list.map(x => x.kind), ["fuel", "ev", "town"]);
  assert.ok(list[0].diesel && list[0].open24);
  assert.deepEqual(list[1].plugs, ["NACS"]);
  assert.equal(list[1].fast, 1);
  assert.equal(list[2].pop, 32000);
});

test("car games", () => {
  const card = bingoCard(42);
  assert.equal(card.length, 25);
  assert.equal(card[12], "FREE");
  assert.equal(new Set(card).size, 25, "no repeats");
  assert.deepEqual(bingoCard(42), card, "same seed, same card");
  assert.notDeepEqual(bingoCard(43), card);
  assert.ok(BINGO_ITEMS.length >= 40);
  assert.equal(bingoLines([]).length, 0);
  assert.equal(bingoLines([10, 11, 13, 14]).length, 1, "the middle row with the free square");
  assert.equal(bingoLines([0, 6, 18, 24]).length, 1, "a diagonal");
  const rand = seeded(7);
  for (let i = 0; i < 50; i++) {
    const q = triviaQuestion(rand, ["CO", "WY", "UT"]);
    assert.equal(q.choices.length, 4);
    assert.ok(q.choices.includes(q.answer));
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(["CO", "WY", "UT"].includes(q.code));
  }
});

test("saved data and PlanFox", () => {
  assert.deepEqual(normalizeData(null), emptyData());
  assert.deepEqual(normalizeData("junk"), emptyData());
  const raw = {
    from: { id: "1", name: "Denver", lat: DEN.lat, lon: DEN.lon },
    to: { id: "2", name: "Salt Lake City", lat: SLC.lat, lon: SLC.lon },
    hoursPerDay: 99,
    vehicle: { kind: "ev", rangeMi: 9999, plug: "nacs" },
    trips: [
      {
        id: "t1",
        title: "Denver to Salt Lake City",
        from: { name: "Denver", lat: DEN.lat, lon: DEN.lon },
        to: { name: "Salt Lake City", lat: SLC.lat, lon: SLC.lon },
        departDate: "2026-11-20",
        miles: 520,
        minutes: 470,
        line: line.map(p => [p.lat, p.lon]),
        stops: [{ id: "s", name: "Big Falls", lat: 41.3, lon: -105.6, mile: 130, wiki: "javascript:alert(1)" }],
        days: [{ driveMinutes: 240, stopNames: ["Big Falls"], endName: "Rock Springs" }, { driveMinutes: 230, stopNames: [] }],
      },
      { id: "bad", from: null },
    ],
    games: { plates: { CO: true, zz: true }, bingo: { seed: 5, marks: [1, 99] } },
  };
  const d = normalizeData(raw);
  assert.equal(d.hoursPerDay, 14);
  assert.equal(d.vehicle.rangeMi, 700);
  assert.equal(d.vehicle.plug, "nacs");
  assert.equal(d.trips.length, 1);
  assert.equal(d.trips[0].stops[0].wiki, null, "only https links");
  assert.deepEqual(d.games.plates, { CO: true });
  assert.deepEqual(d.games.bingo.marks, [1]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  const items = planItems(raw, "2026-11-01", "2026-11-30");
  assert.equal(items.length, 2, "one item per driving day");
  assert.deepEqual(items.map(i => i.day), ["2026-11-20", "2026-11-21"]);
  assert.equal(items[0].title, "Road trip day 1: to Rock Springs");
  assert.equal(items[1].title, "Road trip day 2: to Salt Lake City");
  assert.equal(items[0].href, "/roadtrip?trip=t1&day=1");
  assert.ok(items[0].detail.includes("Big Falls"));
  assert.equal(planItems(raw, "2026-12-01", "2026-12-31").length, 0);
  assert.equal(planItems(null, "2026-11-01", "2026-11-30").length, 0);
  assert.ok(launchTargets(raw).some(t => t.href === "/roadtrip?trip=t1"));
});

test("stays chain one after another and pick forecast or typical weather", () => {
  const stays = scheduleStays([{ id: "end", place: DEN, nights: 3 }, { id: "b", place: SLC, nights: 2 }], "2026-12-30");
  assert.equal(stays[0].arrive, "2026-12-30");
  assert.equal(stays[0].leave, "2027-01-02");
  assert.equal(stays[1].arrive, "2027-01-02");
  assert.equal(stays[1].dates.length, 3);
  assert.deepEqual(dateRange("2026-02-27", "2026-03-01"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.equal(weatherSource(["2026-11-25", "2026-11-30"], "2026-11-23"), "forecast");
  assert.equal(weatherSource(["2026-12-05", "2026-12-12"], "2026-11-23"), "typical", "past the 16-day forecast");
  assert.equal(shiftYears("2028-02-29", 1), "2027-02-28");
  assert.equal(shiftYears("2027-01-02", 3), "2024-01-02");
  assert.equal(tripLength(2, [3, 2], false), 7);
  assert.equal(tripLength(2, [3], true), 6, "the drive back starts the day you leave");
});

test("weather from the forecast and from past years", () => {
  const f = parseForecastDays({ daily: { time: ["2026-11-25", "2026-11-26"], temperature_2m_max: [40, 50], temperature_2m_min: [20, 30], weather_code: [73, 61], precipitation_probability_max: [80, null], snowfall_sum: [3, 0] } });
  assert.equal(f["2026-11-25"].snow, true);
  assert.equal(f["2026-11-26"].rain, 60, "a rain code with no chance given counts as likely");
  const year = (hi, rain, snow) => ({ daily: { temperature_2m_max: [hi], temperature_2m_min: [hi - 20], precipitation_sum: [rain], snowfall_sum: [snow], weather_code: [0] } });
  const t = typicalDays([year(30, 5, 2), year(40, 0, 0), year(50, 0, 0)], ["2026-12-20"]);
  near(t["2026-12-20"].hi, 40, 0.01);
  near(t["2026-12-20"].lo, 20, 0.01);
  assert.equal(t["2026-12-20"].rain, 33);
  assert.equal(t["2026-12-20"].snow, false, "snow in one year of three isn't typical");
  assert.equal(typicalDays([null], ["2026-12-20"])["2026-12-20"], undefined);
});

test("packing list follows the weather", () => {
  const day = (hi, lo, rain = 0, snow = false) => ({ hi, lo, rain, snow, code: null });
  const hot = packingList([{ name: "Phoenix", days: [day(95, 72), day(97, 74), day(96, 73)] }], { driveDays: 1, totalDays: 3 });
  const ids = list => list.groups.flatMap(g => g.items.map(i => i.id));
  const qty = (list, id) => list.groups.flatMap(g => g.items).find(i => i.id === id)?.qty;
  assert.ok(ids(hot).includes("swimsuit") && ids(hot).includes("sunscreen") && ids(hot).includes("shorts"));
  assert.ok(!ids(hot).includes("coat") && !ids(hot).includes("hat-gloves") && !ids(hot).includes("rain-jacket"));
  assert.equal(qty(hot, "underwear"), 4);

  const cold = packingList([{ name: "Denver", days: [day(28, 10, 70, true), day(30, 12, 20), day(25, 8, 50, true)] }], { driveDays: 2, totalDays: 12 });
  assert.ok(["coat", "thermals", "hat-gloves", "scarf", "rain-jacket", "boots", "car-kit", "laundry"].every(id => ids(cold).includes(id)), ids(cold).join());
  assert.ok(!ids(cold).includes("shorts") && !ids(cold).includes("swimsuit"));
  assert.equal(qty(cold, "underwear"), 8, "a week of clothes, then laundry");
  assert.ok(cold.groups.flatMap(g => g.items).find(i => i.id === "coat").why.includes("Denver"));

  const mixed = packingList([{ name: "San Diego", days: [day(75, 60)] }, { name: "Flagstaff", days: [day(42, 25)] }], { driveDays: 1, totalDays: 4 });
  assert.ok(ids(mixed).includes("tees") && ids(mixed).includes("long-sleeves") && ids(mixed).includes("coat"));
  assert.ok(!ids(mixed).includes("thermals"));
  assert.equal(packingList([], { totalDays: 2 }).groups.length > 0, true, "basics with no weather yet");

  const s = summarize([day(70, 45, 50), day(80, 55)]);
  assert.equal(s.rainyDays, 1);
  assert.equal(feel(s), "Mild with cool evenings, a chance of rain");
});

test("pack settings clean up", () => {
  const p = cleanPack({ stays: [{ id: "x", place: { lat: 1, lon: 2, name: "A" }, nights: 99 }, { id: "b", place: null, nights: 2 }, { id: "c", place: SLC, nights: 0.4 }], roundTrip: "yes", checked: { coat: true, "BAD id": true, socks: 1 } });
  assert.equal(p.stays.length, 2, "the first stay is the trip's end; others need a place");
  assert.equal(p.stays[0].id, "end");
  assert.equal(p.stays[0].place, null);
  assert.equal(p.stays[0].nights, 30);
  assert.equal(p.stays[1].nights, 1);
  assert.equal(p.roundTrip, false);
  assert.deepEqual(p.checked, { coat: true });
  assert.equal(cleanPack(null).stays.length, 1);
  assert.equal(normalizeData({}).pack.stays[0].id, "end");
});

console.log(`RoadTripFox: ${passed} checks passed`);
