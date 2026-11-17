// Care feedback for what's already in the ground: a plant on the yard map
// and your lawn. Plain functions, testable in Node.

import { cToF, seasonFor } from "./climate.js";
import { entryTasks, cadence, KINDS } from "./care.js";
import { LIGHT, lightFor } from "./sun.js";
import { addDays, dayKey, weekdayShort, shortDate, yearOf } from "./dates.js";

const MM_PER_IN = 25.4;
const GAL_PER_SQFT_IN = 0.623; // gallons to put 1 inch of water on 1 sq ft
const SQFT_PER_SQM = 10.764;

const temp = (c, units) => (units === "metric" ? `${Math.round(c)}°C` : `${Math.round(cToF(c))}°F`);
const depth = (mm, units) => (mm < 3 ? "almost none" : units === "metric" ? `${Math.round(mm)} mm` : `${Math.max(0.1, Math.round((mm / MM_PER_IN) * 10) / 10)} in`);

// What tends to go wrong, by kind of plant.
const WATCH = {
  vegetable: "Look under the leaves once a week for aphids, beetles and caterpillars, and pick them off. Water the soil, not the leaves, to keep mildew and blight away.",
  fruit: "Watch for birds once fruit colors (netting helps) and pick up fallen fruit so pests don't overwinter.",
  herb: "Pinch the tips often so it stays bushy, and cut flower stalks off leafy herbs before they bloom.",
  annual: "Deadhead faded flowers to keep blooms coming. Yellow lower leaves usually mean too much water.",
  perennial: "Watch for powdery mildew in late summer; give it air around the stems. Cut back dead stalks at the end of the season.",
  bulb: "Let the leaves die back on their own after flowering: that's what feeds next year's bloom.",
  shrub: "Look for dead or crossing branches and cut them out. Prune spring bloomers right after they flower, not before.",
  tree: "Keep mulch in a wide ring, not piled against the trunk, and keep the mower and trimmer off the bark.",
  cover: "Edge it once or twice a season so it doesn't creep into beds and lawn.",
  grass: "Mow with a sharp blade and never take more than a third of the height at once.",
};

/**
 * How a planted plant is doing where it sits on the map.
 * Returns { light: { hours, light, verdict, ok }, week: [{ kind, name, days }],
 * cadence: [{ id, name, word }], watch: [string] }.
 */
export function plantCheck({ plant, entry, climate, hours, todayNum, prefs = {}, forecast = null, units = "us" }) {
  const out = { light: null, week: [], cadence: [], watch: [] };
  if (hours != null) {
    const here = lightFor(hours);
    const ok = plant.sun.includes(here);
    const best = here === plant.sun[0];
    const verdict = best
      ? `Gets about ${hours.toFixed(1)} h of direct sun here: just what it wants.`
      : ok
        ? `Gets about ${hours.toFixed(1)} h of direct sun here (${LIGHT[here].name.toLowerCase()}). It copes, but does best in ${LIGHT[plant.sun[0]].name.toLowerCase()}.`
        : `Gets about ${hours.toFixed(1)} h of direct sun here (${LIGHT[here].name.toLowerCase()}), but it needs ${plant.sun.map(s => LIGHT[s].name.toLowerCase()).join(" or ")}. Expect it to struggle; move it if you can.`;
    out.light = { hours, light: here, verdict, ok, best };
  }
  if (climate && entry) {
    const byKind = new Map();
    for (let i = 0; i < 7; i++) {
      const day = addDays(dayKey(todayNum), i);
      for (const t of entryTasks(entry, plant, climate, day, prefs)) {
        const k = t.kind;
        if (!byKind.has(k)) byKind.set(k, { kind: k, name: KINDS[k]?.name ?? (k === "plant" ? "Plant" : k), note: t.note, days: [] });
        byKind.get(k).days.push(i === 0 ? "today" : weekdayShort(day));
      }
    }
    out.week = [...byKind.values()];
  }
  out.cadence = cadence(plant, climate)
    .filter(c => c.word && c.word !== "Never")
    .map(c => ({ id: c.id, name: c.name, word: c.word }));

  if (WATCH[plant.type]) out.watch.push(WATCH[plant.type]);
  const active = out.week.length > 0 || Boolean(plant.zones);
  const watering = out.week.some(w => w.kind === "water");
  if (forecast?.length && active) {
    const hot = forecast.filter(d => Number.isFinite(d.high) && d.high >= 32);
    const rain = forecast.reduce((n, d) => n + (Number.isFinite(d.rain) ? d.rain : 0), 0);
    const cold = forecast.filter(d => Number.isFinite(d.low) && d.low <= 1.5);
    if (hot.length && plant.water >= 2 && watering) out.watch.push(`Hot days ahead (up to ${temp(Math.max(...hot.map(d => d.high)), units)}): check the soil each morning and water deeply if the top inch is dry.`);
    else if (rain < 8 && plant.water === 3 && watering) out.watch.push(`Rain forecast this week: ${depth(rain, units)}. It likes steady moisture, so water deeply twice this week.`);
    if (cold.length && !plant.zones && out.week.length) out.watch.push(`Frost possible ${cold.map(d => weekdayShort(d.day)).join(", ")}: cover it overnight or harvest what's ready.`);
  }
  if (plant.heat === 1 && out.light?.light === "full") out.watch.push("It dislikes heat: a little afternoon shade in midsummer keeps it from bolting or scorching.");
  return out;
}

