// What the planner points out: car checks, what to wear, the best time to
// train outside, garden care, traffic near games, closures and bills.
// Plain functions, testable in Node.

import { activitiesById } from "../../clocast/data/activities.js";
import { garments } from "../../clocast/data/garments.js";
import { planOutfit } from "../../clocast/model/plan.js";
import { rankStarts, scoreWindow } from "../../clocast/model/score.js";
import { formatHour } from "../../clocast/units.js";
import { addDays, daysBetween, formatTime, parseDay } from "./dates.js";

const isSnowCode = code => (code >= 71 && code <= 77) || code === 85 || code === 86;
const isStormCode = code => code >= 95;
const defaultFormat = c => `${Math.round(c)}°C`;

/**
 * Car checks from the daily forecast. days: [{ day, high, low, code,
 * precip, precipProb, wind }] in °C, mm and m/s.
 */
export function carChecks(days, { formatTemp = defaultFormat } = {}) {
  const tips = [];
  let warnedFreeze = false;
  days.forEach((d, i) => {
    const prev = days[i - 1];
    if (d.low <= 0 && !warnedFreeze) {
      warnedFreeze = true;
      tips.push({
        day: d.day,
        kind: "car",
        tone: "caution",
        title: `First freeze: ${formatTemp(d.low)} overnight`,
        text: "Check tire pressure (it drops about 1 psi for every 10°F), top up with winter washer fluid, and keep a scraper in the car. Leave a few extra minutes to clear frost.",
      });
    } else if (d.low <= -12) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "warn",
        title: `Hard cold: ${formatTemp(d.low)}`,
        text: "Cold is hard on weak batteries. If yours is over three years old, get it tested. Keep the tank at least half full and plug in a block heater if you have one.",
      });
    }
    if (prev && prev.high - d.high >= 11) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "info",
        title: `Big temperature drop (${formatTemp(prev.high - d.high, { delta: true })})`,
        text: "Tire pressure falls with the temperature, so a low-pressure light may come on. Check the tires cold, before driving.",
      });
    }
    if (isSnowCode(d.code) && (d.precip ?? 0) >= 1) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "warn",
        title: "Snow on the roads",
        text: "Check tire tread and wipers, pack a brush, gloves and a blanket, and allow extra time. Clear snow off the roof before you go.",
      });
    } else if ((d.precip ?? 0) >= 12 || (d.precipProb ?? 0) >= 80) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "caution",
        title: "Heavy rain",
        text: "Streaky wipers are worth replacing before this. Drive with headlights on, slow down for standing water, and leave more following distance.",
      });
    }
    if (d.high >= 35) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "warn",
        title: `Extreme heat: ${formatTemp(d.high)}`,
        text: "Check the coolant level and tire pressure. Heat drains batteries too. Never leave kids or pets in the car, even for a minute.",
      });
    }
    if ((d.wind ?? 0) >= 14) {
      tips.push({
        day: d.day,
        kind: "car",
        tone: "caution",
        title: "High winds",
        text: "Expect strong crosswinds on bridges and open highways, especially in tall vehicles. Watch for downed branches.",
      });
    }
  });
  return tips;
}

/** Garden care from the daily forecast. */
export function gardenTips(days, { formatTemp = defaultFormat } = {}) {
  const tips = [];
  let dryRun = 0;
  days.forEach((d, i) => {
    if (d.low <= -2) {
      tips.push({
        day: d.day,
        kind: "garden",
        tone: "warn",
        title: `Hard freeze: ${formatTemp(d.low)}`,
        text: "Tender plants won't survive this. Harvest what's left, bring pots inside, and disconnect and drain garden hoses.",
      });
    } else if (d.low <= 2) {
      tips.push({
        day: d.day,
        kind: "garden",
        tone: "caution",
        title: `Frost likely: ${formatTemp(d.low)}`,
        text: "Cover tender plants with a sheet or frost cloth before sunset, water the soil in the afternoon (moist soil holds heat), and bring pots in.",
      });
    }
    const dry = (d.precip ?? 0) < 1 && (d.precipProb ?? 0) < 40;
    dryRun = dry ? dryRun + 1 : 0;
    if (dryRun === 4 && d.high >= 24) {
      tips.push({
        day: d.day,
        kind: "garden",
        tone: "info",
        title: "Dry stretch: time to water",
        text: "Four dry, warm days in a row. Water deeply in the early morning rather than a little every day.",
      });
    }
    const next = days[i + 1];
    if (next && (next.precip ?? 0) >= 8 && dry) {
      tips.push({
        day: d.day,
        kind: "garden",
        tone: "good",
        title: "Skip watering",
        text: `About ${Math.round(next.precip)} mm of rain is due tomorrow. Good day to plant or spread seed so the rain waters it in.`,
      });
    }
  });
  return tips;
}

