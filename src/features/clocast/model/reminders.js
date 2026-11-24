// Daily reminders: the small things worth remembering before heading out
// (sunscreen, sunglasses, an umbrella, what to wear, the air). People pick
// which ones they want in SkyFox, and TaskFox shows them on each day.
// Plain functions, testable in Node.

import { activitiesById } from "../data/activities.js";
import { garments } from "../data/garments.js";
import { heatIndex, planOutfit } from "./plan.js";
import { formatHour, formatTemp, formatWind } from "../units.js";

/** Every reminder someone can switch on, in the order they show. */
export const REMINDERS = [
  { id: "sunscreen", name: "Sunscreen", hint: "When the UV index reaches 3", on: true },
  { id: "sunglasses", name: "Sunglasses", hint: "Bright sun, low sun on the drive, snow glare", on: true },
  { id: "clothing", name: "What to wear", hint: "The outfit for the day out and about", on: true },
  { id: "air", name: "Air quality", hint: "When the air turns unhealthy", on: true },
  { id: "umbrella", name: "Umbrella", hint: "When rain or snow is likely", on: true },
  { id: "heat", name: "Heat and water", hint: "When it feels like 90°F (32°C) or more", on: false },
  { id: "frost", name: "Frost and ice", hint: "Scraping the windshield, icy steps", on: false },
  { id: "wind", name: "Wind", hint: "Gusts over 30 mph (50 km/h)", on: false },
  { id: "bugs", name: "Bug spray", hint: "Warm, humid, still evenings", on: false },
  { id: "daylight", name: "Sunset", hint: "When it gets dark, for evening walks", on: false },
];

export const REMINDER_IDS = REMINDERS.map(r => r.id);
export const remindersById = new Map(REMINDERS.map(r => [r.id, r]));

/** The settings someone starts with. */
export function defaultReminderSettings() {
  return { on: REMINDERS.filter(r => r.on).map(r => r.id), airSensitive: false, showFirst: false };
}

/** Cleans a stored reminder setting, falling back to the defaults. */
export function normalizeReminderSettings(value) {
  const base = defaultReminderSettings();
  if (!value || typeof value !== "object") return base;
  return {
    on: Array.isArray(value.on) ? REMINDER_IDS.filter(id => value.on.includes(id)) : base.on,
    airSensitive: value.airSensitive === true,
    // Open the full reminders when SkyFox opens, instead of the notification.
    showFirst: value.showFirst === true,
  };
}

const AWAKE_FROM = 7;
const AWAKE_TO = 21;
const isSnowCode = code => (code >= 71 && code <= 77) || code === 85 || code === 86;
const range = (from, to) => `${formatHour(from)}–${formatHour((to + 1) % 24)}`;
const sunTime = t => `${t.hour % 12 || 12}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}`;
const plusMinutes = (t, minutes) => {
  const total = t.hour * 60 + t.minute + minutes;
  return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
};

// First and last hour of a test passing, among hours in order.
function span(hours, test) {
  const passing = hours.filter(test);
  if (!passing.length) return null;
  return [passing[0].localHour, passing[passing.length - 1].localHour];
}

const peak = (rows, key) => rows.reduce((a, b) => ((b[key] ?? -Infinity) > (a[key] ?? -Infinity) ? b : a));

/**
 * The reminders for one day, for the ones switched on.
 *
 * hours: forecast hours (from openMeteo.fetchForecast, optionally with aqi
 *        joined on); days: its daily list; day: "YYYY-MM-DD".
 * settings: { on: [ids], airSensitive }. place: { latitude, longitude }.
 * options: { units, profile, tolerance, notBefore (ms, skip hours gone) }.
 *
 * Returns [{ id, tone: "info" | "caution" | "warn", title, text }].
 */