// Where in the lawn year we are: dormant, spring, summer or fall.
export function lawnPhase(climate, todayNum) {
  const s = seasonFor(climate, yearOf(todayNum));
  const d = todayNum;
  if (climate.frostless) {
    // No frost: a long growing year with a cooler, slower stretch around midwinter.
    const north = climate.hemisphere !== "S";
    const m = new Date(d * 86400000).getUTCMonth();
    const winter = north ? [11, 0, 1] : [5, 6, 7];
    const spring = north ? [2, 3, 4] : [8, 9, 10];
    const fall = north ? [8, 9, 10] : [2, 3, 4];
    return { phase: winter.includes(m) ? "slow" : spring.includes(m) ? "spring" : fall.includes(m) ? "fall" : "summer", season: s };
  }
  let phase = "summer";
  if (d < s.lf - 21 || d > s.ff + 21) phase = "dormant";
  else if (d < s.lf + 45) phase = "spring";
  else if (d > s.ff - 45) phase = "fall";
  return { phase, season: s };
}

/**
 * Lawn tips for this week: { phase, water, mow, weeds, feed, area }.
 * areaSqm is the lawn's size on the map; forecast is [{ day, high, low, rain }] (°C, mm).
 */
export function lawnAdvice({ grass, climate, todayNum, forecast = null, areaSqm = 0, units = "us" }) {
  const { phase, season } = lawnPhase(climate, todayNum);
  const warm = grass.season === "warm";
  const height = (grass.size.match(/Mow ([^,;]+)/) ?? [])[1] ?? "at the height on the seed bag";
  const date = n => shortDate(n);
  const sqft = areaSqm * SQFT_PER_SQM;
  const out = { phase, water: "", mow: "", weeds: "", feed: "", area: "" };
  if (sqft > 0) {
    const gallons = Math.round((sqft * GAL_PER_SQFT_IN) / 10) * 10;
    out.area = units === "metric" ? `About ${Math.round(areaSqm)} m² of lawn: 25 mm of water is about ${Math.round(areaSqm * 25)} liters.` : `About ${Math.round(sqft / 10) * 10} sq ft of lawn: 1 inch of water is about ${gallons.toLocaleString("en-US")} gallons.`;
  }

  const growing = phase !== "dormant" && !(phase === "slow" && !warm);
  const sleepy = warm ? phase === "dormant" || phase === "slow" : phase === "dormant";
  // Water: about an inch a week, more in heat, minus the rain that's coming.
  if (sleepy) out.water = "It's resting: no watering needed unless a dry, windy spell lasts weeks.";
  else {
    const need = forecast?.some(d => d.high >= 32) ? 32 : 25;
    const rain = forecast?.length ? forecast.reduce((n, d) => n + (Number.isFinite(d.rain) ? d.rain : 0), 0) : null;
    const top = forecast?.length ? Math.max(...forecast.map(d => d.high).filter(Number.isFinite)) : null;
    if (rain == null) out.water = `Give it about ${depth(need, units)} of water a week counting rain, in one or two deep soaks before 10 am. A tuna can on the lawn makes a handy gauge.`;
    else if (rain >= need) out.water = `About ${depth(rain, units)} of rain is forecast this week: that covers it. Skip the sprinkler.`;
    else {
      const short = need - rain;
      out.water = `Rain forecast this week: ${depth(rain, units)}. Add about ${depth(short, units)} of water in one or two deep soaks early in the morning, not a daily sprinkle.`;
      if (top != null && top >= 32 && !warm) out.water += ` Highs near ${temp(top, units)}: cool-season grass may go dormant and brown. That's normal; ½ inch every two weeks keeps it alive, or keep watering fully to stay green.`;
    }
  }
  // Mowing height and rhythm.
  if (!growing || sleepy) out.mow = "No mowing while it's dormant. Keep off frozen grass; footprints kill the crowns.";
  else if (phase === "spring") out.mow = `Start mowing when it greens up and grows, at ${height}. Mow often enough that you never take off more than a third.`;
  else if (phase === "summer") out.mow = `Mow at the top of ${height} and leave the clippings: taller grass shades the soil, holds water and crowds out weeds.`;
  else out.mow = `Keep mowing at ${height} until it stops growing; drop the last cut or two by about half an inch. Mulch fallen leaves with the mower.`;
  // Weeds, timed to your frost dates.
  if (phase === "dormant" || phase === "slow") out.weeds = `Plan ahead: crabgrass preventer goes down around ${date(season.lf - 14)}–${date(season.lf + 14)}, when the forsythia blooms. Note bare patches to fix.`;
  else if (phase === "spring") out.weeds = todayNum <= season.lf + 14 ? `Now through about ${date(season.lf + 14)} is the window for crabgrass preventer (skip it where you'll seed). Pull dandelions while they're young.` : "Pull or spot-treat dandelions and clover after a rain, when roots slide out. Thick, tall grass is the best weed control.";
  else if (phase === "summer") out.weeds = "Pull weeds after rain or watering, and spot-treat only what you can't pull. Don't use weed-and-feed in the heat; it burns the lawn.";
  else out.weeds = `Fall is the best time to beat dandelions, clover and other broadleaf weeds: they're pulling food down to their roots. ${warm || todayNum > season.ff - 45 ? "" : `Overseed thin spots by about ${date(season.ff - 45)}.`}`.trim();
  // Feeding.
  if (warm) out.feed = phase === "spring" ? `Feed once it's fully green, around ${date(season.lf + 30)}, then again in midsummer. Not in fall.` : phase === "summer" ? "A light summer feed keeps it thick; water it in." : "No feeding now: it's slowing down for winter.";
  else out.feed = phase === "fall" ? (todayNum < season.ff - 14 ? `This is the big feed of the year: once now and a lighter one around ${date(season.ff - 14)}.` : "If you haven't yet, give it one last light feed now, before the ground freezes. Then nothing until spring.") : phase === "spring" ? "A light feed in late spring is plenty; the main feeding is in fall." : phase === "summer" ? "Hold off on feeding in summer heat; save it for fall." : "No feeding until spring.";
  return out;
}

/** Square meters of a ground object (rectangle or oval). */
export const areaOf = o => (o.round ? (Math.PI * o.w * o.d) / 4 : o.w * o.d);
