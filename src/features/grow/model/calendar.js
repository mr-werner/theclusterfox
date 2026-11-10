// When to plant, as windows tied to the local frost dates. Plain functions,
// testable in Node.
//
// Timings follow extension planting calendars, which count weeks from the
// average last spring frost (LF) and first fall frost (FF):
// - Warm crops (tomato, pepper) start inside 6–10 weeks before LF and go out
//   1–2 weeks after it; beans, squash and corn are sown when soil warms.
// - Cool crops (peas, lettuce) are sown 4–6 weeks before LF, and again for
//   fall, counting back their days to harvest from FF.
// - Trees, shrubs and perennials go in while cool: early spring or about six
//   weeks before the ground freezes.
// - Spring bulbs go in when fall soil cools; garlic around the first frost.
// - Cool-season lawns are best seeded in late summer; warm-season lawns in
//   late spring once soil passes 65°F (18°C).

import { seasonsAround } from "./climate.js";
import { yearOf } from "./dates.js";

const W = 7;

export const ACTIONS = {
  indoors: { name: "Start seeds indoors", short: "Start inside" },
  sow: { name: "Sow outside", short: "Sow" },
  plant: { name: "Plant outside", short: "Plant" },
  fall: { name: "Plant for fall", short: "Fall crop" },
  harvest: { name: "Harvest", short: "Harvest" },
};

// Points in the season, for once-a-year jobs.
export const ANCHORS = {
  lateWinter: { name: "Late winter", at: s => s.lf - 6 * W },
  spring: { name: "Spring", at: s => s.lf },
  lateSpring: { name: "Late spring", at: s => s.lf + Math.min(4 * W, Math.round(s.length * 0.2)) },
  earlySummer: { name: "Early summer", at: s => s.lf + Math.round(s.length * 0.33) },
  midSummer: { name: "Midsummer", at: s => s.lf + Math.round(s.length * 0.5) },
  lateSummer: { name: "Late summer", at: s => s.lf + Math.round(s.length * 0.7) },
  fall: { name: "Fall", at: s => s.ff - 4 * W },
  lateFall: { name: "Late fall", at: s => s.ff + W },
  winter: { name: "Winter", at: s => s.ff + 6 * W },
};

// Stretches of the season, for repeating jobs.
export const PERIODS = {
  growing: s => [s.lf - 2 * W, s.ff],
  spring: s => [s.lf - 4 * W, s.lf + 6 * W],
  lateSpring: s => [s.lf + 2 * W, s.lf + 8 * W],
  summer: s => [s.lf + Math.round(s.length * 0.25), s.ff - 3 * W],
  fall: s => [s.ff - 8 * W, s.ff + 2 * W],
  winter: s => [s.ff + 2 * W, s.lf + 365 - 6 * W],
  all: () => [-Infinity, Infinity],
};

// Planting patterns. Each returns windows { action, start, end } for a season.
const PLANTING = {
  warmVeg: (s, p) => [
    { action: "indoors", start: s.lf - (p.indoors ?? 6) * W, end: s.lf - ((p.indoors ?? 6) - 2) * W },
    { action: "plant", start: s.lf + W, end: s.lf + 5 * W },
  ],
  warmSow: (s, p) => [{ action: "sow", start: s.lf + W, end: Math.max(s.lf + 3 * W, Math.min(s.lf + 8 * W, s.ff - (p.days ?? 60) - W)) }],
  warmSlips: () => [],
  coolSow: (s, p) => [
    { action: "sow", start: s.lf - 6 * W, end: s.lf },
    { action: "fall", start: s.ff - (p.days ?? 50) - 4 * W, end: s.ff - (p.days ?? 50) },
  ],
  coolVeg: (s, p) => [
    { action: "indoors", start: s.lf - (3 + (p.indoors ?? 6)) * W, end: s.lf - (1 + (p.indoors ?? 6)) * W },
    { action: "plant", start: s.lf - 3 * W, end: s.lf + W },
    { action: "fall", start: s.ff - (p.days ?? 60) - 3 * W, end: s.ff - (p.days ?? 60) + W },
  ],
  onion: s => [{ action: "plant", start: s.lf - 6 * W, end: s.lf - 2 * W }],
  potato: s => [{ action: "plant", start: s.lf - 3 * W, end: s.lf + 2 * W }],
  garlic: s => [{ action: "plant", start: s.ff - 2 * W, end: s.ff + 3 * W }],
  perennial: s => [
    { action: "plant", start: s.lf - W, end: s.lf + 6 * W },
    { action: "plant", start: s.ff - 8 * W, end: s.ff - 4 * W },
  ],
  perennialFall: s => [{ action: "plant", start: s.ff - 8 * W, end: s.ff - 2 * W }],
  iris: s => [{ action: "plant", start: s.lf + Math.round(s.length * 0.55), end: s.ff - 5 * W }],
  tree: s => [
    { action: "plant", start: s.lf - 4 * W, end: s.lf + 4 * W },
    { action: "plant", start: s.ff - 8 * W, end: s.ff },
  ],
  bulbFall: s => [{ action: "plant", start: s.ff - 6 * W, end: s.ff + 2 * W }],
  tenderBulb: s => [{ action: "plant", start: s.lf + W, end: s.lf + 4 * W }],
  annualFlower: (s, p) => [
    { action: "indoors", start: s.lf - (p.indoors ?? 6) * W, end: s.lf - ((p.indoors ?? 6) - 2) * W },
    { action: "plant", start: s.lf + W, end: s.lf + 6 * W },
  ],
  sowFlower: s => [{ action: "sow", start: s.lf, end: s.lf + 6 * W }],
  coolGrass: s => [
    { action: "sow", start: s.ff - 10 * W, end: s.ff - 6 * W, best: true },
    { action: "sow", start: s.lf - 2 * W, end: s.lf + 4 * W },
  ],
  warmGrass: s => [{ action: "sow", start: s.lf + 4 * W, end: s.lf + 12 * W }],
  warmGrassSod: s => [{ action: "plant", start: s.lf + 4 * W, end: s.ff - 8 * W }],
};
PLANTING.warmSlips = s => [{ action: "plant", start: s.lf + 3 * W, end: s.lf + 7 * W }];

