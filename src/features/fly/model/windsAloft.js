// Winds aloft: wind and temperature at altitude, anywhere, from Open-Meteo's
// pressure-level forecast (free, keyless, cross-origin, https://open-meteo.com).
//
// FlyFox's copy, built for route planning (many points in one request).
// SkyFox is adding a shared module at src/services/weather/windsAloft.js;
// once it lands FlyFox moves onto that one. Plain functions, so it runs in Node too.
//   const [profile] = await fetchWindsAloft([{ latitude, longitude }]);
//   const hour = nearestHour(profile, new Date());
//   windAt(hour.levels, 9000)  -> { dir: 270, kt: 25, tempC: -8 }
//   fbRows(hour, profile.elevationFt) -> the classic winds-aloft table rows

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Pressure levels fetched, low to high (about 360 ft to 45,000 ft MSL). */
export const LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150];

/** The altitudes on the National Weather Service winds-aloft forecast (FB), feet MSL. */
export const FB_ALTITUDES = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

const FT_PER_M = 3.28084;
const RAD = Math.PI / 180;

const levelVars = hPa => [`wind_speed_${hPa}hPa`, `wind_direction_${hPa}hPa`, `temperature_${hPa}hPa`, `geopotential_height_${hPa}hPa`];

/** The Open-Meteo request for one or more points. hours: how far ahead (max 384). */
export function windsAloftUrl(points, { hours = 48, pastHours = 0 } = {}) {
  const params = new URLSearchParams({
    latitude: points.map(p => Number(p.latitude ?? p.lat).toFixed(3)).join(","),
    longitude: points.map(p => Number(p.longitude ?? p.lon).toFixed(3)).join(","),
    hourly: ["wind_speed_10m", "wind_direction_10m", "temperature_2m", ...LEVELS_HPA.flatMap(levelVars)].join(","),
    wind_speed_unit: "kn",
    timeformat: "unixtime",
    timezone: "auto",
    forecast_hours: String(Math.max(1, Math.min(384, Math.round(hours)))),
    past_hours: String(Math.max(0, Math.min(48, Math.round(pastHours)))),
  });
  return `${FORECAST_URL}?${params}`;
}

/**
 * Winds aloft for each point, in the same order:
 * [{ latitude, longitude, elevationFt, utcOffset, hours: [{ time, localHour, localDay,
 *    surface: { dir, kt, tempC }, levels: [{ hPa, altFt, dir, kt, tempC }] }] }]
 * Levels are sorted by altitude and skip any that are underground.
 */
export async function fetchWindsAloft(points, { hours = 48, pastHours = 0, signal } = {}) {
  if (!points?.length) return [];
  const response = await fetch(windsAloftUrl(points, { hours, pastHours }), { signal });
  if (!response.ok) throw new Error("The winds-aloft forecast isn't responding. Try again in a moment.");
  const body = await response.json();
  return (Array.isArray(body) ? body : [body]).map(parseWindsAloft);
}

/** One Open-Meteo location body to a profile (see fetchWindsAloft). */
export function parseWindsAloft(body) {
  const h = body?.hourly ?? {};
  const times = Array.isArray(h.time) ? h.time : [];
  const offset = body?.utc_offset_seconds ?? 0;
  const elevationFt = Number.isFinite(body?.elevation) ? body.elevation * FT_PER_M : 0;
  const hours = times.map((seconds, i) => {
    const local = new Date((seconds + offset) * 1000);
    const levels = [];
    for (const hPa of LEVELS_HPA) {
      const [s, d, t, z] = levelVars(hPa).map(k => h[k]?.[i]);
      if (![s, d, t, z].every(Number.isFinite)) continue;
      const altFt = z * FT_PER_M;
      if (altFt < elevationFt) continue; // below the ground here
      levels.push({ hPa, altFt, dir: norm360(d), kt: s, tempC: t });
    }
    levels.sort((a, b) => a.altFt - b.altFt);
    return {
      time: new Date(seconds * 1000),
      localHour: local.getUTCHours(),
      localDay: local.toISOString().slice(0, 10),
      surface: {
        dir: Number.isFinite(h.wind_direction_10m?.[i]) ? norm360(h.wind_direction_10m[i]) : null,
        kt: h.wind_speed_10m?.[i] ?? null,
        tempC: h.temperature_2m?.[i] ?? null,
      },
      levels,
    };
  }).filter(hour => hour.levels.length >= 2);
  return {
    latitude: body?.latitude,
    longitude: body?.longitude,
    elevationFt,
    utcOffset: offset,
    timezone: body?.timezone ?? "GMT",
    hours,
  };
}

export const norm360 = deg => ((Math.round(deg) % 360) + 360) % 360;

/** The forecast hour closest to a time. */
export function nearestHour(profile, when = new Date()) {
  const t = +when;
  let best = null;
  for (const hour of profile?.hours ?? []) {
    if (!best || Math.abs(+hour.time - t) < Math.abs(+best.time - t)) best = hour;
  }
  return best;
}