export function dayReminders({ hours = [], days = [], day, settings, place = null, units = "us", profile, tolerance, notBefore = 0 }) {
  const { on, airSensitive } = normalizeReminderSettings(settings);
  if (!on.length) return [];
  const all = hours.filter(h => h.localDay === day);
  const later = notBefore ? all.filter(h => h.time.getTime() + 3600_000 > notBefore) : all;
  const awake = later.filter(h => h.localHour >= AWAKE_FROM && h.localHour <= AWAKE_TO);
  if (!awake.length) return [];
  const daily = days.find(d => d.day === day) ?? null;
  const temp = (c, opts) => formatTemp(c, units, opts);
  const out = [];
  const add = (id, tone, title, text) => out.push({ id, tone, title, text });

  for (const id of on) {
    if (id === "sunscreen") {
      const strong = span(awake, h => (h.uv ?? 0) >= 3);
      if (!strong) continue;
      const top = peak(awake, "uv");
      const spf = top.uv >= 8 ? 50 : 30;
      add(
        id,
        top.uv >= 8 ? "warn" : top.uv >= 6 ? "caution" : "info",
        `Sunscreen ${range(...strong)}`,
        `UV peaks at ${Math.round(top.uv)} around ${formatHour(top.localHour)}. SPF ${spf}+ on exposed skin, and reapply every 2 hours you're out.`
      );
    }

    if (id === "sunglasses") {
      const bright = span(awake, h => h.isDay && ((h.uv ?? 0) >= 3 || (h.directNormal ?? 0) >= 400 || ((h.cloud ?? 100) <= 30 && (h.global ?? 0) >= 250)));
      // Low sun straight down the road: the first and last couple of
      // daylight hours, when the sky is clear enough for direct sun.
      const lit = awake.filter(h => h.isDay);
      const lowSun = lit.length
        ? [lit[0], lit[1], lit[lit.length - 2], lit[lit.length - 1]].filter(h => h && (h.directNormal ?? 0) >= 250)
        : [];
      const snowLately = days.some(d => d.day <= day && d.day >= shiftDay(day, -2) && isSnowCode(d.code) && (d.precip ?? 0) >= 2);
      const sunny = lit.some(h => (h.directNormal ?? 0) >= 300);
      if (!bright && !lowSun.length && !(snowLately && sunny)) continue;
      const parts = [];
      if (bright) parts.push(`Bright from ${range(...bright)}.`);
      if (lowSun.length) {
        const times = [...new Set(lowSun.map(h => formatHour(h.localHour)))];
        parts.push(`Low sun around ${times.length > 2 ? `${times[0]} and ${times[times.length - 1]}` : times.join(" and ")} can glare on the drive.`);
      }
      if (snowLately && sunny) parts.push("Sun on fresh snow is hard on the eyes; wear them even on short trips.");
      add(id, snowLately && sunny ? "caution" : "info", "Sunglasses", parts.join(" "));
    }

    if (id === "clothing" && place) {
      // Dress for the daylight still ahead; the evening gets its own note
      // when it needs a warmer outfit, so a cold night doesn't turn a warm
      // afternoon into a parka day.
      const window = later.filter(h => h.localHour >= 9 && h.localHour <= 18);
      const lit = window.filter(h => h.isDay);
      const rows = lit.length ? lit : window.length ? window : awake;
      const activity = activitiesById.get("errands");
      if (!activity) continue;
      const options = { profile, tolerance, formatTemp: temp };
      const plan = planOutfit(rows, place, activity, options);
      if (!plan) continue;
      const evening = awake.filter(h => !h.isDay && h.localHour >= 15);
      const night = rows === lit && evening.length ? planOutfit(evening, place, activity, options) : null;
      const eveningOutfit = night && night.outfit.level > plan.outfit.level ? night.outfit.name.toLowerCase() : null;
      const layers = plan.outfit.items
        .map(g => garments[g])
        .filter(g => g && !g.hidden && ["top", "outer", "legs"].includes(g.region))
        .map(g => g.name.toLowerCase());
      const bring = plan.extras.filter(e => e.kind !== "sun").map(e => e.text.toLowerCase());
      add(
        id,
        plan.warnings.some(w => w.tone === "danger" || w.tone === "warn") ? "caution" : "info",
        `Wear: ${plan.outfit.name.toLowerCase()}`,
        `${capitalize(layers.join(", "))}. Feels like ${temp(plan.summary.feelsLow)} to ${temp(plan.summary.feelsHigh)}${bring.length ? `. Bring ${bring.join(", ")}` : ""}.${eveningOutfit ? ` After dark it calls for ${eveningOutfit}, so take a warm layer if you'll be out late.` : ""}`
      );
    }

    if (id === "air") {
      const readings = awake.filter(h => Number.isFinite(h.aqi));
      if (!readings.length) continue;
      const worst = peak(readings, "aqi");
      const limit = airSensitive ? 50 : 100;
      if (worst.aqi <= limit) continue;
      const best = readings.reduce((a, b) => (b.aqi < a.aqi ? b : a));
      const bad = span(readings, h => h.aqi > limit);
      const level = worst.aqi > 200 ? "Very unhealthy" : worst.aqi > 150 ? "Unhealthy" : worst.aqi > 100 ? "Unhealthy for sensitive groups" : "Moderate";
      add(
        id,
        worst.aqi > 150 ? "warn" : "caution",
        `Air quality ${Math.round(worst.aqi)} around ${formatHour(worst.localHour)}`,
        `${level}${bad && bad[0] !== bad[1] ? ` from ${range(...bad)}` : ""}. ${best.aqi < worst.aqi - 10 ? `Cleanest air around ${formatHour(best.localHour)} (AQI ${Math.round(best.aqi)}). ` : ""}${worst.aqi > 150 ? "Keep hard exercise indoors and close windows." : "Take it easier outside if you have asthma or a heart or lung condition."}`
      );
    }

    if (id === "umbrella") {
      const wet = awake.filter(h => (h.precipProb ?? 0) >= 50 || (h.precip ?? 0) >= 0.5);
      if (!wet.length) continue;
      const snow = wet.some(h => isSnowCode(h.code ?? 0));
      const storm = wet.some(h => (h.code ?? 0) >= 95);
      const chance = Math.max(...awake.map(h => h.precipProb ?? 0));
      const total = awake.reduce((sum, h) => sum + (h.precip ?? 0), 0);
      const from = wet[0].localHour;
      const to = wet[wet.length - 1].localHour;
      add(
        id,
        storm || chance >= 80 ? "caution" : "info",
        snow ? `Snow likely from ${formatHour(from)}` : `Umbrella: ${storm ? "storms" : "rain"} likely from ${formatHour(from)}`,
        `Up to ${chance}% chance${from !== to ? ` between ${range(from, to)}` : ""}${total >= 1 ? `, about ${units === "metric" ? `${Math.round(total)} mm` : `${(total / 25.4).toFixed(2)} in`}` : ""}.${snow ? " Boots with grip and a warm, waterproof layer." : storm ? " Head indoors if you hear thunder." : ""}`
      );
    }

    if (id === "heat") {
      const feels = awake.map(h => ({ h, f: Math.max(h.apparent ?? h.temp, heatIndex(h.temp, h.rh ?? 50)) }));
      const hottest = feels.reduce((a, b) => (b.f > a.f ? b : a));
      if (hottest.f < 32) continue;
      const hot = span(feels.map(x => ({ ...x.h, f: x.f })), h => h.f >= 32);
      add(
        id,
        hottest.f >= 39 ? "warn" : "caution",
        `Hot: feels like ${temp(hottest.f)} at ${formatHour(hottest.h.localHour)}`,
        `${hot ? `Hottest ${range(...hot)}. ` : ""}Carry water and drink before you're thirsty, take shade breaks, and never leave kids or pets in the car.`
      );
    }

    if (id === "frost") {
      const early = all.filter(h => h.localHour >= 4 && h.localHour <= 9);
      const coldest = early.length ? early.reduce((a, b) => (b.temp < a.temp ? b : a)) : null;
      if (!coldest || coldest.temp > 1) continue;
      const wetBefore = all.some(h => h.localHour <= 9 && (h.precip ?? 0) > 0) || hours.some(h => h.localDay === shiftDay(day, -1) && h.localHour >= 15 && (h.precip ?? 0) > 0.2);
      add(
        id,
        wetBefore && coldest.temp <= 0 ? "warn" : "caution",
        wetBefore && coldest.temp <= 0 ? "Ice likely this morning" : `Frost likely this morning (low ${temp(coldest.temp)})`,
        wetBefore && coldest.temp <= 0
          ? "Wet surfaces freeze overnight. Watch steps, bridges and shaded roads, and leave time to scrape the windshield."
          : "Leave 5 extra minutes to scrape the windshield, and keep a scraper in the car."
      );
    }

    if (id === "wind") {
      const gusty = peak(awake, "gust");
      if ((gusty.gust ?? 0) < 13.4) continue;
      add(
        id,
        gusty.gust >= 20 ? "warn" : "caution",
        `Windy: gusts to ${formatWind(gusty.gust, units)}`,
        `Strongest around ${formatHour(gusty.localHour)}. Secure trash cans and patio things; a hood beats an umbrella.`
      );
    }

    if (id === "bugs") {
      const evening = later.filter(h => h.localHour >= 18 && h.localHour <= 21);
      const buggy = evening.filter(h => h.temp >= 18 && (h.rh ?? 0) >= 60 && (h.wind ?? 0) < 4 && (h.precipProb ?? 0) < 50);
      if (buggy.length < 2) continue;
      add(id, "info", "Bug spray this evening", `Warm, humid and calm from ${formatHour(buggy[0].localHour)}: mosquitoes will be out. Repellent with DEET, picaridin or oil of lemon eucalyptus.`);
    }

    if (id === "daylight" && daily?.sunset) {
      const dark = plusMinutes(daily.sunset, 30);
      add(id, "info", `Sunset at ${sunTime(daily.sunset)}`, `Dark by about ${sunTime(dark)}. Take a light or reflective layer for evening walks and runs.`);
    }
  }
  return out;
}

const capitalize = text => (text ? text[0].toUpperCase() + text.slice(1) : text);

function shiftDay(day, delta) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
