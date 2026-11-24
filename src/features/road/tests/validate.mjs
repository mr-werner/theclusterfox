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
import { cleanPack, cleanDrive } from "../state/roadStore.js";
import { corridorFromOsm, estimatePrice, hotelTowns, parseCharge, pickNight, placeOnRoute, stayLinks } from "../model/stays.js";
import { dayWiggle, drivingWarning, fmtClock, gasPlan, parseClock, roadHazard, threePlans, timeline, toClock, weatherAlong } from "../model/days.js";
import { activityQuery, classifyWiki } from "../data/themes.js";

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

test("saved data and TaskFox", () => {
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
  assert.equal(d.hoursPerDay, 16);
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


test("hotel prices by brand, stars and town size", () => {
  assert.equal(estimatePrice({ kind: "hotel", name: "Motel 6 Rawlins", brand: "Motel 6" }), 68);
  assert.equal(estimatePrice({ kind: "hotel", name: "Days Inn by Wyndham Rawlins" }), 68, "a Days Inn is a Days Inn");
  assert.equal(estimatePrice({ kind: "hotel", name: "Hampton Inn Rock Springs" }), 128);
  assert.equal(estimatePrice({ kind: "hotel", name: "Hilton Garden Inn" }), 128);
  assert.equal(estimatePrice({ kind: "hotel", name: "Denver Marriott" }, 700000), Math.round(185 * 1.3));
  assert.equal(estimatePrice({ kind: "hotel", name: "The Old Inn", stars: 4 }), 205);
  assert.equal(estimatePrice({ kind: "camp", name: "KOA Journey" }), 58);
  assert.equal(estimatePrice({ kind: "camp", name: "Elk Camp", charge: 22 }), 22);
  assert.equal(estimatePrice({ kind: "rest", name: "Rest area" }), 0);
  assert.equal(parseCharge("25 USD/night"), 25);
  assert.equal(parseCharge("free"), null);
});

const osm = { elements: [
  { type: "node", id: 1, lat: 41.79, lon: -107.24, tags: { place: "town", name: "Rawlins", population: "8,221" } },
  { type: "node", id: 2, lat: 41.59, lon: -109.22, tags: { place: "city", name: "Rock Springs", population: "23526" } },
  ...Array.from({ length: 8 }, (_, i) => ({ type: "node", id: 10 + i, lat: 41.59 + i * 0.002, lon: -109.21, tags: { tourism: i % 2 ? "motel" : "hotel", name: i % 2 ? "Super 8" : "Hampton Inn", brand: i % 2 ? "Super 8" : "Hampton Inn" } })),
  { type: "way", id: 30, center: { lat: 41.79, lon: -107.23 }, tags: { tourism: "hotel", name: "Hampton Inn Rawlins" } },
  { type: "node", id: 40, lat: 41.6, lon: -108.6, tags: { tourism: "camp_site", name: "Sage Flat", fee: "no" } },
  { type: "node", id: 41, lat: 41.62, lon: -109.0, tags: { tourism: "camp_site", name: "Rock Springs KOA" } },
  { type: "node", id: 42, lat: 41.65, lon: -108.3, tags: { highway: "rest_area", name: "Point of Rocks Rest Area" } },
  { type: "node", id: 43, lat: 41.6, lon: -109.15, tags: { amenity: "fuel", brand: "Love's", name: "Love's Travel Stop" } },
  { type: "node", id: 44, lat: 41.31, lon: -105.6, tags: { amenity: "fuel", brand: "Shell", opening_hours: "24/7" } },
  { type: "node", id: 45, lat: 41.31, lon: -105.6, tags: { tourism: "camp_site", access: "private", name: "Private" } },
] };

test("places to stay and gas from OpenStreetMap", () => {
  const items = corridorFromOsm(osm);
  const kinds = items.reduce((m, i) => ({ ...m, [i.kind]: (m[i.kind] ?? 0) + 1 }), {});
  assert.deepEqual(kinds, { town: 2, hotel: 9, free: 1, camp: 1, rest: 1, fuel: 2, truck: 1 });
  assert.equal(items.find(i => i.kind === "town" && i.name === "Rawlins").pop, 8221);
  assert.ok(items.find(i => i.id === "osm:node/43").truck, "Love's is a truck stop");
  const towns = hotelTowns(items, 100);
  const rs = towns.find(t => t.town.name === "Rock Springs");
  assert.equal(rs.count, 8);
  assert.equal(rs.fit, 4, "the Super 8s fit $100");
  assert.ok(rs.lo < rs.hi);
});

const samplesDS = sampleEvery(line, cum, 1);
const placedDS = placeOnRoute(corridorFromOsm(osm), samplesDS);

test("a night in the town with the most hotels, with other options", () => {
  const rsMile = placedDS.find(p => p.name === "Rock Springs").mile;
  const n = pickNight(placedDS, { target: rsMile + 10, lo: rsMile - 150, hi: rsMile + 20, pref: "city", budget: 100 });
  assert.equal(n.pick.kind, "city");
  assert.equal(n.pick.name, "Rock Springs", "8 hotels beat 1");
  assert.ok(n.pick.inBudget);
  assert.equal(n.options.camp.name, "Rock Springs KOA");
  assert.equal(n.options.free.price, 0);
  assert.equal(n.options.truck.name, "Love's");
  assert.equal(n.options.rest.name, "Point of Rocks Rest Area");
  const camp = pickNight(placedDS, { target: rsMile, lo: rsMile - 150, hi: rsMile + 20, pref: "free", budget: 0 });
  assert.equal(camp.pick.name, "Sage Flat");
  const none = pickNight(placedDS, { target: 5, lo: 0, hi: 10, pref: "city" });
  assert.equal(none.pick, null);
  const links = stayLinks(n.pick, { checkin: "2026-12-01", checkout: "2026-12-02" });
  assert.match(links[0].href, /booking\.com.*ss=Rock\+Springs.*checkin=2026-12-01/);
});

test("your driving day: times, warnings and clean settings", () => {
  assert.equal(parseClock("08:30"), 510);
  assert.equal(parseClock("8:5"), null);
  assert.equal(toClock(510), "08:30");
  assert.equal(fmtClock(1050), "5:30 pm");
  assert.match(fmtClock(1440 + 60), /next day/);
  assert.equal(drivingWarning(7), null);
  assert.equal(drivingWarning(9).level, "warn");
  assert.equal(drivingWarning(10.5).level, "danger");
  assert.match(drivingWarning(12).text, /11/);
  const d = cleanDrive({ start: 600, finish: 500, stay: "nope", budget: -4, flex: 9999 });
  assert.equal(d.finish, 600 + 600, "a finish before the start becomes a 10-hour day");
  assert.equal(d.stay, "city");
  assert.equal(d.budget, 0);
  assert.equal(d.flex, 240);
  assert.equal(normalizeData({ hoursPerDay: 15 }).hoursPerDay, 15, "longer days are allowed now");
  assert.equal(normalizeData({ hoursPerDay: 40 }).hoursPerDay, 16);
});

test("days end at your stop time and snap to a place to sleep", () => {
  // 4 hours a day allowed but only 3 on the clock (with breaks and a stop).
  const days = splitDays(route, [{ id: "a", mile: 60, minutes: 60 }], { hours: 4, start: 480, finish: 660 });
  assert.ok(days.length >= 3);
  assert.ok(days.every(d => d.endClock <= 660 + 21), "every day is done by 11");
  assert.equal(days[0].startClock, 480);
  assert.equal(days[0].stopMinutes, 60);
  const own = splitDays(route, [], { hours: 4, start: 480, finish: 1080, days: { 0: { start: 360, finish: 420 } } });
  assert.equal(own[0].startClock, 360);
  assert.ok(own[0].driveMinutes <= 61, "the first day's own short window");
  const snapped = splitDays(route, [], { hours: 5, snap: ({ target }) => target - 20 });
  assert.equal(snapped[0].toMile, Math.round(snapped[0].exactTo));
  assert.equal(snapped[1].fromMile, snapped[0].toMile, "the next day starts where you slept");
});

test("three plans: as planned, push on, ease off", () => {
  const plans = threePlans(route, [], { drive: { start: 480, finish: 1080, flex: 60, stay: "city", budget: 120 }, hoursPerDay: 4, places: placedDS });
  assert.ok(plans.further.days.length <= plans.planned.days.length);
  assert.ok(plans.earlier.days.length >= plans.planned.days.length);
  assert.ok(Math.max(...plans.further.days.map(d => d.driveMinutes)) > Math.max(...plans.planned.days.map(d => d.driveMinutes)));
  assert.equal(plans.planned.nights.length, plans.planned.days.length);
  assert.equal(plans.planned.nights.at(-1), null, "no night after you arrive");
  const withPick = plans.planned.days.findIndex((d, i) => plans.planned.nights[i]?.pick);
  if (withPick >= 0) near(plans.planned.days[withPick].exactTo, plans.planned.nights[withPick].pick.mile, 0.01, "the day ends at the pick");
  const w = dayWiggle(route, plans.planned.days[0], { drive: { flex: 90, stay: "city", budget: 0 }, places: placedDS });
  assert.ok("further" in w && "earlier" in w);
  assert.equal(threePlans(route, [], { hoursPerDay: 1, drive: { start: 480, finish: 1080, flex: 90 } }).earlier, undefined, "can't ease off below an hour");
});

test("gas where you're already stopping", () => {
  const stations = [{ mile: 200, off: 0.2, name: "A" }, { mile: 240, off: 0.5, name: "B" }, { mile: 290, off: 0.1, name: "C" }];
  const plan = gasPlan(520, { first: 300, next: 300 }, stations, [{ mile: 241, name: "Lunch" }]);
  assert.equal(plan[0].station.name, "B", "fill up at lunch");
  assert.equal(plan[0].anchor.name, "Lunch");
  const plain = gasPlan(520, { first: 300, next: 300 }, stations, []);
  assert.equal(plain[0].station.name, "C", "otherwise go as far as is safe");
  assert.equal(gasPlan(200, { first: 300, next: 300 }, stations).length, 0);
});

test("weather when you'll be there", () => {
  const days = splitDays(route, [], { hours: 4, start: 480, finish: 1200 });
  const pts = timeline(route, days, { every: 90 });
  assert.equal(pts[0].minutes, 480);
  assert.ok(pts.some(p => p.day === 1 && p.minutes >= 1440 + 480));
  assert.ok(pts.filter(p => p.end).length === days.length);
  const body = { utc_offset_seconds: -25200, hourly: { time: ["2026-12-01T08:00", "2026-12-01T09:00"], temperature_2m: [20, 25], precipitation_probability: [80, 10], weather_code: [73, 1], wind_gusts_10m: [10, 50], snowfall: [0.5, 0] } };
  const got = weatherAlong([{ minutes: 480 }, { minutes: 545 }, { minutes: 3000 }], [body, body, body], "2026-12-01");
  assert.equal(got[0].weather.temp, 20);
  assert.equal(got[1].weather.temp, 25, "rounds to the nearest hour");
  assert.equal(got[2].weather, null, "not forecast yet");
  assert.equal(roadHazard(got[0].weather), "Snow on the road");
  assert.equal(roadHazard(got[1].weather), "Strong crosswinds");
  assert.equal(roadHazard({ temp: 30, rain: 60, code: 61 }), "Possible ice");
  assert.equal(roadHazard({ temp: 60, rain: 10, code: 1 }), null);
});

test("lighter activity lookups and Wikipedia's places", () => {
  const q = activityQuery(sampleEvery(line, cum, 50));
  assert.match(q, /\[timeout:25\]/);
  assert.ok(!/boundary/.test(q), "no slow park boundaries");
  assert.equal((q.match(/out center tags 90;/g) ?? []).length, 4);
  const falls = classifyWiki({ pageid: 1, title: "Fish Creek Falls", lat: 40.48, lon: -106.78 });
  assert.equal(falls.theme, "scenic");
  assert.equal(falls.label, "Waterfall");
  assert.match(falls.wiki, /Fish_Creek_Falls/);
  assert.equal(classifyWiki({ pageid: 2, title: "Rawlins High School", lat: 41, lon: -107 }), null);
  assert.equal(classifyWiki({ pageid: 3, title: "Rawlins, Wyoming", lat: 41, lon: -107 }), null);
  assert.equal(classifyWiki({ pageid: 4, title: "Wyoming Frontier Prison Museum", lat: 41, lon: -107 }).theme, "history");
  assert.equal(classifyWiki({ pageid: 5, title: "Fort Laramie National Historic Site", lat: 42, lon: -104 }).theme, "history");
});

console.log(`RoadTripFox: ${passed} checks passed`);