// Wind as the vector it blows toward, so averaging 350° and 010° gives 360°.
const toUV = (dir, kt) => ({ u: -kt * Math.sin(dir * RAD), v: -kt * Math.cos(dir * RAD) });
const fromUV = (u, v) => ({ dir: norm360(Math.atan2(-u, -v) / RAD), kt: Math.hypot(u, v) });

/**
 * Wind and temperature at an altitude (feet MSL), interpolated between
 * pressure levels. Below the lowest level it holds the lowest level's
 * value; above the highest, the highest. Returns { dir, kt, tempC } or null.
 */
export function windAt(levels, altFt) {
  if (!levels?.length) return null;
  if (altFt <= levels[0].altFt) return pick(levels[0]);
  const top = levels[levels.length - 1];
  if (altFt >= top.altFt) return pick(top);
  for (let i = 1; i < levels.length; i++) {
    const lo = levels[i - 1];
    const hi = levels[i];
    if (altFt > hi.altFt) continue;
    const f = (altFt - lo.altFt) / (hi.altFt - lo.altFt || 1);
    const a = toUV(lo.dir, lo.kt);
    const b = toUV(hi.dir, hi.kt);
    const w = fromUV(a.u + (b.u - a.u) * f, a.v + (b.v - a.v) * f);
    return { dir: w.dir, kt: w.kt, tempC: lo.tempC + (hi.tempC - lo.tempC) * f };
  }
  return pick(top);
}
const pick = l => ({ dir: l.dir, kt: l.kt, tempC: l.tempC });

/** Where the air first drops to 0 °C, feet MSL (null if it never does in range). */
export function freezingLevel(levels, surfaceTempC = null, elevationFt = 0) {
  const pts = [...(Number.isFinite(surfaceTempC) ? [{ altFt: elevationFt, tempC: surfaceTempC }] : []), ...(levels ?? [])];
  if (!pts.length) return null;
  if (pts[0].tempC <= 0) return pts[0].altFt; // freezing at the bottom already
  for (let i = 1; i < pts.length; i++) {
    const lo = pts[i - 1];
    const hi = pts[i];
    if (hi.tempC <= 0) return lo.altFt + ((hi.altFt - lo.altFt) * lo.tempC) / (lo.tempC - hi.tempC || 1);
  }
  return null;
}

/**
 * The winds-aloft code pilots read on an FB forecast: "2725-08" is wind
 * from 270° at 25 knots, minus 8 °C. Light and variable is 9900; 100 to
 * 199 knots adds 50 to the direction (73 for 230° at 105 kt); above
 * 24,000 ft the minus sign is left off because it's always below zero.
 */
export function fbCode({ dir, kt, tempC }, altFt, { withTemp = true } = {}) {
  const speed = Math.round(kt);
  let wind;
  if (speed < 5) wind = "9900";
  else {
    let d = Math.round(dir / 10) % 36 || 36;
    let s = Math.min(199, speed);
    if (s >= 100) {
      d += 50;
      s -= 100;
    }
    wind = `${String(d).padStart(2, "0")}${String(s).padStart(2, "0")}`;
  }
  if (!withTemp || altFt <= 3000 || !Number.isFinite(tempC)) return wind;
  const t = Math.round(tempC);
  if (altFt > 24000) return `${wind}${String(Math.abs(t)).padStart(2, "0")}`;
  return `${wind}${t >= 0 ? "+" : "-"}${String(Math.abs(t)).padStart(2, "0")}`;
}

/** Decode an FB group like "7319" or "2725-08" back to { dir, kt, tempC }. */
export function decodeFb(code, altFt = 9000) {
  const m = /^(\d{2})(\d{2})([+-]?\d{2})?$/.exec(String(code).trim());
  if (!m) return null;
  let d = Number(m[1]);
  let s = Number(m[2]);
  if (d === 99 && s === 0) return { dir: null, kt: 0, tempC: m[3] ? temp(m[3], altFt) : null, light: true };
  if (d > 36) {
    d -= 50;
    s += 100;
  }
  return { dir: d * 10, kt: s, tempC: m[3] ? temp(m[3], altFt) : null };
}
const temp = (t, altFt) => (/^[+-]/.test(t) ? Number(t) : altFt > 24000 ? -Number(t) : Number(t));

/**
 * The winds-aloft table for one hour, like the FB forecast: one row per
 * standard altitude, leaving out any within 1,500 ft of the ground (the
 * NWS does the same). Pass more altitudes to add your own.
 */
export function fbRows(hour, elevationFt = 0, altitudes = FB_ALTITUDES) {
  if (!hour) return [];
  return altitudes
    .filter(alt => alt - elevationFt >= 1500)
    .map(altFt => {
      const w = windAt(hour.levels, altFt);
      return w ? { altFt, ...w, code: fbCode(w, altFt) } : null;
    })
    .filter(Boolean);
}

/** Headwind (+) / tailwind (-) and crosswind (+ from the right) for a course. */
export function windComponents(courseDeg, wind) {
  const angle = (wind.dir - courseDeg) * RAD;
  return { head: wind.kt * Math.cos(angle), cross: wind.kt * Math.sin(angle) };
}
