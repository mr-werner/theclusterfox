// Checks GrowFox's plant data and garden math: node src/features/grow/tests/validate.mjs
import assert from "node:assert/strict";

import { PLANTS, TYPES, TAGS, plantsById } from "../data/plants.js";
import { computeClimate, zoneFromMinF, climateFromZone, seasonFor, effectiveClimate } from "../model/climate.js";
import { plantingWindows, ANCHORS, PERIODS, windowsBetween, yearStrip } from "../model/calendar.js";
import { rate, cadence, entryTasks, KINDS } from "../model/care.js";
import { sunHours, sideReport, sunPosition, noonShadow } from "../model/sun.js";
import { dayNum, dayKey, fromDoy, weekday } from "../model/dates.js";
import { normalizeData, emptyData } from "../state/growStore.js";
import { planItems, launchTargets } from "../model/planLink.js";
import { dayLength, defaultYard, pointHours, sunGrid, lightAt, plantFit, houseSides, cleanYard, lightShares } from "../model/yard.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// A smooth synthetic climate: coldest around Jan 15 (or Jul 15 south).
function synthetic(latitude, { mean = 5, swing = 12, years = 10 } = {}) {
  const time = [];
  const tmin = [];
  const tmax = [];
  const rain = [];
  const shift = latitude < 0 ? 182 : 0;
  for (let y = 2015; y < 2015 + years; y++) {
    for (let doy = 1; doy <= 365; doy++) {
      const d = fromDoy(y, doy);
      const t = mean - swing * Math.cos((2 * Math.PI * (doy - 15 - shift)) / 365);
      time.push(d);
      tmin.push(t);
      tmax.push(t + 10);
      rain.push(2.5);
    }
  }
  return { time, tmin, tmax, rain };
}

test("every plant is complete and valid", () => {
  const types = new Set(TYPES.map(t => t.id));
  const ids = new Set();
  for (const p of PLANTS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(types.has(p.type), `${p.id} type`);
    assert.ok(p.name && p.latin && p.tip && p.size && p.soil, `${p.id} text`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, `${p.id} color`);
    assert.ok(p.sun.length && p.sun.every(s => ["full", "part", "shade"].includes(s)), `${p.id} sun`);
    assert.ok([1, 2, 3].includes(p.water) && [1, 2, 3].includes(p.heat), `${p.id} water/heat`);
    assert.ok(p.base >= 1 && p.base <= 5, `${p.id} base`);
    assert.ok(p.zones || p.days, `${p.id} needs zones or days`);
    if (p.zones) assert.ok(p.zones[0] >= 1 && p.zones[1] <= 13 && p.zones[0] <= p.zones[1], `${p.id} zones`);
    assert.ok(p.care.length, `${p.id} care`);
    for (const c of p.care) {
      assert.ok(KINDS[c.kind], `${p.id} care kind ${c.kind}`);
      for (const a of c.anchors) assert.ok(ANCHORS[a] || PERIODS[a] || a === "harvest", `${p.id} anchor ${a}`);
    }
    for (const t of p.tags) assert.ok(TAGS[t], `${p.id} tag ${t}`);
    const season = seasonFor(climateFromZone(6), 2026);
    assert.ok(plantingWindows(p, season).length, `${p.id} has planting windows`);
  }
  assert.ok(PLANTS.length >= 100, `only ${PLANTS.length} plants`);
  for (const t of TYPES) assert.ok(PLANTS.some(p => p.type === t.id), `no ${t.id}`);
});

test("hardiness zones follow the USDA 10°F bands", () => {
  assert.equal(zoneFromMinF(-15).label, "5b");
  assert.equal(zoneFromMinF(-20).label, "5a");
  assert.equal(zoneFromMinF(0).label, "7a");
  assert.equal(zoneFromMinF(19).label, "8b");
  assert.equal(zoneFromMinF(45).label, "11b");
  assert.equal(zoneFromMinF(-80).label, "1a");
});

test("frost dates and zone come out of daily weather (north)", () => {
  const c = computeClimate(synthetic(40), 40);
  assert.equal(c.hemisphere, "N");
  assert.equal(c.years, 10);
  assert.equal(c.zone, 8.5); // coldest night -7°C ≈ 19°F
  assert.ok(Math.abs(c.lastFrost - 81) <= 2, `last frost ${c.lastFrost}`);
  assert.ok(Math.abs(c.firstFrost - 314) <= 2, `first frost ${c.firstFrost}`);
  assert.ok(Math.abs(c.frostFree - 233) <= 3);
  assert.equal(c.frostless, false);
  assert.equal(c.monthly.length, 12);
  assert.ok(c.monthly[6].hi > c.monthly[0].hi);
});

