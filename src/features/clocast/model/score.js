// How good each forecast hour is for a given activity, and the advice that
// goes with a planned session. Plain functions, testable in Node.

import { clothingNeed } from "./thermal.js";
import { heatIndex, planOutfit } from "./plan.js";

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const isStorm = code => code >= 95;
const isSnow = code => (code >= 71 && code <= 77) || code === 85 || code === 86;

export function scoreLabel(score) {
  if (score >= 80) return { label: "Great", tone: "great" };
  if (score >= 60) return { label: "Good", tone: "good" };
  if (score >= 40) return { label: "Fair", tone: "fair" };
  return { label: "Poor", tone: "poor" };
}

// Heat index above which this effort starts to feel hot, °C. Harder work
// makes more heat, so the threshold drops.
export function heatThreshold(mets) {
  return clamp(29 - 1.3 * (mets - 1.5), 17, 29);
}

/**
 * Scores one hour 0–100 for an activity and lists what pulled it down.
 * hour: a forecast hour (optionally with aqi). place: { latitude, longitude }.
 */
export function scoreHour(hour, place, activity, options = {}) {
  const need = clothingNeed({ ...hour, latitude: place.latitude, longitude: place.longitude }, activity, options);
  const factors = [];
  const add = (kind, penalty, text) => {
    if (penalty > 0.5) factors.push({ kind, penalty, text });
  };
  const vigorous = activity.mets >= 6;
  const code = hour.code ?? 0;

  add("cold", clamp((need.clo - 0.7) * 25, 0, 50), "cold for this activity");
  const hi = heatIndex(hour.temp, hour.rh ?? 50) + (options.shaded ? 0 : need.sunBoost * 0.15);
  add("heat", clamp((hi - heatThreshold(activity.mets)) * 4, 0, 60), "hot for this effort");

  const rainChance = hour.precipProb ?? 0;
  add(
    isSnow(code) ? "snow" : "rain",
    rainChance >= 20 ? rainChance * 0.35 + ((hour.precip ?? 0) >= 0.5 ? 10 : 0) : 0,
    isSnow(code) ? "snow likely" : "rain likely"
  );
  if (isStorm(code)) add("storm", 50, "thunderstorms");

  if (Number.isFinite(hour.aqi) && hour.aqi > 50) {
    add("air", clamp((hour.aqi - 50) * (vigorous ? 0.5 : 0.3), 0, 60), "poor air quality");
  }
  if (!options.shaded && (hour.uv ?? 0) >= 6) add("uv", clamp((hour.uv - 5) * 3, 0, 20), "strong UV");
  const windLimit = activity.id?.startsWith("bike") ? 6 : 8;
  add("wind", clamp(((hour.wind ?? 0) - windLimit) * 4, 0, 25), "windy");
  if (!hour.isDay) add("dark", activity.mets < 2 ? 4 : 12, "after dark");

  const score = Math.round(clamp(100 - factors.reduce((sum, f) => sum + f.penalty, 0), 0, 100));
  factors.sort((a, b) => b.penalty - a.penalty);
  return { score, ...scoreLabel(score), factors, need, heatIndex: hi };
}

// Factors big enough to mention to someone.
export function notableFactors(result, count = 3) {
  return result.factors.filter(f => f.penalty >= 5).slice(0, count);
}

/**
 * Scores a stretch of hours: the average, held back by its worst hour so
 * a storm in the middle can't hide behind good hours either side.
 */
export function scoreWindow(window, place, activity, options = {}) {
  if (!window.length) return null;
  const hours = window.map(hour => ({ hour, ...scoreHour(hour, place, activity, options) }));
  const mean = hours.reduce((sum, h) => sum + h.score, 0) / hours.length;
  const worst = Math.min(...hours.map(h => h.score));
  const score = Math.round(0.75 * mean + 0.25 * worst);
  const kinds = new Map();
  for (const h of hours) for (const f of h.factors) {
    if (!kinds.has(f.kind) || kinds.get(f.kind).penalty < f.penalty) kinds.set(f.kind, f);
  }
  return {
    score,
    ...scoreLabel(score),
    hours,
    factors: [...kinds.values()].sort((a, b) => b.penalty - a.penalty),
  };
}

/**
 * Candidate start times on one day, best first. hours: the forecast;
 * day: YYYY-MM-DD; duration in hours; earliest/latest bound the start and
 * end (local hours). notBefore (ms) skips hours that have passed.
 */
export function rankStarts(hours, place, activity, { day, duration = 1, earliest = 6, latest = 21, notBefore = 0, options = {} }) {
  const dayHours = hours.filter(h => h.localDay === day && h.time.getTime() + 3600000 > notBefore);
  const results = [];
  for (let i = 0; i < dayHours.length; i++) {
    const start = dayHours[i];
    if (start.localHour < earliest || start.localHour + duration > latest + 1) continue;
    const window = dayHours.slice(i, i + duration);
    if (window.length < duration || window[window.length - 1].localHour !== start.localHour + duration - 1) continue;
    results.push({ startHour: start.localHour, window, ...scoreWindow(window, place, activity, options) });
  }
  return results.sort((a, b) => b.score - a.score || a.startHour - b.startHour);
}

