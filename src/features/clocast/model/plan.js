import { outfitLadders } from "../data/garments.js";
import { RESTING } from "../data/activities.js";
import { clothingNeed } from "./thermal.js";

// Environment Canada wind chill, °C. Wind in km/h at 10 m.
export function windChill(tempC, windKmh) {
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const v = windKmh ** 0.16;
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

// US National Weather Service heat index, °C.
export function heatIndex(tempC, rh) {
  const t = (tempC * 9) / 5 + 32;
  let hi = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if (hi >= 80) {
    hi =
      -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t -
      0.05481717 * rh * rh + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    else if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return ((hi - 32) * 5) / 9;
}

const isRainCode = code => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
const isSnowCode = code => (code >= 71 && code <= 77) || code === 85 || code === 86;
const isStormCode = code => code >= 95;

// How far under the required insulation an outfit may fall and still count.
const SLACK = 0.04;

export function pickOutfit(need, wardrobe) {
  const ladder = outfitLadders[wardrobe] ?? outfitLadders.everyday;
  const found = ladder.find(outfit => outfit.clo >= need - SLACK);
  return found ? { ...found, short: 0 } : { ...ladder[ladder.length - 1], short: need - ladder[ladder.length - 1].clo };
}

/**
 * Works out what to wear for a stretch of hours.
 *
 * hours: [{ time: Date, temp °C, apparent, rh, wind m/s, gust, precipProb,
 *           precip mm, code, uv, isDay, directNormal, diffuse, global }]
 * place: { latitude, longitude }
 * activity: an entry from data/activities.js
 * options: { profile, tolerance, shaded, formatTemp }
 */
export function planOutfit(hours, place, activity, options = {}) {
  if (!hours.length) return null;
  const wardrobe = activity.wardrobe;
  const formatTemp = options.formatTemp ?? (c => `${Math.round(c)}°C`);

  const rows = hours.map(hour => {
    const weather = { ...hour, latitude: place.latitude, longitude: place.longitude };
    const need = clothingNeed(weather, activity, options);
    const resting = activity.mets >= 4 ? clothingNeed(weather, RESTING, options) : need;
    const travelKmh = (activity.speed ?? 0) * 3.6;
    const chill = windChill(hour.temp, (hour.wind ?? 0) * 3.6 + travelKmh);
    return { ...hour, need, resting, chill, outfit: pickOutfit(need.clo, wardrobe) };
  });

  const coldest = rows.reduce((a, b) => (b.need.clo > a.need.clo ? b : a));
  const warmest = rows.reduce((a, b) => (b.need.clo < a.need.clo ? b : a));
  const outfit = coldest.outfit;
  const lighter = warmest.outfit.level < outfit.level ? warmest : null;

  const temps = rows.map(r => r.temp);
  const summary = {
    low: Math.min(...temps),
    high: Math.max(...temps),
    feelsLow: Math.min(...rows.map(r => r.apparent ?? r.temp)),
    feelsHigh: Math.max(...rows.map(r => r.apparent ?? r.temp)),
    wind: Math.max(...rows.map(r => r.wind ?? 0)),
    gust: Math.max(...rows.map(r => r.gust ?? 0)),
    rainChance: Math.max(...rows.map(r => r.precipProb ?? 0)),
    rain: rows.reduce((total, r) => total + (r.precip ?? 0), 0),
    uv: Math.max(...rows.map(r => r.uv ?? 0)),
    chill: Math.min(...rows.map(r => r.chill)),
    heat: Math.max(...rows.map(r => heatIndex(r.temp, r.rh ?? 50))),
  };

  const extras = [];
  const warnings = [];
  const active = activity.mets >= 5;
  const fast = (activity.speed ?? 0) >= 4;
  const anyCode = test => rows.some(r => test(r.code ?? 0));
  const daylight = rows.some(r => r.isDay);

  // Head and hands lose heat quickly; they follow wind chill, not the
  // whole-body balance. Moving faster or working harder pushes it later.
  const headAt = active ? -2 : fast ? 4 : 5;
  const handsAt = active ? 0 : fast ? 8 : 5;
  if (summary.chill <= -15) {
    extras.push({ kind: "hat", text: active ? "Thermal hat or balaclava" : "Warm hat and a neck gaiter or scarf" });
    extras.push({ kind: "gloves", text: "Insulated mittens or lobster gloves" });
  } else {
    if (summary.chill <= headAt) extras.push({ kind: "hat", text: active ? "Light beanie or ear band" : "Beanie" });
    if (summary.chill <= handsAt) extras.push({ kind: "gloves", text: active || fast ? "Light gloves" : "Gloves" });
  }

  const wet = summary.rainChance >= 40 || summary.rain >= 0.5 || anyCode(isRainCode);
  if (anyCode(isSnowCode) && summary.low <= 2) {
    extras.push({ kind: "snow", text: "Waterproof outer layer for the snow" });
  } else if (wet) {
    extras.push({
      kind: "rain",
      text: active || fast || summary.wind > 8 ? "Waterproof shell that packs small" : "Rain jacket or umbrella",
    });
  }
  if (rows.some(r => r.need.windproofHelps) && !wet) {
    extras.push({ kind: "wind", text: "Make the outer layer windproof" });
  }
  if (summary.uv >= 3) extras.push({ kind: "sun", text: summary.uv >= 6 ? "Sunscreen, a brimmed hat, sunglasses" : "Sunscreen" });
  else if (daylight && rows.some(r => (r.directNormal ?? 0) > 400)) extras.push({ kind: "sun", text: "Sunglasses" });
  if (active && (summary.heat >= 27 || rows.length >= 2)) extras.push({ kind: "water", text: "Water" });

  // A big gap between moving and stopping means a layer to throw on.
  const restGap = Math.max(...rows.map(r => r.resting.clo - r.need.clo));
  if (active && restGap >= 0.6) {
    warnings.push({
      tone: "info",
      text: "You'll cool down fast when you stop. Bring a warm layer to throw on for breaks and afterwards.",
    });
  }

  if (outfit.short > 0.3) {
    warnings.push({
      tone: "danger",
      text: "Even the warmest outfit here falls short at this activity level. Keep time outside short, keep moving, or find shelter.",
    });
  }
  if (summary.chill <= -28) {
    warnings.push({
      tone: "danger",
      text:
        summary.chill <= -40
          ? "Exposed skin can freeze in under 10 minutes. Cover every bit of skin."
          : "Frostbite risk on exposed skin within 30 minutes. Cover your face, ears, and hands.",
    });
  }
  if (summary.heat >= 32) {
    warnings.push({
      tone: summary.heat >= 39 ? "danger" : "warn",
      text: `Heat index reaches ${formatTemp(summary.heat)}. Wear loose, light-colored clothing, take shade breaks, and drink often.`,
    });
  } else if (rows.some(r => r.temp >= 18 && r.need.clo === 0 && r.need.minimalFeel > 1)) {
    warnings.push({ tone: "warn", text: "You'll be warm even in the lightest clothes. Pick thin, breathable fabric and expect to sweat." });
  }
  if (anyCode(isStormCode)) warnings.push({ tone: "warn", text: "Thunderstorms are possible. Have a plan to get indoors." });
  if (summary.gust >= 17) warnings.push({ tone: "warn", text: "Strong gusts. Umbrellas won't hold up; a hood will." });

  return { rows, outfit, lighter, coldest, warmest, summary, extras, warnings, wardrobe };
}
