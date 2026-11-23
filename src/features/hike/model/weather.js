// When to start a hike. The forecast is checked at two places, the
// trailhead and the trail's high point, for every half-hour start time on
// the chosen day. Each start is scored for the hours it would put you on
// the trail: daylight, storms, rain, heat, cold and wind. The best few
// starts are returned with plain reasons.
//
// Hours: [{ t, local, temp, apparent, precipProb, precip, code, wind, gust,
//   uv, cape, snowfall, snowDepth, freezing }]  t is UTC ms, local is the
//   same instant as local wall-clock ms, temperatures °C, wind km/h.
// Days: [{ day: "YYYY-MM-DD", sunrise, sunset }] in minutes after local midnight.

const HOUR = 3600000;
const dayStart = day => Date.parse(`${day}T00:00:00Z`);

/** "6:30 AM" for minutes after midnight. */
export function clock(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

/** "HH:MM" (24 h) for minutes after midnight, as TaskFox stores times. */
export const hhmm = min => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export const fromHhmm = s => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const isStorm = code => code >= 95;

/** The hours of a forecast that overlap a window, with how much of each hour overlaps (0–1). */
function overlapping(hours, from, to) {
  const out = [];
  for (const h of hours) {
    const a = Math.max(from, h.local);
    const b = Math.min(to, h.local + HOUR);
    if (b > a) out.push({ h, w: (b - a) / HOUR });
  }
  return out;
}

/**
 * Score one start time. base and high are the forecast hours at the
 * trailhead and the high point (high may be the same list). Returns
 * { start, end, score, notes: [{ tone, text }], worst }.
 */
export function scoreStart({ base, high = base, sun, day, start, minutes, exposed = false, fmtTemp = c => `${Math.round(c)}°C`, fmtWind = k => `${Math.round(k)} km/h` }) {
  const from = dayStart(day) + start * 60000;
  const to = from + minutes * 60000;
  let score = 100;
  const notes = [];
  const worst = { storm: null, rain: 0, hot: null, cold: null, gust: 0, uv: 0, snow: 0, snowDepth: 0, freezing: null };

  // Daylight.
  if (sun) {
    const rise = dayStart(day) + sun.sunrise * 60000;
    const set = dayStart(day) + sun.sunset * 60000;
    const early = Math.max(0, Math.min(to, rise) - from) / 60000;
    const late = Math.max(0, to - Math.max(from, set - 30 * 60000)) / 60000;
    score -= early * 0.2 + late * 0.9;
    if (late > 0) notes.push({ tone: "bad", text: to > set ? `Finishes ${Math.round((to - set) / 60000)} min after sunset` : "Finishes in the last half hour of light" });
    else if (early > 20) notes.push({ tone: "warn", text: `Starts ${Math.round(early)} min before sunrise: bring a headlamp` });
  }

  const baseH = overlapping(base, from, to);
  const highH = overlapping(high, from, to);
  const localHour = h => new Date(h.local).getUTCHours();
  for (const { h, w } of baseH) {
    if (h.apparent > 26) {
      score -= (h.apparent - 26) * 2.4 * w;
      if (!worst.hot || h.apparent > worst.hot.apparent) worst.hot = h;
    }
    worst.rain = Math.max(worst.rain, h.precipProb ?? 0);
    worst.uv = Math.max(worst.uv, h.uv ?? 0);
  }
  for (const { h, w } of highH) {
    if (isStorm(h.code)) {
      score -= 32 * w;
      if (!worst.storm) worst.storm = h;
    } else if (exposed && (h.cape ?? 0) > 800 && (h.precipProb ?? 0) >= 20) {
      // Unstable air over open ridges builds afternoon storms.
      score -= Math.min(20, ((h.cape - 800) / 1000) * 10 + 6) * w;
      if (!worst.storm) worst.storm = { ...h, buildup: true };
    }
    score -= ((h.precipProb ?? 0) / 100) * 14 * w + Math.min(10, (h.precip ?? 0) * 3) * w;
    // Below freezing is fine with layers, but later and warmer is nicer.
    if (h.apparent < 0) score -= Math.min(8, -h.apparent * 0.5) * w;
    if (h.apparent < -8) score -= (-8 - h.apparent) * 1.4 * w;
    if (!worst.cold || h.apparent < worst.cold.apparent) worst.cold = h;
    if (h.gust > 45) score -= (h.gust - 45) * 0.7 * w;
    worst.gust = Math.max(worst.gust, h.gust ?? 0);
    worst.rain = Math.max(worst.rain, h.precipProb ?? 0);
    worst.snow += (h.snowfall ?? 0) * w;
    worst.snowDepth = Math.max(worst.snowDepth, h.snowDepth ?? 0);
    if (Number.isFinite(h.freezing)) worst.freezing = worst.freezing === null ? h.freezing : Math.min(worst.freezing, h.freezing);
  }

  if (worst.storm) notes.push({ tone: "bad", text: worst.storm.buildup ? `Storms may build by ${clock(localHour(worst.storm) * 60)} up high` : `Thunderstorms forecast around ${clock(localHour(worst.storm) * 60)}` });
  if (worst.rain >= 50) notes.push({ tone: "warn", text: `Up to ${Math.round(worst.rain)}% chance of rain or snow` });
  if (worst.hot && worst.hot.apparent > 29) notes.push({ tone: worst.hot.apparent > 33 ? "bad" : "warn", text: `Feels like ${fmtTemp(worst.hot.apparent)} by ${clock(localHour(worst.hot) * 60)}` });
  if (worst.cold && worst.cold.apparent < -5) notes.push({ tone: "warn", text: `Feels like ${fmtTemp(worst.cold.apparent)} up high` });
  if (worst.gust > 50) notes.push({ tone: worst.gust > 70 ? "bad" : "warn", text: `Gusts to ${fmtWind(worst.gust)} up high` });
  if (!notes.length) notes.push({ tone: "good", text: "Dry, daylight and comfortable the whole way" });

  return { start, end: start + minutes, score: Math.max(0, Math.round(score)), notes, worst };
}

/**
 * The best start times on a day. Returns { options: up to 3 scored starts
 * at least 90 minutes apart, best first; curve: every start considered }.
 */
export function bestStarts({ base, high, sun, day, minutes, exposed, fmtTemp, fmtWind }) {
  const rise = sun?.sunrise ?? 360;
  const set = sun?.sunset ?? 1140;
  const first = Math.max(240, Math.floor((rise - 90) / 30) * 30);
  let last = Math.min(15 * 60, Math.floor((set - 30 - minutes) / 30) * 30);
  if (last < first) last = Math.max(first, 12 * 60);
  const curve = [];
  for (let s = first; s <= last; s += 30) curve.push(scoreStart({ base, high, sun, day, start: s, minutes, exposed, fmtTemp, fmtWind }));
  const ranked = curve.slice().sort((a, b) => b.score - a.score || a.start - b.start);
  const options = [];
  for (const c of ranked) {
    if (options.every(o => Math.abs(o.start - c.start) >= 90)) options.push(c);
    if (options.length === 3) break;
  }
  return { options, curve };
}

/**
 * Turnaround time for an out-and-back: the latest time to head back and
 * still be at the car 30 minutes before sunset (or before storms, if
 * they're forecast). Returns minutes after midnight, or null.
 */
export function turnaround({ start, minutes, shape, sun, storm }) {
  if (shape !== "out-back" || !sun) return null;
  let finishBy = sun.sunset - 30;
  if (storm) finishBy = Math.min(finishBy, new Date(storm.local).getUTCHours() * 60 - 30);
  const back = minutes / 2;
  return Math.max(start + 15, Math.min(start + minutes / 2 + 90, finishBy - back));
}

/** A day's forecast hours (local day "YYYY-MM-DD"). */
export const hoursOn = (hours, day) => hours.filter(h => new Date(h.local).toISOString().slice(0, 10) === day);