test("southern hemisphere seasons flip", () => {
  const c = computeClimate(synthetic(-35), -35);
  assert.equal(c.hemisphere, "S");
  // Last spring frost lands in September/October, first fall frost in April/May.
  assert.ok(c.lastFrost > 240 && c.lastFrost < 290, `last frost ${c.lastFrost}`);
  assert.ok(c.firstFrost > 100 && c.firstFrost < 140, `first frost ${c.firstFrost}`);
  assert.ok(Math.abs(c.frostFree - 233) <= 4, `${c.frostFree}`);
  const s = seasonFor(c, 2026);
  assert.ok(s.ff > s.lf);
});

test("warm places are frost free", () => {
  const c = computeClimate(synthetic(25, { mean: 18, swing: 6 }), 25);
  assert.equal(c.frostless, true);
  assert.equal(c.lastFrost, null);
  assert.ok(c.zone >= 10);
});

test("planting windows count from the last frost", () => {
  const c = computeClimate(synthetic(40), 40);
  const s = seasonFor(c, 2026);
  const tomato = plantingWindows(plantsById.get("tomato"), s);
  const indoors = tomato.find(w => w.action === "indoors");
  const out = tomato.find(w => w.action === "plant");
  assert.equal(indoors.start, s.lf - 49);
  assert.equal(out.start, s.lf + 7);
  assert.ok(tomato.some(w => w.action === "harvest" && w.start === out.start + 75));
  const peas = plantingWindows(plantsById.get("peas"), s);
  assert.ok(peas.find(w => w.action === "sow").end <= s.lf);
  assert.ok(peas.some(w => w.action === "fall"));
  const tulip = plantingWindows(plantsById.get("tulip"), s);
  assert.ok(tulip[0].start > s.lf + 100);
  const strip = yearStrip(plantsById.get("tomato"), c, 2026);
  assert.ok(strip.every(w => w.startFrac >= 0 && w.endFrac <= 1 && w.endFrac > w.startFrac));
});

test("difficulty reflects zone, season, heat and light", () => {
  const cold = climateFromZone(4);
  assert.equal(rate(plantsById.get("lavender"), cold).score, 6);
  assert.equal(rate(plantsById.get("hosta"), cold).score <= 2, true);
  const shortSeason = { ...climateFromZone(3), frostFree: 70 };
  assert.equal(rate(plantsById.get("watermelon"), shortSeason).score, 6);
  assert.ok(rate(plantsById.get("radish"), shortSeason).score <= 2);
  const hot = climateFromZone(9);
  assert.equal(rate(plantsById.get("bluegrass"), hot).score, 6);
  assert.ok(rate(plantsById.get("bermuda"), hot).score <= 3);
  assert.equal(rate(plantsById.get("tomato"), climateFromZone(6), "shade").score, 6);
  assert.ok(rate(plantsById.get("hosta"), climateFromZone(6), "full").score > rate(plantsById.get("hosta"), climateFromZone(6), "shade").score);
  // Citrus can live in a pot where it's too cold to plant out.
  const citrus = rate(plantsById.get("citrus"), climateFromZone(7));
  assert.ok(citrus.score < 6 && citrus.reasons.some(r => r.includes("pot")));
});

test("care cadence uses Daily / Weekly / Monthly / Seasonal / Never", () => {
  const tomato = cadence(plantsById.get("tomato"), climateFromZone(6));
  assert.equal(tomato.find(g => g.id === "water").word, "Daily");
  assert.equal(tomato.find(g => g.id === "trim").word, "Weekly");
  const sedum = cadence(plantsById.get("sedum"), climateFromZone(6));
  assert.equal(sedum.find(g => g.id === "water").word, "Never");
  assert.equal(sedum.find(g => g.id === "trim").word, "Seasonal");
  const oak = cadence(plantsById.get("oak"), climateFromZone(6));
  assert.equal(oak.find(g => g.id === "water").word, "Never");
  assert.match(oak.find(g => g.id === "water").detail, /first year/);
});