// Frost-free gardens: cool crops simply grow through the mild months, so a
// "fall crop" is just another sowing, and there's no need to start inside.
function adjustForFrostless(windows, plant) {
  if (plant.when !== "coolSow" && plant.when !== "coolVeg") return windows;
  const out = plant.when === "coolSow" ? "sow" : "plant";
  return windows.filter(w => w.action !== "indoors").map(w => (w.action === "fall" ? { ...w, action: out } : w));
}

export function plantingWindows(plant, season) {
  const make = PLANTING[plant.when];
  if (!make) return [];
  let windows = make(season, plant).filter(w => w.end >= w.start);
  if (season.frostless) windows = adjustForFrostless(windows, plant);
  // Harvest follows the earliest planting by the plant's days to harvest.
  if (plant.days && ["vegetable", "herb", "annual"].includes(plant.type) && plant.when !== "garlic") {
    const outs = windows.filter(w => w.action !== "indoors");
    for (const w of outs) {
      const start = w.start + plant.days;
      const end = Math.min(season.frostless ? start + 60 : w.action === "fall" ? season.ff + 3 * W : season.ff, w.end + plant.days + 6 * W);
      if (end > start) windows.push({ action: "harvest", start, end });
    }
  }
  return windows;
}

/** Windows that overlap [from, to], across the seasons around those days. */
export function windowsBetween(plant, climate, from, to) {
  const years = new Set([yearOf(from), yearOf(to)]);
  const out = [];
  const seen = new Set();
  for (const y of years) {
    for (const s of seasonsAround(climate, y)) {
      for (const w of plantingWindows(plant, s)) {
        const key = `${w.action}:${w.start}`;
        if (w.end >= from && w.start <= to && !seen.has(key)) {
          seen.add(key);
          out.push(w);
        }
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The window open now, or the next one coming up, for each action. */
export function nextWindows(plant, climate, today) {
  return windowsBetween(plant, climate, today, today + 400)
    .filter(w => w.action !== "harvest")
    .map(w => ({ ...w, open: w.start <= today && w.end >= today }));
}

export const isPlantableNow = (plant, climate, today) => nextWindows(plant, climate, today).some(w => w.open);

/**
 * A 12-month strip for a calendar year: for each month, the actions whose
 * windows touch it. Used for the yearly planting chart.
 */
export function yearStrip(plant, climate, year) {
  const from = Math.round(Date.UTC(year, 0, 1) / 86400000);
  const to = Math.round(Date.UTC(year, 11, 31) / 86400000);
  const windows = windowsBetween(plant, climate, from, to);
  return windows.map(w => ({ ...w, startFrac: Math.max(0, (w.start - from) / (to - from + 1)), endFrac: Math.min(1, (w.end - from + 1) / (to - from + 1)) }));
}

export function anchorDays(anchor, climate, year) {
  const a = ANCHORS[anchor];
  if (!a) return [];
  return seasonsAround(climate, year).map(s => a.at(s));
}

export function inPeriod(period, climate, day) {
  const fn = PERIODS[period] ?? PERIODS.growing;
  if (climate.frostless && period !== "winter" && period !== "spring") return true;
  return seasonsAround(climate, yearOf(day)).some(s => {
    const [a, b] = fn(s);
    return day >= a && day <= b;
  });
}
