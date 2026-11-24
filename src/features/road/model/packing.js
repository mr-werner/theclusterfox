// What to pack for a road trip, from the weather where you'll be staying.
// Each stay is a place and a number of nights. Within about two weeks the
// weather is Open-Meteo's forecast; further out it's what those same dates
// were like over the last few years (Open-Meteo's archive), which is a good
// guide to what's normal there at that time of year.
//
// Days are { hi, lo } in °F, rain (0-100, the chance of rain or how often it
// rained on that date), snow (true when snow is likely) and code (WMO).

import { addDays } from "../state/roadStore.js";

export const FORECAST_DAYS = 15; // Open-Meteo forecasts 16 days, today included
export const MAX_STAYS = 6;
export const MAX_NIGHTS = 30;
export const LAUNDRY_EVERY = 7; // pack for a week and wash after that

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

const dayMs = day => Date.parse(`${day}T00:00:00Z`);
export const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400000);

/** Every "YYYY-MM-DD" from start through end. */
export function dateRange(start, end) {
  const out = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Each stay with its dates. The first one starts on `arrive` (the day you
 * reach the trip's end) and each next one starts the day you leave the last.
 * stays: [{ id, place, nights }] -> [{ ...stay, arrive, leave, dates }]
 */
export function scheduleStays(stays, arrive) {
  let at = arrive;
  return stays.map(s => {
    const nights = Math.max(1, Math.min(MAX_NIGHTS, Math.round(s.nights) || 1));
    const leave = addDays(at, nights);
    const out = { ...s, nights, arrive: at, leave, dates: dateRange(at, leave) };
    at = leave;
    return out;
  });
}

/** "forecast" when every date is within the forecast, otherwise "typical". */
export function weatherSource(dates, today) {
  if (!dates.length) return "typical";
  const last = dates[dates.length - 1];
  return daysBetween(today, dates[0]) >= -1 && daysBetween(today, last) <= FORECAST_DAYS ? "forecast" : "typical";
}

/** The same dates `yearsBack` years earlier (Feb 29 becomes Feb 28). */
export function shiftYears(day, yearsBack) {
  const [y, m, d] = day.split("-").map(Number);
  const md = m === 2 && d === 29 ? "02-28" : `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return `${y - yearsBack}-${md}`;
}

/** Open-Meteo forecast body -> { "YYYY-MM-DD": day }. */
export function parseForecastDays(body) {
  const d = body?.daily ?? {};
  const out = {};
  (d.time ?? []).forEach((t, i) => {
    const hi = d.temperature_2m_max?.[i];
    const lo = d.temperature_2m_min?.[i];
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return;
    const code = d.weather_code?.[i] ?? null;
    const rain = Number.isFinite(d.precipitation_probability_max?.[i]) ? d.precipitation_probability_max[i] : RAIN_CODES.has(code) ? 60 : 0;
    out[t] = { hi, lo, rain, snow: SNOW_CODES.has(code) || (d.snowfall_sum?.[i] ?? 0) > 0.5, code };
  });
  return out;
}

/**
 * Several years of archive bodies for the same calendar dates -> one
 * typical day per date: average highs and lows, and how often it rained or
 * snowed. `dates` are this trip's dates, in the order the archive returns them.
 */
export function typicalDays(bodies, dates) {
  const out = {};
  dates.forEach((date, i) => {
    const his = [];
    const los = [];
    let wet = 0;
    let snowy = 0;
    let years = 0;
    for (const b of bodies) {
      const d = b?.daily;
      const hi = d?.temperature_2m_max?.[i];
      const lo = d?.temperature_2m_min?.[i];
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;
      years += 1;
      his.push(hi);
      los.push(lo);
      if ((d.precipitation_sum?.[i] ?? 0) >= 1) wet += 1;
      if ((d.snowfall_sum?.[i] ?? 0) >= 0.5 || SNOW_CODES.has(d.weather_code?.[i])) snowy += 1;
    }
    if (!years) return;
    const avg = list => list.reduce((s, v) => s + v, 0) / list.length;
    out[date] = { hi: avg(his), lo: avg(los), rain: Math.round((wet / years) * 100), snow: snowy / years >= 0.34, code: null };
  });
  return out;
}

/** Highs, lows and wet days over one stay's days. */
export function summarize(days) {
  if (!days.length) return null;
  const his = days.map(d => d.hi);
  const los = days.map(d => d.lo);
  return {
    hiMax: Math.max(...his),
    hiMin: Math.min(...his),
    loMin: Math.min(...los),
    loMax: Math.max(...los),
    rainyDays: days.filter(d => d.rain >= 40).length,
    snowDays: days.filter(d => d.snow).length,
    days: days.length,
  };
}

/** A few words on what it'll feel like. */
export function feel(s) {
  if (!s) return "";
  const mid = (s.hiMax + s.hiMin) / 2;
  const base = mid >= 88 ? "Hot" : mid >= 76 ? "Warm" : mid >= 62 ? "Mild" : mid >= 48 ? "Cool" : mid >= 34 ? "Cold" : "Freezing";
  const nights = s.loMin < 32 && mid >= 48 ? " with freezing nights" : s.loMin < 50 && mid >= 70 ? " with cool evenings" : "";
  const wet = s.snowDays ? `, snow likely` : s.rainyDays >= Math.max(2, s.days / 2) ? ", often rainy" : s.rainyDays ? ", a chance of rain" : "";
  return `${base}${nights}${wet}`;
}

const names = list => {
  const unique = [...new Set(list)];
  return unique.length <= 2 ? unique.join(" and ") : `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
};

/**
 * Days away: the drive there (arriving on the last driving day), each
 * night you stay, and the drive back if there is one (starting the day you
 * leave the last place).
 */
export function tripLength(driveDays, nights, roundTrip) {
  const drive = Math.max(1, Math.round(driveDays) || 1);
  return drive + nights.reduce((n, v) => n + v, 0) + (roundTrip ? drive - 1 : 0);
}

/**
 * The packing list. stays: [{ name, days: [day] }]; driveDays: days in the
 * car (both ways if you're driving back); totalDays: days away. Returns
 * { days, laundry, groups } with groups [{ id, title, items: [{ id, name, qty, why }] }].
 */
export function packingList(stays, { driveDays = 1, totalDays: total } = {}) {
  const all = stays.flatMap(s => s.days.map(d => ({ ...d, where: s.name })));
  const totalDays = Math.max(1, Math.round(total ?? driveDays));
  const per = Math.min(totalDays, LAUNDRY_EVERY);
  const laundry = totalDays > LAUNDRY_EVERY;
  const groups = { wear: [], layers: [], weather: [], feet: [], extras: [] };
  const add = (group, id, name, qty, why) => groups[group].push({ id, name, qty, why });
  const where = test => names(all.filter(test).map(d => d.where));
  const deg = v => `${Math.round(v)}°`;

  if (!all.length) {
    // No weather yet: the basics for the number of days.
    add("wear", "tops", "Tops", per, "One a day");
    add("wear", "bottoms", "Pants or shorts", Math.max(1, Math.ceil(per / 2)), "Most can be worn twice");
    add("wear", "underwear", "Underwear", per + 1, "One a day, plus a spare");
    add("wear", "socks", "Socks", per + 1, "One pair a day, plus a spare");
    add("wear", "sleep", "Sleepwear", 1, "");
    add("layers", "hoodie", "Sweatshirt or hoodie", 1, "For the car and cool evenings");
    add("feet", "walking-shoes", "Comfortable walking shoes", 1, "");
    return finish(groups, totalDays, laundry);
  }

  const hiMax = Math.max(...all.map(d => d.hi));
  const hiMin = Math.min(...all.map(d => d.hi));
  const loMin = Math.min(...all.map(d => d.lo));
  const share = test => all.filter(test).length / all.length;
  const hot = d => d.hi >= 80;
  const warm = d => d.hi >= 68;
  const wet = d => d.rain >= 40;

  // Clothes for each day, split by how warm the days are.
  const warmShare = share(warm);
  const tees = Math.round(per * warmShare);
  const longs = per - tees;
  if (tees) add("wear", "tees", hiMax >= 88 ? "T-shirts or tank tops (light, breathable)" : "T-shirts", tees, `Highs up to ${deg(hiMax)}${warmShare < 1 ? ` in ${where(warm)}` : ""}`);
  if (longs) add("wear", "long-sleeves", "Long-sleeve shirts", longs, `Highs only ${deg(hiMin)} in ${where(d => !warm(d))}`);
  const shortsShare = share(d => d.hi >= 75);
  const shorts = shortsShare ? Math.max(1, Math.round((per * shortsShare) / 2)) : 0;
  const pants = shortsShare < 1 || loMin < 60 ? Math.max(1, Math.round((per * (1 - shortsShare)) / 2)) : 0;
  if (shorts) add("wear", "shorts", "Shorts", shorts, `Days in the upper 70s or warmer in ${where(d => d.hi >= 75)}`);
  if (pants) add("wear", "pants", hiMin < 45 ? "Warm pants or jeans" : "Pants or jeans", pants, shortsShare < 1 ? `Cooler days in ${where(d => d.hi < 75)}` : `For evenings down to ${deg(loMin)}`);
  add("wear", "underwear", "Underwear", per + 1, "One a day, plus a spare");
  add("wear", "socks", loMin < 40 ? "Socks (some warm wool ones)" : "Socks", per + 1, loMin < 40 ? `Lows down to ${deg(loMin)}` : "One pair a day, plus a spare");
  add("wear", "sleep", loMin < 45 ? "Warm sleepwear" : "Sleepwear", laundry ? 2 : 1, loMin < 45 ? `Nights down to ${deg(loMin)}` : "");
  if (driveDays >= 1) add("wear", "drive", "A comfy outfit for drive days", 1, `${Math.round(driveDays)} day${driveDays >= 2 ? "s" : ""} in the car`);

  // Layers, from a light hoodie to a winter coat.
  const coldest = d => d.lo === loMin;
  if (loMin < 65) add("layers", "hoodie", loMin < 50 ? "Sweater or fleece" : "Sweatshirt or hoodie", 1, `Evenings down to ${deg(loMin)} in ${where(coldest)}`);
  if (loMin < 55 && hiMin >= 45) add("layers", "jacket", "Light jacket", 1, `Cool mornings and nights in ${where(d => d.lo < 55)}`);
  if (hiMin < 45) add("layers", "coat", hiMin < 30 ? "Insulated winter coat" : "Warm coat", 1, `Highs only ${deg(hiMin)} in ${where(d => d.hi < 45)}`);
  if (hiMin < 35) add("layers", "thermals", "Thermal base layers (top and bottom)", Math.min(2, Math.ceil(per / 3)), `Below-freezing days in ${where(d => d.hi < 35)}`);
  if (loMin < 35) add("layers", "hat-gloves", "Warm hat and gloves", 1, `Lows down to ${deg(loMin)}`);
  if (hiMin < 32) add("layers", "scarf", "Scarf or neck gaiter", 1, `Highs below freezing in ${where(d => d.hi < 32)}`);

  // Rain, snow and sun.
  const rainy = all.filter(wet);
  const snowy = all.filter(d => d.snow);
  if (rainy.length) add("weather", "rain-jacket", "Rain jacket", 1, `Rain likely on ${rainy.length} day${rainy.length > 1 ? "s" : ""} in ${where(wet)}`);
  if (rainy.length >= 2) add("weather", "umbrella", "Compact umbrella", 1, "For walking around town on wet days");
  if (snowy.length) add("weather", "snow-pants", "Snow pants (if you'll be out in it)", 1, `Snow likely in ${where(d => d.snow)}`);
  if (hiMax >= 65) add("weather", "sunglasses", "Sunglasses", 1, "Bright days, and glare on the road");
  if (hiMax >= 72) add("weather", "sunscreen", "Sunscreen", 1, `Highs up to ${deg(hiMax)}`);
  if (all.some(hot)) add("weather", "sun-hat", "Sun hat or cap", 1, `Hot days in ${where(hot)}`);
  if (all.some(d => d.hi >= 82)) add("weather", "swimsuit", "Swimsuit", 1, `For a pool or lake in ${where(d => d.hi >= 82)}`);

  // Shoes.
  if (snowy.length || hiMin < 30) add("feet", "boots", "Insulated waterproof boots", 1, snowy.length ? `Snow in ${where(d => d.snow)}` : "Icy, below-freezing days");
  else if (rainy.length >= Math.max(2, all.length / 3)) add("feet", "waterproof-shoes", "Waterproof shoes", 1, `Several wet days in ${where(wet)}`);
  add("feet", "walking-shoes", "Comfortable walking shoes", 1, "For stops along the way and exploring");
  if (all.some(d => d.hi >= 78)) add("feet", "sandals", "Sandals or flip-flops", 1, "For warm days and the hotel pool");

  // Small things the weather calls for.
  if (all.some(hot)) add("extras", "water-bottle", "Refillable water bottle", 1, `Highs up to ${deg(hiMax)}: drink more than you think`);
  if (loMin < 40) add("extras", "lip-balm", "Lip balm and lotion", 1, "Cold air is dry on skin");
  if (snowy.length || loMin < 25) add("extras", "car-kit", "Ice scraper and a blanket in the car", 1, "In case of a cold start or a slow road");
  if (laundry) add("extras", "laundry", "Laundry bag and a few detergent pods", 1, `Packing for ${LAUNDRY_EVERY} days and washing once over ${totalDays} days`);

  return finish(groups, totalDays, laundry);
}

const TITLES = { wear: "Clothes", layers: "Layers", weather: "Rain, snow and sun", feet: "Shoes", extras: "Don't forget" };

function finish(groups, days, laundry) {
  return {
    days,
    laundry,
    groups: Object.entries(groups)
      .filter(([, items]) => items.length)
      .map(([id, items]) => ({ id, title: TITLES[id], items })),
  };
}