test("jobs land on the right days", () => {
  const c = computeClimate(synthetic(40), 40);
  const s = seasonFor(c, 2026);
  const rose = plantsById.get("rose");
  const entry = { id: "r1", plantId: "rose", status: "growing", planted: "2025-04-01" };
  // A mid-summer garden day gets the weekly jobs; the next day doesn't.
  let d = s.lf + 90;
  while (weekday(d) !== 6) d++;
  const sat = entryTasks(entry, rose, c, dayKey(d), { gardenDay: 6 }).map(t => t.kind);
  assert.ok(sat.includes("water") && sat.includes("deadhead"));
  assert.equal(entryTasks(entry, rose, c, dayKey(d + 1), { gardenDay: 6 }).filter(t => t.kind === "water").length, 0);
  // Late-winter pruning lands on its anchor day.
  const prune = s.lf - 42;
  assert.ok(entryTasks(entry, rose, c, dayKey(prune), {}).some(t => t.kind === "trim"));
  // Nothing before it's planted.
  assert.equal(entryTasks({ ...entry, planted: dayKey(d + 10) }, rose, c, dayKey(d), {}).length, 0);
  // Planned plants get a reminder when their planting window opens.
  const tomato = plantsById.get("tomato");
  const indoors = windowsBetween(tomato, c, s.lf - 60, s.lf).find(w => w.action === "indoors");
  const reminders = entryTasks({ id: "t1", plantId: "tomato", status: "planned" }, tomato, c, dayKey(indoors.start), {});
  assert.equal(reminders.length, 1);
  assert.match(reminders[0].title, /Start inside/);
  // Tomatoes stop after the fall frost.
  const planted = { id: "t2", plantId: "tomato", status: "growing", planted: dayKey(s.lf + 10) };
  for (let x = s.ff + 1; x < s.ff + 30; x++) assert.equal(entryTasks(planted, tomato, c, dayKey(x), {}).length, 0);
});

test("sun falls on the equator side of the house", () => {
  const n = sideReport(42);
  const side = id => n.sides.find(s => s.id === id);
  assert.ok(side("S").season > side("N").season + 3);
  assert.equal(side("S").light, "full");
  assert.equal(side("N").light, "shade");
  assert.ok(side("W").hotAfternoon);
  const s = sideReport(-34);
  const sSide = id => s.sides.find(x => x.id === id);
  assert.ok(sSide("N").season > sSide("S").season + 3);
  const noon = sunPosition(40, 79, 12);
  assert.ok(Math.abs(noon.alt - 50) < 1.5 && Math.abs(noon.az - 180) < 1);
  assert.ok(sunHours(40, 172).total > sunHours(40, 355).total);
  assert.ok(noonShadow(40, 355, 6).length > noonShadow(40, 172, 6).length);
});

test("saved data is cleaned on load", () => {
  const d = normalizeData({ prefs: { theme: "neon" }, garden: [{ id: "a", plantId: "nope" }, { id: "b", plantId: "basil", spotId: "ghost", planted: "2026-13-01" }], done: { x: "2026-01-01" } });
  assert.equal(d.prefs.theme, "meadow");
  assert.equal(d.garden.length, 1);
  assert.equal(d.garden[0].spotId, null);
  assert.equal(d.garden[0].planted, null);
  assert.deepEqual(normalizeData(null), emptyData());
  const withYard = normalizeData({ yard: { facing: 90, objects: [{ id: "t", kind: "tree", x: 3, y: 4 }] }, spots: [{ id: "s", name: "Bed", light: "part", x: 2, y: -8 }, { id: "s2", light: "shade", x: 400, y: 1 }] });
  assert.equal(withYard.yard.facing, 90);
  assert.equal(withYard.yard.objects[0].kind, "tree");
  assert.deepEqual([withYard.spots[0].x, withYard.spots[0].y, withYard.spots[0].auto], [2, -8, true]);
  assert.deepEqual([withYard.spots[1].x, withYard.spots[1].auto], [null, false]);
  assert.equal(emptyData().yard, null);
  const shifted = effectiveClimate({ ...emptyData(), climate: computeClimate(synthetic(40), 40), zoneShift: -1 });
  assert.equal(shifted.zone, 7.5);
});

test("PlanFox gets dated jobs that open GrowFox", () => {
  const c = computeClimate(synthetic(40), 40);
  const raw = { ...emptyData(), climate: c, garden: [{ id: "g1", plantId: "tomato", status: "growing", planted: "2026-04-01" }], done: {} };
  const items = planItems(raw, "2026-07-01", "2026-07-14");
  assert.ok(items.length >= 7);
  for (const it of items) {
    assert.match(it.day, /^2026-07-(0\d|1[0-4])$/);
    assert.ok(it.href.startsWith("/grow?task=") && it.href.includes(`day=${it.day}`));
    assert.equal(it.time, null);
    assert.equal(typeof it.title, "string");
  }
  const first = items[0];
  const again = planItems({ ...raw, done: { [first.id]: "2026-07-01T10:00:00Z" } }, "2026-07-01", "2026-07-14");
  assert.equal(again.find(i => i.id === first.id).done, true);
  assert.equal(new Set(items.map(i => i.id)).size, items.length);
  assert.deepEqual(planItems(null, "2026-07-01", "2026-07-02"), []);
  assert.equal(launchTargets(raw).length, 2);
  assert.equal(dayKey(dayNum("2026-07-01")), "2026-07-01");
});

