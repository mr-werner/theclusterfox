// Can I jump? Turns an hour of the shared winds-aloft forecast
// (src/services/weather/windsAloft.js) into a skydiver's call, and works out
// a rough spot and exit separation from the winds between exit and the
// ground. Plain functions so they run in Node tests.

import { windAt, windComponents } from "../../../services/weather/windsAloft.js";

export const KT_TO_MPH = 1.15078;
export const KT_TO_FPS = 1.68781;
const FT_PER_MILE = 5280;

/**
 * Ground wind limits by who's jumping, in mph. USPA's Basic Safety
 * Requirements cap solo students at 14 mph; the rest are common DZ
 * practice and can be changed in settings.
 */
export const JUMPER_TYPES = [
  { id: "student", name: "Student", limitMph: 14, note: "USPA limit for solo students" },
  { id: "A", name: "A license", limitMph: 18, note: "Common DZ practice for newer jumpers" },
  { id: "B", name: "B license", limitMph: 20, note: "Common DZ practice" },
  { id: "CD", name: "C or D license", limitMph: 25, note: "Typical upper limit at most DZs" },
  { id: "tandem", name: "Tandem passenger", limitMph: 20, note: "Varies by DZ and tandem system" },
];

const RAIN = new Set([61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const DRIZZLE = new Set([51, 53, 55, 56, 57]);
const THUNDER = new Set([95, 96, 99]);
const FOG = new Set([45, 48]);

export const LEVEL_TEXT = { go: "Jumpable", maybe: "Marginal", no: "Not jumpable", dark: "After dark" };

/**
 * The call for one forecast hour:
 * { level: "go" | "maybe" | "no" | "dark", reasons: [{ level, text }],
 *   windMph, gustMph, uppers: { speedKt, dir, tempC } | null }
 * Each reason that isn't "go" says why. Options: limitMph (ground wind
 * limit), exitFt (exit altitude above the ground), elevationFt (field).
 */
export function jumpCall(hour, { limitMph = 20, exitFt = 13500, elevationFt = 0 } = {}) {
  const reasons = [];
  const add = (level, text) => reasons.push({ level, text });
  const s = hour.surface ?? {};
  const windMph = s.speedKt == null ? null : s.speedKt * KT_TO_MPH;
  const gustMph = s.gustKt == null ? null : s.gustKt * KT_TO_MPH;
  const lim = Math.round(limitMph);

  if (windMph != null) {
    const worst = Math.max(windMph, gustMph ?? 0);
    if (windMph > limitMph) add("no", `Wind ${Math.round(windMph)} mph is over your ${lim} mph limit`);
    else if (gustMph != null && gustMph > limitMph) add("no", `Gusts to ${Math.round(gustMph)} mph, over your ${lim} mph limit`);
    else if (worst > limitMph - 3) add("maybe", `Wind close to your ${lim} mph limit`);
    if (gustMph != null && windMph != null && gustMph - windMph >= 10) add("maybe", `Gusty: ${Math.round(gustMph - windMph)} mph between lulls and gusts`);
  }

  const code = hour.weatherCode;
  if (code != null) {
    if (THUNDER.has(code)) add("no", "Thunderstorms");
    else if (RAIN.has(code)) add("no", "Rain");
    else if (SNOW.has(code)) add("no", "Snow");
    else if (FOG.has(code)) add("no", "Fog");
    else if (DRIZZLE.has(code)) add("maybe", "Drizzle");
  }
  if (hour.precipChance != null && hour.precipChance >= 50 && !reasons.some(r => /Rain|Snow|Thunder|Drizzle/.test(r.text))) add("maybe", `${Math.round(hour.precipChance)}% chance of rain`);
  if (hour.cape != null && hour.cape >= 1500 && !reasons.some(r => r.text === "Thunderstorms")) add("maybe", "Unstable air: storms could build");

  const low = hour.cloud?.low;
  const mid = hour.cloud?.mid;
  if (low != null && low >= 85) add("no", "Low overcast: no clear view of the ground");
  else if (low != null && low >= 55) add("maybe", "Broken low clouds: may need to wait for holes");
  if (mid != null && mid >= 85) add("no", "Solid cloud layer at jump altitude");
  else if (mid != null && mid >= 60) add("maybe", "Clouds around jump altitude");

  const vis = hour.visibilityM;
  if (vis != null && vis < 4828) add("no", `Visibility under 3 miles (the FAA minimum)`);
  else if (vis != null && vis < 8047) add("maybe", "Hazy: visibility under 5 miles");

  const uppers = hour.levels?.length ? windAt(hour, exitFt + elevationFt, { elevationFt }) : null;
  if (uppers && uppers.speedKt >= 50) add("maybe", `Strong uppers: ${Math.round(uppers.speedKt)} kt at exit, a big spot and short jump run`);

  if (hour.isDay === false) return { level: "dark", reasons: [{ level: "dark", text: "After dark: night jumps only, with training" }, ...reasons], windMph, gustMph, uppers };

  const level = reasons.some(r => r.level === "no") ? "no" : reasons.some(r => r.level === "maybe") ? "maybe" : "go";
  return { level, reasons, windMph, gustMph, uppers };
}

/** Each daylight window of jumpable hours in a list of calls: [{ from, to, level }]. */
export function windows(hours, calls) {
  const out = [];
  hours.forEach((hour, i) => {
    const level = calls[i].level;
    const last = out[out.length - 1];
    if (last && last.level === level && last.to === i - 1) last.to = i;
    else out.push({ from: i, to: i, level });
  });
  return out;
}

/**
 * Seconds from exit to pull for a height drop (ft), at belly (about
 * 120 mph) or freefly (about 160 mph) speeds. The first 10 seconds cover
 * about 1,000 ft while you speed up.
 */
export function freefallSeconds(dropFt, style = "belly") {
  if (!(dropFt > 0)) return 0;
  const v = style === "freefly" ? 235 : style === "wingsuit" ? 80 : 176;
  if (dropFt <= 1000) return Math.sqrt((2 * dropFt) / 32.2) * 1.15;
  return 10 + (dropFt - 1000) / v;
}

// Average wind (as a vector) over a band of altitudes above the ground.
function averageWind(hour, fromAgl, toAgl, elevationFt) {
  let u = 0;
  let v = 0;
  let n = 0;
  for (let agl = fromAgl; agl <= toAgl; agl += 250) {
    const w = windAt(hour, agl + elevationFt, { elevationFt });
    if (!w) continue;
    const to = ((w.dir + 180) * Math.PI) / 180;
    u += w.speedKt * Math.sin(to);
    v += w.speedKt * Math.cos(to);
    n += 1;
  }
  if (!n) return null;
  u /= n;
  v /= n;
  const speedKt = Math.hypot(u, v);
  const dir = speedKt < 1e-6 ? 0 : ((((Math.atan2(u, v) * 180) / Math.PI + 180) % 360) + 360) % 360;
  return { speedKt, dir };
}

/**
 * A rough spot from the winds at one hour. All distances in feet, bearings
 * in degrees true FROM the target:
 * { freefall: { seconds, wind, driftFt }, canopy: { seconds, wind, driftFt },
 *   open: { bearing, distFt }, exit: { bearing, distFt },
 *   jumpRun: { heading, groundspeedKt, secondsBetweenGroups } }
 *
 * Freefall drift is the whole of it: you fall with the air. Under canopy you
 * fly, so we aim to open upwind by half the drift you'd have hanging in
 * brakes, which leaves room to get back on a windy day.
 */
export function spot(hour, { exitFt = 13500, pullFt = 3500, elevationFt = 0, style = "belly", canopyFps = 17, jumpRunKias = 80 } = {}) {
  const ffSeconds = freefallSeconds(exitFt - pullFt, style);
  const ffWind = averageWind(hour, pullFt, exitFt, elevationFt);
  const cWind = averageWind(hour, 0, pullFt, elevationFt);
  if (!ffWind || !cWind) return null;
  const canopySeconds = Math.max(0, pullFt - 600) / canopyFps;
  const ffDrift = ffWind.speedKt * KT_TO_FPS * ffSeconds;
  const cDrift = cWind.speedKt * KT_TO_FPS * canopySeconds;

  // Vectors pointing upwind (toward where the wind comes from), in ft east/north.
  const vec = (dir, dist) => ({ x: dist * Math.sin((dir * Math.PI) / 180), y: dist * Math.cos((dir * Math.PI) / 180) });
  const openV = vec(cWind.dir, Math.min(cDrift / 2, FT_PER_MILE));
  const ffV = vec(ffWind.dir, ffDrift);
  const exitV = { x: openV.x + ffV.x, y: openV.y + ffV.y };
  const polar = p => ({ bearing: (((Math.atan2(p.x, p.y) * 180) / Math.PI) % 360 + 360) % 360, distFt: Math.hypot(p.x, p.y), x: p.x, y: p.y });

  // Jump run goes into the wind at exit altitude.
  const exitWind = windAt(hour, exitFt + elevationFt, { elevationFt }) ?? ffWind;
  const heading = Math.round(exitWind.dir) % 360;
  const tas = jumpRunKias * (1 + (0.02 * (exitFt + elevationFt)) / 1000);
  const { headwind } = windComponents(exitWind.dir, exitWind.speedKt, heading);
  const groundspeedKt = Math.max(20, tas - headwind);
  // About 1,000 ft of ground between groups is the usual minimum.
  const secondsBetweenGroups = Math.max(5, Math.ceil(1000 / (groundspeedKt * KT_TO_FPS)));

  return {
    freefall: { seconds: ffSeconds, wind: ffWind, driftFt: ffDrift },
    canopy: { seconds: canopySeconds, wind: cWind, driftFt: cDrift },
    open: polar(openV),
    exit: polar(exitV),
    jumpRun: { heading, groundspeedKt, secondsBetweenGroups, exitWind },
  };
}

/** "0.4 mi" or "900 ft". */
export function fmtDist(ft) {
  if (ft < 1500) return `${Math.round(ft / 50) * 50} ft`;
  return `${(ft / FT_PER_MILE).toFixed(1)} mi`;
}

/** Straight-line distance in miles. */
export function milesBetween(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
