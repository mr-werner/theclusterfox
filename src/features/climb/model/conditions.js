// Is it a good day to climb? Friction, wet rock, heat, cold, wind. Reads
// the same Open-Meteo hourly forecast SkyFox uses (see
// src/services/weather/openMeteo.js) with two past days added, because the
// rain that fell yesterday matters as much as today's.
//
// Rules of thumb climbers use:
// - Friction is best cool and dry: about 4–16 °C (40–60 °F) with humidity
//   under ~60%. Above ~25 °C holds get greasy; below ~2 °C fingers go numb.
// - When the air is near its dew point, rock sweats.
// - Sandstone is weak when wet. Give it a day or two after real rain
//   (more after a soaking) or holds can snap and routes get damaged.
// - A breeze helps; gusts past ~40 km/h make leading and belaying miserable.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Rock types we can tell from an area's path. Sandstone gets the wet-rock rule. */
const SANDSTONE = ["red river gorge", "indian creek", "red rock", "new river gorge", "moab", "zion", "castleton", "fisher towers", "garden of the gods", "horseshoe canyon", "sandrock", "coopers rock", "obed", "tennessee wall", "sand rock", "little rock city", "stone fort", "hp40", "foster falls", "sam's throne", "jamestown", "kentucky"];

export function isSandstone(path = []) {
  const p = path.join(" / ").toLowerCase();
  return SANDSTONE.some(s => p.includes(s));
}

/** Score one hour of climbing weather, 0–100, with the reasons. */
export function scoreHour(h) {
  const reasons = [];
  let s = 100;
  const t = h.temp;
  if (t > 16) {
    const p = clamp((t - 16) * 4.5, 0, 70);
    s -= p;
    if (t > 24) reasons.push(t > 30 ? "Hot: holds will be greasy" : "Warm: friction suffers");
  } else if (t < 4) {
    const p = clamp((4 - t) * 5, 0, 70);
    s -= p;
    if (t < 2) reasons.push(t < -4 ? "Very cold: numb fingers" : "Cold: bring a puffy");
  }
  const rh = h.rh ?? 50;
  if (rh > 60) {
    s -= clamp((rh - 60) * 0.8, 0, 25);
    if (rh > 80) reasons.push("Humid");
  }
  if (Number.isFinite(h.dewPoint) && t - h.dewPoint < 2.5) {
    s -= 15;
    reasons.push("Rock may sweat (air near dew point)");
  }
  const gust = h.gust ?? h.wind ?? 0;
  if (gust > 11) {
    s -= clamp((gust - 11) * 4, 0, 40);
    if (gust > 14) reasons.push("Gusty");
  }
  if (h.precip > 0.2 || (h.precipProb ?? 0) >= 60) {
    s -= h.precip > 1 ? 80 : 50;
    reasons.push("Rain");
  } else if ((h.precipProb ?? 0) >= 35) {
    s -= 15;
    reasons.push("Chance of showers");
  }
  return { score: Math.round(clamp(s, 0, 100)), reasons };
}

export function label(score) {
  if (score >= 80) return { id: "prime", text: "Prime" };
  if (score >= 62) return { id: "good", text: "Good" };
  if (score >= 42) return { id: "fair", text: "Fair" };
  return { id: "poor", text: "Poor" };
}

/**
 * One summary per day from an hourly forecast:
 * [{ day, score, label, best: { from, to }, high, low, rainMm, wetRock, reasons }].
 * Daytime is 7 AM to 7 PM local. wetRock is set when enough rain fell in
 * the 36 hours before the day's best window that rock may still be wet.
 */
export function dailyConditions(hours, { sandstone = false, today } = {}) {
  const byDay = new Map();
  for (const h of hours) {
    if (!byDay.has(h.localDay)) byDay.set(h.localDay, []);
    byDay.get(h.localDay).push(h);
  }
  const out = [];
  for (const [day, list] of byDay) {
    if (today && day < today) continue;
    const daytime = list.filter(h => h.localHour >= 7 && h.localHour <= 19);
    if (daytime.length < 6) continue;
    const scored = daytime.map(h => ({ h, ...scoreHour(h) }));
    // Best 3-hour window.
    let best = null;
    for (let i = 0; i + 2 < scored.length; i++) {
      const avg = (scored[i].score + scored[i + 1].score + scored[i + 2].score) / 3;
      if (!best || avg > best.avg) best = { avg, i };
    }
    const window = scored.slice(best.i, best.i + 3);
    const start = window[0].h;
    // Rain in the 36 hours before the window started.
    const before = hours.filter(h => h.time < start.time && start.time - h.time <= 36 * 3600e3);
    const rainBefore = before.reduce((a, h) => a + (h.precip || 0), 0);
    const wetLimit = sandstone ? 2 : 6;
    const wetRock = rainBefore >= wetLimit;
    let score = Math.round(best.avg);
    const reasons = [...new Set(window.flatMap(w => w.reasons))];
    if (wetRock) {
      score = Math.min(score, sandstone ? 25 : 45);
      reasons.unshift(sandstone ? `Wet sandstone: ${Math.round(rainBefore)} mm fell in the last day and a half. Let it dry.` : `${Math.round(rainBefore)} mm of rain recently: seeps and wet holds likely`);
    }
    out.push({
      day,
      score,
      label: label(score),
      best: { from: window[0].h.localHour, to: window[2].h.localHour + 1 },
      high: Math.max(...daytime.map(h => h.temp)),
      low: Math.min(...list.map(h => h.temp)),
      rainMm: list.reduce((a, h) => a + (h.precip || 0), 0),
      wind: Math.max(...daytime.map(h => h.gust ?? h.wind ?? 0)),
      wetRock,
      reasons,
      advice: advice(daytime),
    });
  }
  return out;
}

/** Sun or shade? */
function advice(daytime) {
  const high = Math.max(...daytime.map(h => h.temp));
  const sunny = daytime.filter(h => (h.cloud ?? 50) < 40).length > daytime.length / 2;
  if (high >= 22) return sunny ? "Chase shade: north-facing walls, or east walls after noon." : "Warm: pick shaded or breezy walls.";
  if (high <= 8) return sunny ? "Chase the sun: south-facing walls warm up fast." : "Cold and grey: short approaches and warm layers.";
  return "Most aspects will climb well.";
}