test("yard sun map casts real shadows for the latitude", () => {
  assert.ok(Math.abs(dayLength(0, 172) - 12) < 0.1);
  assert.ok(dayLength(60, 172) > 18 && dayLength(60, 355) < 6.5);
  assert.ok(Math.abs(dayLength(40, 172) - dayLength(-40, 355)) < 0.1);
  const house = defaultYard(); // front faces south
  const sides = Object.fromEntries(houseSides(house, 40).map(s => [s.id, s]));
  assert.equal(sides.front.compass, "south");
  assert.ok(sides.front.hours > sides.back.hours + 4, "south wall sunnier than north at 40N");
  assert.equal(sides.front.light, "full");
  assert.notEqual(sides.back.light, "full");
  assert.equal(houseSides(house, 40, "winter").find(s => s.id === "back").light, "shade");
  const south = Object.fromEntries(houseSides(house, -35).map(s => [s.id, s]));
  assert.ok(south.back.hours > south.front.hours + 3, "north wall sunnier in the south");
  const turned = { ...house, facing: 0 };
  assert.equal(houseSides(turned, 40).find(s => s.id === "back").light, "full");
  // A leafy tree shades the ground to its north; an evergreen shades it more.
  const open = pointHours(house, 40, 0, -12);
  const tree = { ...house, objects: [{ id: "t", kind: "tree", x: 0, y: -14, h: 9, r: 3.5 }] };
  const ever = { ...house, objects: [{ id: "t", kind: "evergreen", x: 0, y: -14, h: 9, r: 3.5 }] };
  assert.ok(pointHours(tree, 40, 0, -12) < open - 1);
  assert.ok(pointHours(ever, 40, 0, -12) < pointHours(tree, 40, 0, -12));
  assert.ok(pointHours(tree, 40, 0, -14) < 6, "under the canopy is no longer full sun");
  assert.ok(Math.abs(pointHours(tree, 40, 0, -19) - pointHours(house, 40, 0, -19)) < 1, "little shade on the sunny side");
  // An east-west fence shades a strip on its north side in winter.
  const fence = { ...house, objects: [{ id: "f", kind: "fence", x: 8, y: -10, h: 1.8, len: 10, angle: 90 }] };
  assert.ok(pointHours(fence, 40, 8, -9.5, "winter") < pointHours(house, 40, 8, -9.5, "winter") - 2);
  assert.equal(pointHours(house, 40, 0, 0), null);
  // A wing makes the house an L: its ground is building, and it shades the yard beside it.
  const ell = { ...house, objects: [{ id: "w", kind: "wing", x: 9, y: -1.5, w: 6, d: 6, h: 4, angle: 180 }] };
  assert.equal(pointHours(ell, 40, 9, -1.5), null);
  assert.ok(pointHours(ell, 40, 9, 3, "equinox") < pointHours(house, 40, 9, 3, "equinox") - 2);
  const grid = sunGrid(tree, 40);
  assert.equal(grid.hours.length, grid.n * grid.n);
  assert.equal(lightAt(grid, 0, 0), null);
  assert.equal(lightAt(grid, 0, 7).light, "full");
  const shares = lightShares(grid);
  assert.ok(Math.abs(shares.full + shares.part + shares.shade - 1) < 1e-6);
  const fit = plantFit(grid, plantsById.get("hosta"));
  assert.ok(fit.some(f => f === 2) && fit.some(f => f === 0));
  const y = cleanYard({ facing: 400, width: 10, objects: [{ id: "a", kind: "tree", x: 99, h: 7 }, { id: "b", kind: "ufo" }, { kind: "fence" }] });
  assert.equal(y.facing, 180);
  assert.equal(y.width, 10);
  assert.equal(y.objects.length, 1);
  assert.equal(y.objects[0].x, 0);
  assert.equal(y.objects[0].h, 7);
  assert.deepEqual(cleanYard(null), defaultYard());
});

test("the sunlight row says how much sun, not how often", () => {
  const row = cadence(plantsById.get("tomato"), null).find(c => c.id === "sun");
  assert.equal(row.word, null);
  assert.match(row.need, /Full sun/);
});

console.log(`\n${passed} GrowFox checks passed`);
