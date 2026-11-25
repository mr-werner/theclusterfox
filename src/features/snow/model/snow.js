// SnowFox's reasoning about mountain weather: snow totals, how good a day
// looks, wind holds, crowds and roads. Plain functions so they can be tested
// in Node. Weather arrives in metric from Open-Meteo (°C, m/s, cm of snow,
// metres); everything is shown in US units unless the person picks metric.

export const CM_PER_IN = 2.54;
export const M_PER_FT = 0.3048;
export const MPH_PER_MS = 2.23694;

// ---- Units ----

export function fmtSnow(cm, units = "us", { zero = "0" } = {}) {
  if (!Number.isFinite(cm)) return "–";
  if (units === "metric") return cm < 0.5 ? (cm > 0 ? "<1 cm" : `${zero} cm`) : `${Math.round(cm)} cm`;
  const inches = cm / CM_PER_IN;
  if (inches < 0.25) return inches > 0.02 ? "<½″" : `${zero}″`;
  return inches < 3 ? `${Math.round(inches * 2) / 2}″` : `${Math.round(inches)}″`;
}

/** Lifts open as a fraction, e.g. { open: 8, total: 12 }, or null before any lift is reported. */
export function liftFraction(live) {
  const total = live?.lifts?.length ?? 0;
  return total ? { open: live.open ?? 0, total } : null;
}

export function fmtDepth(meters, units = "us") {
  if (!Number.isFinite(meters)) return "–";
  return units === "metric" ? `${Math.round(meters * 100)} cm` : `${Math.round((meters * 100) / CM_PER_IN)}″`;
}

export function fmtTemp(c, units = "us") {
  if (!Number.isFinite(c)) return "–";
  return units === "metric" ? `${Math.round(c)}°C` : `${Math.round((c * 9) / 5 + 32)}°F`;
}