// Northern-hemisphere, temperate-climate jobs for each month.
export const GARDEN_MONTHS = [
  "Order seeds and plan beds. Prune fruit trees while they're dormant.",
  "Start peppers and onions indoors. Prune roses late in the month.",
  "Start tomatoes indoors. Sow peas and spinach outside once the soil can be worked.",
  "Plant potatoes, lettuce and other cool-season crops. Watch for late frosts.",
  "Plant tomatoes, squash and beans after the last frost. Mulch beds.",
  "Water deeply in the mornings. Pick off pests and keep weeding.",
  "Harvest often to keep plants producing. Water containers daily in heat.",
  "Sow fall greens. Keep up the watering through dry spells.",
  "Plant garlic beds, divide perennials, and seed or patch the lawn.",
  "Plant garlic and spring bulbs. Rake leaves into compost or mulch.",
  "Clean and store tools, drain hoses, and mulch perennials after the ground freezes.",
  "Plan next year. Check stored bulbs and give houseplants extra light.",
];

// Daytime hours of a day, used for the day's outfit.
const daytime = (hours, day) => hours.filter(h => h.localDay === day && h.localHour >= 9 && h.localHour <= 18);

/** What to wear out and about on a day (9 AM to 7 PM), or at a set time. */
export function wearFor(hours, day, place, { time = null, durationHours = 2, activityId = "errands", options = {} } = {}) {
  const activity = activitiesById.get(activityId) ?? activitiesById.get("errands");
  let window = daytime(hours, day);
  if (time) {
    const start = Number(time.split(":")[0]);
    window = hours.filter(h => h.localDay === day && h.localHour >= start && h.localHour < start + durationHours);
  }
  if (!window.length || !place) return null;
  const plan = planOutfit(window, place, activity, options);
  const layers = plan.outfit.items
    .map(id => garments[id])
    .filter(g => g && !g.hidden && ["top", "outer", "legs"].includes(g.region))
    .map(g => g.name);
  return {
    name: plan.outfit.name,
    layers,
    extras: plan.extras.map(e => e.text),
    warnings: plan.warnings.map(w => w.text),
    summary: plan.summary,
  };
}

/**
 * Best time for an outdoor session on a day. With a planned time, says
 * how it scores and whether another time is clearly better.
 */
export function trainingAdvice(hours, day, place, { activityId = "run-easy", time = null, minutes = 60, notBefore = 0, options = {} } = {}) {
  const activity = activitiesById.get(activityId);
  if (!activity || !place) return null;
  const duration = Math.max(1, Math.round(minutes / 60));
  const ranked = rankStarts(hours, place, activity, { day, duration, earliest: 5, latest: 21, notBefore, options });
  const best = ranked[0];
  if (!best) return null;
  let chosen = null;
  if (time) {
    const start = Number(time.split(":")[0]);
    const window = hours.filter(h => h.localDay === day && h.localHour >= start && h.localHour < start + duration);
    if (window.length === duration) chosen = { startHour: start, ...scoreWindow(window, place, activity, options) };
  }
  const better = chosen && best.startHour !== chosen.startHour && best.score - chosen.score >= 10 ? best : null;
  return { activity, best, chosen, better, reasons: (chosen ?? best).factors.filter(f => f.penalty >= 5).map(f => f.text) };
}

