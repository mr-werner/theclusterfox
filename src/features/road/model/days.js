// Day plans for RoadTripFox: your driving day (start, finish, hours behind
// the wheel and some wiggle room), three versions of the trip (as planned,
// pushing on, easing off), where each night lands, gas stops placed where
// you're already stopping, and when you'll be at each point for the weather.
// Plain functions so tests can use them.

import { cumulative, pointAt } from "./geo.js";
import { minutesAt, splitDays } from "./route.js";
import { pickNight } from "./stays.js";

export const DEFAULT_DRIVE = { start: 8 * 60, finish: 18 * 60, flex: 90, stay: "city", budget: 140 };

/** "08:30" -> 510, or null. */
export function parseClock(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text ?? "");
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
}
/** 510 -> "08:30" (for time inputs). */
export const toClock = min => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** 1050 -> "5:30 pm"; past midnight says so. */
export function fmtClock(min) {
  if (!Number.isFinite(min)) return "";
  const r = Math.round(min / 5) * 5;
  const m = ((r % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const text = `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  return r >= 1440 ? `${text} (next day)` : text;
}

/**
 * How safe a day of `hours` behind the wheel is. Road-safety groups advise
 * about 8 hours of driving a day at most, with a break every 2 hours; past
 * 10 the risk of drowsy driving climbs steeply.
 */
export function drivingWarning(hours) {
  if (hours > 11) return { level: "danger", text: `${hours} hours is more than truckers are allowed to drive in a day (11). Share the driving or plan another night.` };
  if (hours > 10) return { level: "danger", text: "Over 10 hours a day, the risk of drowsy driving climbs steeply. Swap drivers and take a 15-minute break every 2 hours." };
  if (hours > 8) return { level: "warn", text: "Longer than the 8 hours a day road-safety groups recommend. Doable now and then, with breaks every 2 hours." };
  return null;
}

/** The options splitDays takes, for a plan that drives `delta` minutes more (or less) a day. */
export function dayOptions(drive, hoursPerDay, delta = 0, days = {}) {
  const hours = Math.max(1, hoursPerDay + delta / 60);
  const shifted = {};
  for (const [i, d] of Object.entries(days ?? {})) shifted[i] = { start: d.start, finish: Number.isFinite(d.finish) ? d.finish + delta : undefined };
  return { hours, start: drive.start, finish: drive.finish + delta, days: shifted };
}

export const PLAN_KINDS = [
  { id: "planned", name: "As planned", delta: 0, blurb: "The days you set." },
  { id: "further", name: "Push on", delta: 1, blurb: "Feeling good: drive longer each day and finish later." },
  { id: "earlier", name: "Ease off", delta: -1, blurb: "Had enough: stop earlier each day." },
];

/**
 * The trip split three ways: planned, pushing on (+flex a day) and easing
 * off (-flex a day). With overnight `places` along the route (from
 * corridorFromOsm, placed with mile/off), each night snaps to the best spot
 * of the kind you picked near where the day would end.
 * Returns { planned, further, earlier } each { days, nights }.
 */
export function threePlans(route, stops, { drive = DEFAULT_DRIVE, hoursPerDay = 7, days = {}, places = [] } = {}) {
  const out = {};
  for (const kind of PLAN_KINDS) {
    const delta = kind.delta * (drive.flex ?? 90);
    if (kind.delta && hoursPerDay + delta / 60 < 1) continue;
    const opts = dayOptions(drive, hoursPerDay, delta, days);
    const nights = [];
    opts.snap = ({ index, fromMile, target }) => {
      const span = target - fromMile;
      const night = places.length ? pickNight(places, { target, lo: fromMile + span * 0.72, hi: target + Math.min(25, span * 0.08), pref: drive.stay, budget: drive.budget }) : { pick: null, options: {} };
      nights[index] = night;
      return night.pick?.mile ?? null;
    };
    const split = splitDays(route, stops, opts);
    out[kind.id] = { days: split, nights: split.map((d, i) => (d.end ? (nights[i] ?? { pick: null, options: {} }) : null)) };
  }
  return out;
}

/**
 * For one day of a plan: where you'd stop if you pushed on or eased off
 * just that day. Returns { further, earlier } as night picks or null.
 */
export function dayWiggle(route, day, { drive = DEFAULT_DRIVE, places = [] } = {}) {
  if (!day.end || !places.length) return { further: null, earlier: null };
  const flex = drive.flex ?? 90;
  const fromMin = minutesAt(route, day.exactFrom ?? day.fromMile);
  const at = minutes => {
    let lo = day.exactFrom ?? day.fromMile;
    let hi = route.miles;
    for (let k = 0; k < 36; k++) {
      const mid = (lo + hi) / 2;
      if (minutesAt(route, mid) - fromMin <= minutes) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const pick = minutes => {
    if (minutes < 45) return null;
    const target = at(minutes);
    if (target >= route.miles - 2) return { pick: { kind: "arrive", mile: route.miles, name: "your destination" }, options: {} };
    const span = target - (day.exactFrom ?? day.fromMile);
    const night = pickNight(places, { target, lo: target - Math.max(10, span * 0.12), hi: target + Math.min(25, span * 0.06), pref: drive.stay, budget: drive.budget });
    if (!night.pick) return null;
    return { ...night, extra: Math.round(minutesAt(route, night.pick.mile) - fromMin - day.driveMinutes) };
  };
  return { further: pick(day.driveMinutes + flex), earlier: pick(day.driveMinutes - flex) };
}

/**
 * Gas stops placed where you're already stopping. range is from legRange;
 * stations carry .mile (corridor "fuel" items); anchors are planned stops
 * and nights ({ mile, name }). Each fill-up goes at the best station before
 * you'd run low, and one within 3 miles of an anchor wins, so you fill up
 * while you're there anyway. Returns [{ mile, station, anchor }].
 */
export function gasPlan(total, range, stations, anchors = []) {
  const out = [];
  let from = 0;
  let reach = range.first;
  while (from + reach < total - 5 && out.length < 60) {
    const target = from + reach;
    const lo = from + reach * 0.55;
    const pool = stations.filter(s => s.mile <= target && s.mile >= lo && s.mile > from + 1);
    const score = s => {
      const anchor = anchors.find(a => Math.abs(a.mile - s.mile) <= 3);
      return (anchor ? 40 : 0) + (s.mile - lo) / Math.max(1, target - lo) * 20 - s.off * 6 + (s.truck ? 3 : 0) + (s.open24 ? 2 : 0);
    };
    const best = pool.sort((a, b) => score(b) - score(a))[0] ?? null;
    const anchor = best ? anchors.find(a => Math.abs(a.mile - best.mile) <= 3) ?? null : null;
    out.push({ mile: Math.round(best ? best.mile : target), station: best, anchor });
    from = best ? best.mile : target;
    reach = range.next;
  }
  return out;
}

/**
 * Points along each day with when you'll pass them, for the weather:
 * [{ day, mile, lat, lon, minutes, label }] where minutes counts from
 * midnight of the trip's first day (day n adds n × 1440). One point at the
 * start of each day, about every `every` minutes of driving, and the end.
 */
export function timeline(route, days, { every = 90 } = {}) {
  const cum = cumulative(route.points);
  const out = [];
  for (const d of days) {
    if (!Number.isFinite(d.startClock)) continue;
    const base = d.index * 1440 + d.startClock;
    const fromMin = minutesAt(route, d.exactFrom ?? d.fromMile);
    const toMile = d.exactTo ?? d.toMile;
    const marks = [];
    for (let t = 0; t < d.driveMinutes - every * 0.4; t += every) marks.push(t);
    marks.push(d.driveMinutes);
    for (const t of marks) {
      let lo = d.exactFrom ?? d.fromMile;
      let hi = toMile;
      for (let k = 0; k < 32; k++) {
        const mid = (lo + hi) / 2;
        if (minutesAt(route, mid) - fromMin <= t) lo = mid;
        else hi = mid;
      }
      const mile = t >= d.driveMinutes ? toMile : lo;
      // Stops and breaks passed by this point add to the clock.
      const stopsBefore = d.stops.filter(s => s.mile <= mile + 0.01);
      const stopMin = stopsBefore.reduce((s, p) => s + (p.minutes ?? 45), 0);
      const rest = d.breakMinutes ? Math.max(0, Math.floor(t / 120) - stopsBefore.length) * 15 : 0;
      const p = pointAt(route.points, cum, mile);
      out.push({ day: d.index, mile: Math.round(mile), lat: p.lat, lon: p.lon, minutes: base + t + stopMin + rest, end: t >= d.driveMinutes });
    }
  }
  return out;
}

/**
 * What to watch for in an hour of weather ({ temp, rain, code, gust, snow }):
 * a short warning or null.
 */
export function roadHazard(w) {
  if (!w) return null;
  const code = w.code ?? 0;
  if (code >= 95) return "Thunderstorms";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86 || (w.snow ?? 0) > 0.2) return "Snow on the road";
  if (code === 56 || code === 57 || code === 66 || code === 67) return "Freezing rain, icy roads";
  if (w.temp <= 33 && (w.rain ?? 0) >= 40) return "Possible ice";
  if ((w.gust ?? 0) >= 45) return "Strong crosswinds";
  if (code === 45 || code === 48) return "Fog";
  if (code === 65 || code === 82) return "Heavy rain";
  return null;
}

/**
 * Open-Meteo hourly answers (one per point, timezone auto) as each point's
 * weather at its time. depart is "YYYY-MM-DD" (the first day, local to the
 * start). Returns the points with .weather ({ temp, rain, code, gust, snow,
 * local }) or .weather null when that hour isn't forecast yet.
 */
export function weatherAlong(points, bodies, depart) {
  const [y, m, d] = depart.split("-").map(Number);
  const startOffset = Number(bodies[0]?.utc_offset_seconds) || 0;
  const t0 = Date.UTC(y, m - 1, d) - startOffset * 1000;
  return points.map((p, i) => {
    const b = bodies[i];
    const h = b?.hourly;
    if (!h?.time) return { ...p, weather: null };
    const when = t0 + p.minutes * 60000;
    const local = new Date(when + (Number(b.utc_offset_seconds) || 0) * 1000);
    local.setUTCMinutes(local.getUTCMinutes() >= 30 ? 60 : 0, 0, 0);
    const key = local.toISOString().slice(0, 13) + ":00";
    const k = h.time.indexOf(key);
    if (k < 0) return { ...p, weather: null };
    return {
      ...p,
      weather: { temp: h.temperature_2m?.[k], rain: h.precipitation_probability?.[k], code: h.weather_code?.[k], gust: h.wind_gusts_10m?.[k], snow: h.snowfall?.[k], local: key },
    };
  });
}