// Plain-language reasons one time beats another.
export function compareWindows(better, worse, formatTemp) {
  const avg = (rows, key) => rows.reduce((sum, r) => sum + (r.hour[key] ?? 0), 0) / rows.length;
  const reasons = [];
  const dt = avg(worse.hours, "temp") - avg(better.hours, "temp");
  const worseKinds = new Set(worse.factors.map(f => f.kind));
  if (worseKinds.has("heat") && dt >= 2) reasons.push(`${formatTemp(dt, { delta: true })} cooler`);
  if (worseKinds.has("cold") && dt <= -2) reasons.push(`${formatTemp(-dt, { delta: true })} warmer`);
  const rainB = Math.max(...better.hours.map(r => r.hour.precipProb ?? 0));
  const rainW = Math.max(...worse.hours.map(r => r.hour.precipProb ?? 0));
  if (rainW - rainB >= 20) reasons.push(`${rainB}% rain chance instead of ${rainW}%`);
  const aqiB = avg(better.hours, "aqi");
  const aqiW = avg(worse.hours, "aqi");
  if (aqiW - aqiB >= 15 && aqiW > 50) reasons.push(`cleaner air (AQI ${Math.round(aqiB)} vs ${Math.round(aqiW)})`);
  const uvB = Math.max(...better.hours.map(r => r.hour.uv ?? 0));
  const uvW = Math.max(...worse.hours.map(r => r.hour.uv ?? 0));
  if (uvW >= 6 && uvW - uvB >= 2) reasons.push(`lower UV (${Math.round(uvB)} vs ${Math.round(uvW)})`);
  if (worseKinds.has("dark") && !better.factors.some(f => f.kind === "dark")) reasons.push("in daylight");
  if (worseKinds.has("storm") && !better.factors.some(f => f.kind === "storm")) reasons.push("no thunderstorms");
  return reasons;
}

/**
 * Everything to tell someone about a planned session: the outfit, sun,
 * air, water, rain and light. formatTemp(c, { delta }) formats °C.
 */
export function sessionAdvice(window, place, activity, options = {}) {
  const formatTemp = options.formatTemp ?? (c => `${Math.round(c)}°C`);
  const outfit = planOutfit(window, place, activity, { ...options, formatTemp: c => formatTemp(c) });
  const tips = [];
  const minutes = window.length * 60;
  const uv = Math.max(...window.map(h => h.uv ?? 0));
  const aqiValues = window.map(h => h.aqi).filter(Number.isFinite);
  const aqi = aqiValues.length ? Math.max(...aqiValues) : null;
  const active = activity.mets >= 5;
  const hi = Math.max(...window.map(h => heatIndex(h.temp, h.rh ?? 50)));

  if (uv >= 3 && !options.shaded) {
    const spf = uv >= 8 ? 50 : 30;
    const every = active ? "every 80 minutes and after heavy sweating" : "every 2 hours";
    tips.push({
      kind: "sun",
      tone: uv >= 8 ? "warn" : "info",
      text: `UV peaks at ${Math.round(uv)}. Use broad-spectrum SPF ${spf}+ on all exposed skin 15 minutes before you go, and reapply ${every}.`,
    });
  }

  if (aqi != null && aqi > 50) {
    const text =
      aqi > 150
        ? `Air quality is unhealthy (AQI ${Math.round(aqi)}). Move this indoors or reschedule if you can.`
        : aqi > 100
          ? `Air quality is unhealthy for sensitive groups (AQI ${Math.round(aqi)}). ${active ? "Keep the effort easy, or train indoors" : "Limit long or hard exertion"} if you have asthma or heart or lung conditions.`
          : `Air quality is moderate (AQI ${Math.round(aqi)}). Fine for most people; unusually sensitive people may want an easier effort.`;
    tips.push({ kind: "air", tone: aqi > 100 ? "warn" : "info", text });
  }

  if (active && minutes >= 45) {
    tips.push({
      kind: "water",
      tone: "info",
      text: hi >= 27
        ? "Drink about 0.5–1 L (16–32 oz) per hour, and add electrolytes for sessions over an hour."
        : "Drink about 0.4–0.8 L (14–27 oz) per hour.",
    });
  }

  if (active && hi >= heatThreshold(activity.mets) + 4) {
    tips.push({ kind: "heat", tone: "warn", text: "It'll be hot for this effort. Slow your pace, plan shade breaks, and stop if you feel dizzy or stop sweating." });
  }

  const wetHour = window.find(h => (h.precipProb ?? 0) >= 50);
  if (wetHour) {
    tips.push({ kind: "rain", tone: "info", text: `Rain is likely from about ${hourName(wetHour.localHour)}.` });
  }

  const dark = window.filter(h => !h.isDay);
  if (dark.length && activity.mets >= 2) {
    tips.push({ kind: "dark", tone: "info", text: "Part of this is after dark. Wear something bright or reflective and bring a light." });
  }

  return { outfit, tips };
}

function hourName(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}