const normalize = text => String(text ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// A game is "in" a place when its venue city matches the place name.
export function gameInPlace(game, place) {
  if (!place) return false;
  const city = normalize(game.venueCity);
  const name = normalize(typeof place === "string" ? place : place.name);
  return Boolean(city && name && (city === name || name.startsWith(`${city} `) || city.startsWith(`${name} `)));
}

/**
 * Personal events in a city on the same day as a game there: go to the
 * game, or allow for traffic and crowds.
 */
export function eventConflicts(instances, games) {
  const tips = [];
  for (const event of instances) {
    if (!event.place) continue;
    const there = games.filter(g => g.day === event.day && gameInPlace(g, event.place));
    for (const game of there.slice(0, 2)) {
      const at = game.start ? new Date(game.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD";
      tips.push({
        day: event.day,
        kind: "traffic",
        tone: "caution",
        title: `${game.away.name} at ${game.home.name} in ${game.venueCity}`,
        text: `Your "${event.title}" is in ${event.place.name} the same day. The game is at ${at}${game.venue ? ` at ${game.venue}` : ""}. Make a night of it, or plan for traffic and crowds around the stadium.`,
      });
    }
  }
  return tips;
}

/**
 * Notes for one day's personal items: bills due on a weekend or holiday,
 * and items left undone.
 */
export function itemNotes(instances, holidays, today) {
  const tips = [];
  const closed = new Map(holidays.filter(h => h.closed).map(h => [h.day, h]));
  for (const item of instances) {
    if (item.kind === "bill" && !item.done) {
      const weekday = parseDay(item.day).getDay();
      const holiday = closed.get(item.day);
      if (weekday === 0 || weekday === 6 || holiday) {
        let payBy = addDays(item.day, -1);
        while ([0, 6].includes(parseDay(payBy).getDay()) || closed.has(payBy)) payBy = addDays(payBy, -1);
        tips.push({
          day: item.day,
          kind: "bill",
          tone: "caution",
          title: `${item.title} is due on a ${holiday ? "holiday" : "weekend"}`,
          text: `Banks may not post payments that day. Pay by ${parseDay(payBy).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} to be safe.`,
        });
      }
    }
    if ((item.kind === "task" || item.kind === "bill" || item.kind === "deadline") && item.repeat === "none" && !item.done && item.day < today) {
      tips.push({ day: item.day, kind: "overdue", tone: "warn", title: `Overdue: ${item.title}`, text: `Was due ${daysBetween(item.day, today)} day${daysBetween(item.day, today) === 1 ? "" : "s"} ago.` });
    }
  }
  return tips;
}

/**
 * The heads-up list: what's coming in the next two weeks that is worth
 * acting on now. Returns tips sorted by day, each with a day key.
 */
export function headsUp({ today, forecast, place, instances = [], games = [], holidays = [], layers = {}, formatTemp = defaultFormat, trainingActivityId = "run-easy", options = {}, now = Date.now(), forecastFor = () => null }) {
  const end = addDays(today, 14);
  const soon = list => list.filter(t => t.day >= today && t.day <= end);
  const tips = [];
  const days = forecast?.days ?? [];
  const hours = forecast?.hours ?? [];

  if (layers.car !== false) tips.push(...carChecks(days, { formatTemp }));
  if (layers.garden) tips.push(...gardenTips(days, { formatTemp }));

  if (layers.holidays !== false) {
    for (const h of soon(holidays)) {
      if (!h.note) continue;
      tips.push({ day: h.day, kind: h.closed ? "closed" : "holiday", tone: h.closed ? "caution" : "info", title: h.name, text: h.note });
    }
  }

  tips.push(...eventConflicts(soon(instances), games));
  tips.push(...itemNotes(instances.filter(i => i.day <= end), holidays, today));

  for (const item of soon(instances)) {
    if (item.done) continue;
    if (item.kind === "bill" && daysBetween(today, item.day) <= 7) {
      tips.push({
        day: item.day,
        kind: "bill",
        tone: "info",
        title: `${item.title}${item.amount ? ` · $${item.amount.toFixed(2)}` : ""}`,
        text: `Due ${daysBetween(today, item.day) === 0 ? "today" : `in ${daysBetween(today, item.day)} day${daysBetween(today, item.day) === 1 ? "" : "s"}`}.`,
      });
    }
    if (item.kind === "deadline") {
      tips.push({ day: item.day, kind: "deadline", tone: daysBetween(today, item.day) <= 3 ? "warn" : "info", title: item.title, text: `Deadline ${daysBetween(today, item.day) === 0 ? "today" : `in ${daysBetween(today, item.day)} days`}.` });
    }
    if (item.kind === "training" && hours.length) {
      const advice = trainingAdvice(hours, item.day, place, { activityId: item.activityId || trainingActivityId, time: item.time, minutes: item.minutes ?? 60, notBefore: now, options });
      if (advice?.better) {
        tips.push({
          day: item.day,
          kind: "train",
          tone: "info",
          title: `Better time for ${item.title}: ${formatHour(advice.better.startHour)}`,
          text: `${formatHour(advice.better.startHour)} scores ${advice.better.score} against ${advice.chosen.score} at ${formatTime(item.time)}${advice.reasons.length ? ` (${advice.reasons.join(", ")})` : ""}.`,
        });
      }
    }
    const itemHours = (item.place && forecastFor(item.place)?.hours) || hours;
    if (item.kind === "event" && item.outdoor && itemHours.length) {
      const dayHours = itemHours.filter(h => h.localDay === item.day);
      const start = item.time ? Number(item.time.split(":")[0]) : 8;
      const window = dayHours.filter(h => h.localHour >= start && h.localHour < start + (item.time ? 3 : 12));
      const rain = Math.max(0, ...window.map(h => h.precipProb ?? 0));
      const storm = window.some(h => isStormCode(h.code ?? 0));
      if (rain >= 50 || storm) {
        tips.push({
          day: item.day,
          kind: "rain",
          tone: "caution",
          title: `${storm ? "Storms" : "Rain"} likely for ${item.title}`,
          text: `Up to ${rain}% chance${storm ? " with thunderstorms" : ""}${item.place ? ` in ${item.place.name}` : ""}. Have an indoor backup or pack rain gear.`,
        });
      }
    }
  }

  return tips
    .filter(t => (t.day >= today && t.day <= end) || t.kind === "overdue")
    .sort((a, b) => a.day.localeCompare(b.day));
}
