// The day's briefing: the things worth knowing before heading out, in
// plain language. Plain functions, testable in Node.

import { heatIndex } from "./plan.js";
import { formatHour } from "../units.js";

const range = (from, to) => `${formatHour(from)}–${formatHour((to + 1) % 24)}`;

// Consecutive hours (by localHour) that pass a test, as [first, last] pairs.
function spans(hours, test) {
  const out = [];
  for (const hour of hours) {
    if (!test(hour)) continue;
    const last = out[out.length - 1];
    if (last && hour.localHour === last[1] + 1) last[1] = hour.localHour;
    else out.push([hour.localHour, hour.localHour]);
  }
  return out;
}

/**
 * Tips for the rest of one day. hours: the forecast hours still to come
 * that day. formatTemp(c) formats °C. Returns [{ kind, tone, title, text }].
 */
export function dailyBriefing(hours, { formatTemp = c => `${Math.round(c)}°C` } = {}) {
  const tips = [];
  if (!hours.length) return tips;
  const daylight = hours.filter(h => h.isDay);

  const uvPeak = Math.max(...hours.map(h => h.uv ?? 0));
  if (uvPeak >= 3) {
    const strong = spans(hours, h => (h.uv ?? 0) >= 6);
    const peakHour = hours.find(h => h.uv === uvPeak);
    const spf = uvPeak >= 8 ? 50 : 30;
    tips.push({
      kind: "sun",
      tone: uvPeak >= 8 ? "warn" : uvPeak >= 6 ? "caution" : "info",
      title: `UV ${Math.round(uvPeak)} at ${formatHour(peakHour.localHour)}`,
      text: strong.length
        ? `UV is 6 or higher from ${range(...strong[0])}. Wear SPF ${spf}+, a hat and sunglasses, reapply every 2 hours (every 80 minutes if you're sweating), and look for shade then.`
        : `Use SPF ${spf}+ on exposed skin if you'll be out for more than half an hour.`,
    });
  }

  const withAir = hours.filter(h => Number.isFinite(h.aqi));
  if (withAir.length) {
    const worst = withAir.reduce((a, b) => (b.aqi > a.aqi ? b : a));
    const awake = withAir.filter(h => h.localHour >= 5 && h.localHour <= 21);
    const best = (awake.length ? awake : withAir).reduce((a, b) => (b.aqi < a.aqi ? b : a));
    if (worst.aqi > 100) {
      tips.push({
        kind: "air",
        tone: worst.aqi > 150 ? "warn" : "caution",
        title: `Air quality ${Math.round(worst.aqi)} at ${formatHour(worst.localHour)}`,
        text: `${worst.aqi > 150 ? "Unhealthy for everyone" : "Unhealthy for sensitive groups"} at its worst. The cleanest air is around ${formatHour(best.localHour)} (AQI ${Math.round(best.aqi)}), so put hard workouts then or move them indoors.`,
      });
    } else if (worst.aqi > 50) {
      tips.push({
        kind: "air",
        tone: "info",
        title: `Moderate air (AQI up to ${Math.round(worst.aqi)})`,
        text: `Fine for most people. If you're sensitive to pollution, ${formatHour(best.localHour)} has the cleanest air (AQI ${Math.round(best.aqi)}).`,
      });
    } else {
      tips.push({ kind: "air", tone: "good", title: "Clean air all day", text: `AQI stays at ${Math.round(worst.aqi)} or below.` });
    }
  }

  const wet = hours.find(h => (h.precipProb ?? 0) >= 50);
  const maybe = hours.find(h => (h.precipProb ?? 0) >= 30);
  if (wet) {
    const peak = Math.max(...hours.map(h => h.precipProb ?? 0));
    tips.push({
      kind: "rain",
      tone: "caution",
      title: `Rain likely from ${formatHour(wet.localHour)}`,
      text: `Chances reach ${peak}%. Plan outdoor things before then, or bring a waterproof layer.`,
    });
  } else if (maybe) {
    tips.push({ kind: "rain", tone: "info", title: `Chance of showers from ${formatHour(maybe.localHour)}`, text: "Worth packing a light shell." });
  } else {
    tips.push({ kind: "rain", tone: "good", title: "Dry", text: "No rain expected for the rest of the day." });
  }

  const hot = spans(daylight, h => heatIndex(h.temp, h.rh ?? 50) >= 30);
  if (hot.length) {
    const peak = daylight.reduce((a, b) => (heatIndex(b.temp, b.rh ?? 50) > heatIndex(a.temp, a.rh ?? 50) ? b : a));
    const cool = daylight.filter(h => heatIndex(h.temp, h.rh ?? 50) < 27);
    tips.push({
      kind: "heat",
      tone: "warn",
      title: `Hot from ${range(...hot[0])}`,
      text: `It feels like ${formatTemp(heatIndex(peak.temp, peak.rh ?? 50))} at ${formatHour(peak.localHour)}. ${cool.length ? `Exercise around ${formatHour(cool[0].localHour)} instead, ` : "Keep efforts easy, "}drink before you're thirsty, and take shade breaks.`,
    });
  }

  const coldest = hours.reduce((a, b) => ((b.apparent ?? b.temp) < (a.apparent ?? a.temp) ? b : a));
  if ((coldest.apparent ?? coldest.temp) <= -10) {
    tips.push({
      kind: "cold",
      tone: "warn",
      title: `Feels like ${formatTemp(coldest.apparent ?? coldest.temp)}`,
      text: "Frostbite can set in on exposed skin within 30 minutes. Cover your face, ears and hands.",
    });
  }

  const gusty = hours.find(h => (h.gust ?? 0) >= 15);
  if (gusty) {
    tips.push({
      kind: "wind",
      tone: "caution",
      title: `Gusty from ${formatHour(gusty.localHour)}`,
      text: "Gusts over 30 mph (50 km/h). Riding will be hard work and a windproof layer helps.",
    });
  }

  return tips;
}
