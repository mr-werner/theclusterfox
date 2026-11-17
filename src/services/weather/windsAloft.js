// Winds and temperatures aloft from Open-Meteo's pressure-level forecast
// (free, keyless, cross-origin). Shared by SkyFox's aviation view and any
// flight-planning app: the parsing and math here are plain functions that
// run in Node, and the fetch is the only part that needs a network.
//
// Aviation units throughout: knots, feet, degrees true (the direction the
// wind blows FROM), and °C.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const FT_PER_M = 3.28084;

/** Pressure levels fetched, surface to high cruise (about 360 ft to 38,600 ft). */
export const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

/** The altitudes a standard winds-aloft (FB/FD) forecast reports, in feet MSL. */
export const FD_ALTITUDES_FT = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

const LEVEL_FIELDS = ["wind_speed", "wind_direction", "temperature", "geopotential_height"];

const SURFACE = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "temperature_2m",
  "dew_point_2m",
  "surface_pressure",
  "pressure_msl",
  "freezing_level_height",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "cape",
  "is_day",
  "weather_code",
  "precipitation_probability",
];

/** Every hourly variable the request asks for. */
export function windsAloftVariables(levels = PRESSURE_LEVELS) {
  return [...SURFACE, ...levels.flatMap(hPa => LEVEL_FIELDS.map(field => `${field}_${hPa}hPa`))];
}

/**
 * Winds aloft, hourly from the current hour for `hours` hours (1 to 72).
 *
 * Pass one place { latitude, longitude } to get one profile back, or an
 * array of places (a route's waypoints, up to 50) to get an array of
 * profiles in the same order from a single request.
 */