export function fmtWind(ms, units = "us") {
  if (!Number.isFinite(ms)) return "–";
  return units === "metric" ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * MPH_PER_MS)} mph`;
}

export function fmtElev(ft, units = "us") {
  if (!Number.isFinite(ft)) return "–";
  return units === "metric" ? `${Math.round(ft * M_PER_FT).toLocaleString("en-US")} m` : `${Math.round(ft).toLocaleString("en-US")} ft`;
}

export function fmtHour(h) {
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = deg => (Number.isFinite(deg) ? COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] : "");

// ---- Forecast summaries ----

/** Total snowfall (cm) for hours whose time is in [fromMs, toMs). */
export function snowBetween(hours, fromMs, toMs) {
  let sum = 0;
  for (const h of hours) {
    const t = +h.time;
    if (t >= fromMs && t < toMs && Number.isFinite(h.snow)) sum += h.snow;
  }
  return sum;
}

/** Snow that fell and is coming, around `now`: { past24, past72, next24, next72, next7 } in cm. */
export function snowTotals(hours, now = Date.now()) {
  const H = 3600000;
  return {
    past24: snowBetween(hours, now - 24 * H, now),
    past72: snowBetween(hours, now - 72 * H, now),
    next24: snowBetween(hours, now, now + 24 * H),
    next72: snowBetween(hours, now, now + 72 * H),
    next7: snowBetween(hours, now, now + 7 * 24 * H),
  };
}

/** The hour nearest `now`. */
export function hourAt(hours, now = Date.now()) {
  let best = null;
  for (const h of hours) if (!best || Math.abs(h.time - now) < Math.abs(best.time - now)) best = h;
  return best;
}

const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const max = a => (a.length ? Math.max(...a) : null);
const min = a => (a.length ? Math.min(...a) : null);
const nums = (list, k) => list.map(h => h[k]).filter(Number.isFinite);

/**
 * Hourly weather grouped by the mountain's local day, with what matters for
 * skiing: snow in the day, snow overnight before it (4 PM to 9 AM), the
 * lifts-open window (9 AM to 4 PM) temperature, feels-like, wind and gusts,
 * visibility, cloud and the freezing level.
 */
export function dailyFrom(hours) {
  const byDay = new Map();
  for (const h of hours) {
    if (!byDay.has(h.localDay)) byDay.set(h.localDay, []);
    byDay.get(h.localDay).push(h);
  }
  const days = [...byDay.keys()].sort();
  return days.map((day, i) => {
    const list = byDay.get(day);
    const open = list.filter(h => h.localHour >= 9 && h.localHour < 16);
    const prev = i > 0 ? byDay.get(days[i - 1]).filter(h => h.localHour >= 16) : [];
    const overnight = [...prev, ...list.filter(h => h.localHour < 9)];
    const sum = l => l.reduce((s, h) => s + (Number.isFinite(h.snow) ? h.snow : 0), 0);
    const codes = nums(open.length ? open : list, "code");
    return {
      day,
      hours: list.length,
      snow: sum(list),
      overnight: sum(overnight),
      openSnow: sum(open),
      rain: open.reduce((s, h) => s + (Number.isFinite(h.rain) ? h.rain : 0), 0),
      high: max(nums(list, "temp")),
      low: min(nums(list, "temp")),
      temp: avg(nums(open, "temp")),
      feels: min(nums(open, "feels")),
      wind: avg(nums(open, "wind")),
      gust: max(nums(open, "gust")),
      vis: min(nums(open, "vis")),
      cloud: avg(nums(open, "cloud")),
      freeze: avg(nums(list, "freeze")),
      code: codes.length ? Math.max(...codes) : 0,
    };
  });
}

// ---- Lift holds ----

/** Chance the upper lifts go on wind hold, from the summit's peak gust (m/s). */
export function windHold(gustMs) {
  if (!Number.isFinite(gustMs)) return { level: "unknown", label: "No wind data" };
  const mph = gustMs * MPH_PER_MS;
  if (mph >= 50) return { level: "likely", label: "Wind holds likely", mph };
  if (mph >= 38) return { level: "possible", label: "Wind holds possible", mph };
  return { level: "unlikely", label: "Lifts should spin", mph };
}

// ---- How good a day ----

/**
 * A 0-100 score for a ski day at the summit, with a short label and reasons.
 * Fresh snow helps most; strong wind, bitter cold, rain, warm slush and flat
 * light take points away. `base` is the same day at the base, when known.
 */
export function scoreDay(summit, base = null) {
  if (!summit) return null;
  const reasons = [];
  const fresh = summit.overnight + summit.openSnow * 0.6;
  const freshIn = fresh / CM_PER_IN;
  let score = 55;
  if (freshIn >= 12) {
    score += 40;
    reasons.push({ good: true, text: `About ${Math.round(freshIn)}″ of new snow` });
  } else if (freshIn >= 6) {
    score += 30;
    reasons.push({ good: true, text: `About ${Math.round(freshIn)}″ of new snow` });
  } else if (freshIn >= 2) {
    score += 15;
    reasons.push({ good: true, text: `A refresh of ${Math.round(freshIn)}″` });
  }
  const hold = windHold(summit.gust);
  if (hold.level === "likely") {
    score -= 25;
    reasons.push({ good: false, text: `Gusts near ${Math.round(hold.mph)} mph up top` });
  } else if (hold.level === "possible") {
    score -= 10;
    reasons.push({ good: false, text: `Gusty up top (${Math.round(hold.mph)} mph)` });
  }
  const feelsF = Number.isFinite(summit.feels) ? (summit.feels * 9) / 5 + 32 : null;
  if (feelsF !== null && feelsF <= -15) {
    score -= 20;
    reasons.push({ good: false, text: `Bitter wind chill (${Math.round(feelsF)}°F)` });
  } else if (feelsF !== null && feelsF <= 0) {
    score -= 8;
    reasons.push({ good: false, text: `Cold up top (feels ${Math.round(feelsF)}°F)` });
  }
  const baseRain = base ? base.rain : summit.rain;
  if (baseRain >= 1) {
    score -= 20;
    reasons.push({ good: false, text: "Rain at the base" });
  }
  const warm = base ? base.temp : summit.temp;
  if (Number.isFinite(warm) && warm >= 7 && freshIn < 2) {
    score -= 8;
    reasons.push({ good: false, text: "Warm: soft, slushy snow by afternoon" });
  }
  if (Number.isFinite(summit.vis) && summit.vis < 800) {
    score -= 8;
    reasons.push({ good: false, text: "Low visibility, flat light" });
  } else if (Number.isFinite(summit.cloud) && summit.cloud < 30 && freshIn >= 2) {
    score += 8;
    reasons.push({ good: true, text: "Sun after the storm" });
  } else if (Number.isFinite(summit.cloud) && summit.cloud < 30) {
    score += 4;
    reasons.push({ good: true, text: "Sunny" });
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = freshIn >= 6 && hold.level !== "likely" ? "Powder day" : score >= 75 ? "Great" : score >= 60 ? "Good" : score >= 45 ? "Fair" : "Tough";
  return { score, label, reasons, freshCm: fresh };
}

// ---- Crowds ----

const pad = n => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** The nth weekday (0 = Sunday) of a month, as a day of the month. */
function nthWeekday(y, m, weekday, n) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** US holiday periods that crowd ski areas, for the season that includes `day`. */
export function skiHolidays(year) {
  const out = new Map();
  const add = (date, name) => out.set(date, name);
  const thanks = nthWeekday(year, 11, 4, 4);
  add(iso(year, 11, thanks), "Thanksgiving");
  add(iso(year, 11, thanks + 1), "Thanksgiving weekend");
  for (let d = 20; d <= 31; d++) add(iso(year, 12, d), "Holiday week");
  for (let d = 1; d <= 2; d++) add(iso(year, 1, d), "New Year's");
  const mlk = nthWeekday(year, 1, 1, 3);
  add(iso(year, 1, mlk), "MLK Day");
  add(iso(year, 1, mlk - 1), "MLK weekend");
  add(iso(year, 1, mlk - 2), "MLK weekend");
  const pres = nthWeekday(year, 2, 1, 3);
  for (let d = pres - 2; d <= pres + 4; d++) add(iso(year, 2, d), d === pres ? "Presidents' Day" : "Presidents' week");
  return out;
}

/**
 * How busy the lifts are likely to be (an estimate: no resort publishes lift
 * lines). Weekends, holidays and fresh snow fill the lots.
 */
export function crowdOutlook(day, freshCm = 0) {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const holiday = skiHolidays(y).get(day) ?? null;
  const weekend = weekday === 0 || weekday === 6;
  const powder = freshCm / CM_PER_IN >= 6;
  let level = 1;
  if (weekend) level += 1;
  if (holiday) level += 2;
  if (powder) level += 1;
  if (weekday === 5 && !holiday) level += 0.5;
  const label = level >= 4 ? "Very busy" : level >= 3 ? "Busy" : level >= 2 ? "Moderate" : "Quiet";
  const why = [holiday, weekend ? "weekend" : null, powder ? "powder day" : null].filter(Boolean);
  return { level: Math.min(4, Math.floor(level)), label, why: why.length ? why.join(", ") : "midweek" };
}

// ---- Avalanche danger ----

export const DANGER = [
  { level: -1, name: "No rating", color: "#8a96a3" },
  { level: 0, name: "No rating", color: "#8a96a3" },
  { level: 1, name: "Low", color: "#50b848" },
  { level: 2, name: "Moderate", color: "#fff200" },
  { level: 3, name: "Considerable", color: "#f7941e" },
  { level: 4, name: "High", color: "#ed1c24" },
  { level: 5, name: "Extreme", color: "#231f20" },
];
export const danger = level => DANGER.find(d => d.level === level) ?? DANGER[0];

const CA_LEVEL = { low: 1, moderate: 2, considerable: 3, high: 4, extreme: 5 };
export const canadaLevel = value => CA_LEVEL[value] ?? -1;

// ---- Geometry ----

export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function inRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when a point is inside a GeoJSON Polygon or MultiPolygon. */
export function inGeometry(lat, lon, geometry) {
  if (!geometry) return false;
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polys.some(([outer, ...holes]) => outer && inRing(lat, lon, outer) && !holes.some(h => inRing(lat, lon, h)));
}

/** n points spread evenly along a [[lon, lat], ...] line by distance. */
export function samplePath(coords, n) {
  if (!coords?.length) return [];
  if (coords.length === 1 || n <= 1) return [{ lat: coords[0][1], lon: coords[0][0], km: 0 }];
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distanceKm({ lat: coords[i - 1][1], lon: coords[i - 1][0] }, { lat: coords[i][1], lon: coords[i][0] }));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j]) / span));
    out.push({ lat: coords[j][1] + (coords[j + 1][1] - coords[j][1]) * f, lon: coords[j][0] + (coords[j + 1][0] - coords[j][0]) * f, km: target });
  }
  return out;
}

/**
 * Road weather at one point along the drive: snow falling or on the way,
 * freezing temperatures. hours are the point's forecast around the time you
 * pass it. -> { level: "ok" | "wet" | "icy" | "snow", text }
 */
export function roadWeather(hours) {
  if (!hours?.length) return { level: "ok", text: "No data" };
  const snow = hours.reduce((s, h) => s + (h.snow || 0), 0);
  const rain = hours.reduce((s, h) => s + (h.rain || 0), 0);
  const coldest = Math.min(...hours.map(h => h.temp));
  if (snow >= 1) return { level: "snow", text: `Snowing (${(snow / CM_PER_IN).toFixed(1)}″/hr-ish)` };
  if (snow > 0.1) return { level: "snow", text: "Light snow" };
  if (rain > 0.2 && coldest <= 0.5) return { level: "icy", text: "Freezing rain or ice possible" };
  if (coldest <= -1) return { level: "icy", text: "Below freezing: watch for ice" };
  if (rain > 0.2) return { level: "wet", text: "Rain" };
  return { level: "ok", text: "Dry" };
}

/** A whole drive's worst road weather. */
export function worstRoad(list) {
  const rank = { ok: 0, wet: 1, icy: 2, snow: 3 };
  return list.reduce((w, r) => (rank[r.level] > rank[w.level] ? r : w), { level: "ok", text: "Dry roads expected" });
}

/** Local "YYYY-MM-DD" for a Date. */
export const localDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Region a resort's state or province belongs to, for grouping the list. */
export const REGIONS = [
  { id: "co", name: "Colorado", states: ["CO"] },
  { id: "ut", name: "Utah", states: ["UT"] },
  { id: "ca", name: "California & Nevada", states: ["CA", "NV"] },
  { id: "pnw", name: "Pacific Northwest", states: ["WA", "OR"] },
  { id: "rockies", name: "Idaho, Montana & Wyoming", states: ["ID", "MT", "WY"] },
  { id: "sw", name: "New Mexico & Arizona", states: ["NM", "AZ"] },
  { id: "ak", name: "Alaska", states: ["AK"] },
  { id: "ne", name: "Northeast", states: ["VT", "NH", "ME", "NY", "MA"] },
  { id: "east", name: "Mid-Atlantic & South", states: ["PA", "WV", "NC"] },
  { id: "mw", name: "Midwest", states: ["MI", "WI", "MN"] },
  { id: "cw", name: "Western Canada", states: ["BC", "AB"] },
  { id: "ce", name: "Eastern Canada", states: ["ON", "QC"] },
];
export const regionOf = state => REGIONS.find(r => r.states.includes(state)) ?? null;