export async function fetchWindsAloft(where, { signal, hours = 36, levels = PRESSURE_LEVELS } = {}) {
  const points = Array.isArray(where) ? where : [where];
  if (!points.length) return [];
  if (points.length > 50) throw new Error("Ask for 50 points or fewer at a time.");
  const params = new URLSearchParams({
    latitude: points.map(p => p.latitude.toFixed(4)).join(","),
    longitude: points.map(p => p.longitude.toFixed(4)).join(","),
    hourly: windsAloftVariables(levels).join(","),
    wind_speed_unit: "kn",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_hours: String(Math.min(72, Math.max(1, Math.round(hours)))),
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Winds aloft aren't available right now. Try again in a moment.");
  const body = await response.json();
  const profiles = (Array.isArray(body) ? body : [body]).map(item => parseWindsAloft(item, { levels }));
  return Array.isArray(where) ? profiles : profiles[0];
}

/** The hour in a profile closest to a time (Date or ms), or null. */
export function hourNearest(profile, when) {
  const target = when instanceof Date ? when.getTime() : when;
  let best = null;
  for (const hour of profile?.hours ?? []) {
    if (!best || Math.abs(hour.time.getTime() - target) < Math.abs(best.time.getTime() - target)) best = hour;
  }
  return best;
}

const num = value => (Number.isFinite(value) ? value : null);

/**
 * Turns an Open-Meteo response into hours, each with its surface
 * conditions and a list of levels (lowest first):
 *
 * { elevationFt, timezone, utcOffset, hours: [{
 *     time: Date, localHour, localDay,
 *     surface: { speedKt, dir, gustKt, tempC, dewPointC, pressureHpa, qnhHpa },
 *     freezingLevelFt, cloudBaseFt (estimated, above ground), cloud: { low, mid, high } %,
 *     visibilityM, cape, isDay, weatherCode (WMO), precipChance %,
 *     levels: [{ hPa, altitudeFt, speedKt, dir, tempC, belowGround }] }] }
 *
 * Levels the model puts under the ground at this spot are kept but marked
 * belowGround, since they are extrapolated and mean nothing to a pilot.
 */
export function parseWindsAloft(body, { levels = PRESSURE_LEVELS } = {}) {
  const h = body.hourly ?? {};
  const offset = body.utc_offset_seconds ?? 0;
  const elevationFt = Number.isFinite(body.elevation) ? body.elevation * FT_PER_M : 0;
  const times = h.time ?? [];

  const hours = times.map((seconds, i) => {
    const local = new Date((seconds + offset) * 1000);
    const at = key => num(h[key]?.[i]);
    const tempC = at("temperature_2m");
    const dewPointC = at("dew_point_2m");
    const freezing = at("freezing_level_height");
    const rows = levels
      .map(hPa => {
        const height = at(`geopotential_height_${hPa}hPa`);
        const speedKt = at(`wind_speed_${hPa}hPa`);
        if (height == null || speedKt == null) return null;
        const altitudeFt = height * FT_PER_M;
        return {
          hPa,
          altitudeFt,
          speedKt,
          dir: at(`wind_direction_${hPa}hPa`) ?? 0,
          tempC: at(`temperature_${hPa}hPa`),
          belowGround: altitudeFt < elevationFt + 100,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.altitudeFt - b.altitudeFt);
    return {
      time: new Date(seconds * 1000),
      localHour: local.getUTCHours(),
      localDay: local.toISOString().slice(0, 10),
      surface: {
        speedKt: at("wind_speed_10m"),
        dir: at("wind_direction_10m"),
        gustKt: at("wind_gusts_10m"),
        tempC,
        dewPointC,
        pressureHpa: at("surface_pressure"),
        qnhHpa: at("pressure_msl"),
      },
      // Open-Meteo gives the freezing level above sea level; at or below
      // the ground means it's freezing at the surface.
      freezingLevelFt: freezing == null ? null : freezing * FT_PER_M,
      cloudBaseFt: tempC != null && dewPointC != null ? cloudBaseFt(tempC, dewPointC) : null,
      cloud: { low: at("cloud_cover_low"), mid: at("cloud_cover_mid"), high: at("cloud_cover_high") },
      visibilityM: at("visibility"),
      cape: at("cape"),
      // Daylight, the WMO weather code and the chance of rain this hour:
      // what a skydiver checks after the wind.
      isDay: at("is_day") == null ? null : at("is_day") === 1,
      weatherCode: at("weather_code"),
      precipChance: at("precipitation_probability"),
      levels: rows,
    };
  });

  return { elevationFt, timezone: body.timezone ?? "UTC", utcOffset: offset, hours };
}

const toRad = deg => (deg * Math.PI) / 180;
const toDeg = rad => (rad * 180) / Math.PI;
const norm360 = deg => ((deg % 360) + 360) % 360;

// Wind as east/north components of where the air is GOING.
function components(dir, speed) {
  const to = toRad(dir + 180);
  return { u: speed * Math.sin(to), v: speed * Math.cos(to) };
}

function fromComponents(u, v) {
  const speed = Math.hypot(u, v);
  const dir = speed < 1e-6 ? 0 : norm360(toDeg(Math.atan2(u, v)) + 180);
  return { speed, dir };
}

/**
 * Wind and temperature at an altitude (ft MSL), interpolated between the
 * pressure levels around it. Wind is blended as a vector so 350° and 010°
 * average to north, not south. Returns null below the ground or above the
 * highest level.
 */
export function windAt(hour, altitudeFt, { elevationFt = 0 } = {}) {
  const levels = hour.levels.filter(l => !l.belowGround);
  if (!levels.length || altitudeFt < elevationFt) return null;
  const top = levels[levels.length - 1];
  if (altitudeFt > top.altitudeFt + 500) return null;

  let below = null;
  let above = null;
  for (const level of levels) {
    if (level.altitudeFt <= altitudeFt) below = level;
    else if (!above) above = level;
  }
  // Between the ground and the lowest level, blend the 10 m wind with it.
  if (!below) {
    const surface = hour.surface;
    if (surface?.speedKt == null) return pick(above, altitudeFt);
    below = { altitudeFt: elevationFt + 33, speedKt: surface.speedKt, dir: surface.dir ?? 0, tempC: surface.tempC };
  }
  if (!above) return pick(below, altitudeFt);

  const t = (altitudeFt - below.altitudeFt) / (above.altitudeFt - below.altitudeFt);
  const a = components(below.dir, below.speedKt);
  const b = components(above.dir, above.speedKt);
  const { speed, dir } = fromComponents(a.u + (b.u - a.u) * t, a.v + (b.v - a.v) * t);
  const tempC = below.tempC != null && above.tempC != null ? below.tempC + (above.tempC - below.tempC) * t : null;
  return { altitudeFt, speedKt: speed, dir, tempC };
}

const pick = (level, altitudeFt) => (level ? { altitudeFt, speedKt: level.speedKt, dir: level.dir, tempC: level.tempC } : null);

/**
 * A winds-aloft code the way an FB/FD forecast prints it: "2715+05" is
 * wind from 270° at 15 kt, +5 °C. Light and variable (under 5 kt) is 9900.
 * 100-199 kt adds 50 to the direction. Above 24,000 ft the minus sign is
 * left off because the temperature is always below zero there. Leave
 * tempC null to print the wind only (as FB does at 3,000 ft).
 */
export function fdCode({ dir, speedKt, tempC = null }, altitudeFt) {
  const speed = Math.round(speedKt);
  let wind;
  if (speed < 5) wind = "9900";
  else {
    let tens = Math.round(norm360(dir) / 10);
    if (tens === 0) tens = 36;
    let kt = Math.min(speed, 199);
    if (kt >= 100) {
      tens += 50;
      kt -= 100;
    }
    wind = `${String(tens).padStart(2, "0")}${String(kt).padStart(2, "0")}`;
  }
  if (tempC == null || !Number.isFinite(tempC)) return wind;
  const t = Math.round(tempC);
  if (altitudeFt > 24000) return `${wind}${String(Math.abs(t)).padStart(2, "0")}`;
  return `${wind}${t < 0 ? "-" : "+"}${String(Math.abs(t)).padStart(2, "0")}`;
}

/**
 * The standard altitudes for one hour, the way an FB forecast lays them
 * out: no wind within 1,500 ft of the ground, no temperature at 3,000 ft
 * or within 2,500 ft of the ground.
 */
export function fdRows(hour, { elevationFt = 0, altitudes = FD_ALTITUDES_FT } = {}) {
  return altitudes.map(altitudeFt => {
    if (altitudeFt < elevationFt + 1500) return { altitudeFt, wind: null, code: "" };
    const wind = windAt(hour, altitudeFt, { elevationFt });
    if (!wind) return { altitudeFt, wind: null, code: "" };
    const showTemp = altitudeFt > 3000 && altitudeFt >= elevationFt + 2500;
    return { altitudeFt, wind, code: fdCode({ ...wind, tempC: showTemp ? wind.tempC : null }, altitudeFt) };
  });
}

/**
 * Headwind and crosswind for a course or runway heading (degrees).
 * headwind > 0 is on the nose, < 0 is a tailwind; crosswind > 0 comes
 * from the right, < 0 from the left.
 */
export function windComponents(windDir, speedKt, courseDeg) {
  const angle = toRad(windDir - courseDeg);
  return { headwind: speedKt * Math.cos(angle), crosswind: speedKt * Math.sin(angle) };
}

/**
 * Of the given altitudes, the one with the most tailwind (or least
 * headwind) along a course. Returns { altitudeFt, wind, headwind } or null.
 */
export function bestAltitude(hour, courseDeg, { elevationFt = 0, altitudes = FD_ALTITUDES_FT } = {}) {
  let best = null;
  for (const altitudeFt of altitudes) {
    if (altitudeFt < elevationFt + 1000) continue;
    const wind = windAt(hour, altitudeFt, { elevationFt });
    if (!wind) continue;
    const { headwind } = windComponents(wind.dir, wind.speedKt, courseDeg);
    if (!best || headwind < best.headwind) best = { altitudeFt, wind, headwind };
  }
  return best;
}

/** Pressure altitude (ft) from station pressure in hPa. */
export function pressureAltitudeFt(stationPressureHpa) {
  return (1 - (stationPressureHpa / 1013.25) ** 0.190284) * 145366.45;
}

/**
 * Density altitude (ft): how high the airplane "feels" it is. Pressure
 * altitude plus about 120 ft for every °C warmer than standard.
 */
export function densityAltitudeFt(stationPressureHpa, tempC) {
  const pa = pressureAltitudeFt(stationPressureHpa);
  const isa = 15 - (1.98 * pa) / 1000;
  return pa + 118.8 * (tempC - isa);
}

/**
 * Rough base of cumulus clouds above the ground (ft): about 400 ft for
 * every °C between temperature and dew point.
 */
export function cloudBaseFt(tempC, dewPointC) {
  return Math.max(0, ((tempC - dewPointC) / 2.5) * 1000);
}

/** 16-point compass name for a direction in degrees. */
export function compass(deg) {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round(norm360(deg) / 22.5) % 16];
}

/** "FL240" above 18,000 ft, "9,000 ft" below. */
export function formatAltitude(altitudeFt) {
  const ft = Math.round(altitudeFt / 100) * 100;
  return ft >= 18000 ? `FL${String(Math.round(ft / 100)).padStart(3, "0")}` : `${ft.toLocaleString("en-US")} ft`;
}

/** "270° at 15 kt", or "Calm" under 3 kt. */
export function formatWindKt(dir, speedKt) {
  if (speedKt == null) return "–";
  if (speedKt < 3) return "Calm";
  return `${String(Math.round(norm360(dir)) || 360).padStart(3, "0")}° at ${Math.round(speedKt)} kt`;
}

/** Zulu time "1800Z" for a Date. */
export const zulu = date => `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
