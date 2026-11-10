// How hard a plant is to keep alive where you live, how often it needs you,
// and the jobs that fall on a given day. Plain functions, testable in Node.

import { cToF } from "./climate.js";
import { anchorDays, inPeriod, windowsBetween, ACTIONS } from "./calendar.js";
import { dayNum, dayKey, weekday, dateOfMonth, yearOf } from "./dates.js";

// ── Difficulty for your area ───────────────────────────────────

export const RATINGS = [
  null,
  { id: 1, name: "Very easy", hint: "Hard to kill here" },
  { id: 2, name: "Easy", hint: "Thrives with basic care" },
  { id: 3, name: "Moderate", hint: "Needs some attention" },
  { id: 4, name: "Fussy", hint: "Needs regular attention" },
  { id: 5, name: "Hard", hint: "A challenge here" },
  { id: 6, name: "Not suited", hint: "Won't last here" },
];

const isSeasonal = p => !p.zones;
// Cool-season crops shrug off light frost and keep going into early winter.
export const isFrostHardy = p => ["coolSow", "coolVeg", "garlic", "onion"].includes(p.when);

/**
 * rate(plant, climate, light?) → { score 1..6, rating, reasons: [string] }
 * light is the spot's light ("full" | "part" | "shade") when rating for a
 * particular spot.
 */
export function rate(plant, climate, light = null) {
  let score = plant.base;
  const reasons = [];
  let unsuited = false;
  const add = (n, why) => {
    score += n;
    reasons.push(why);
  };

  if (climate) {
    const z = Math.floor(climate.zone);
    if (plant.zones) {
      const [min, max] = plant.zones;
      if (z < min) {
        if (plant.when === "tenderBulb") add(1, "Winters are too cold to leave it in the ground: dig and store it each fall");
        else if (plant.tags.includes("container") && z >= min - 3) add(2, `Too cold for it in winter (needs zone ${min}+). Grow it in a pot and bring it inside`);
        else {
          unsuited = true;
          reasons.push(`Winters are too cold here (it needs zone ${min} or warmer)`);
        }
      } else if (z > max) {
        if (z === max + 1) add(1, "Winters are a bit warm for it");
        else {
          unsuited = true;
          reasons.push(plant.type === "grass" ? "Too hot here for this cool-season grass" : `Winters are too warm (it needs the cold of zone ${max} or cooler)`);
        }
      } else if (z === min && !plant.tags.includes("native")) {
        add(1, "At the cold edge of its range: mulch or shelter it in hard winters");
      }
    }
    if (plant.type === "bulb" && plant.when === "bulbFall" && climate.frostless) add(1, "No winter chill: chill bulbs in the fridge for 8–12 weeks before planting, or treat them as annuals");
    if (isSeasonal(plant) && plant.days && plant.when !== "garlic") {
      const need = plant.days + (plant.indoors ? 0 : 7);
      if (!climate.frostless && climate.frostFree < need) {
        unsuited = true;
        reasons.push(`Season too short: about ${climate.frostFree} frost-free days, it needs ${need}`);
      } else if (!climate.frostless && climate.frostFree < need + 30) {
        add(1, "Short season: pick early varieties or start it inside");
      }
    }
    if (climate.summerHigh != null) {
      if (plant.heat === 1 && climate.summerHigh >= 34) add(2, `Hot summers (highs around ${Math.round(cToF(climate.summerHigh))}°F) stress it: give it afternoon shade`);
      else if (plant.heat === 1 && climate.summerHigh >= 30) add(1, "Warm summers: it does best in spring and fall, or with afternoon shade");
      else if (plant.heat === 3 && climate.summerHigh < 22) add(1, "Cool summers slow it down: use the warmest spot you have");
    }
    if (climate.summerRain != null) {
      if (plant.water === 3 && climate.summerRain < 30) add(1, "Dry summers: needs watering often");
      if (plant.water === 1 && climate.annualRain > 1400) add(1, "Wet climate: needs very good drainage");
    }
  }

  if (light) {
    if (!plant.sun.includes(light)) {
      if (light === "shade" && !plant.sun.includes("part")) {
        unsuited = true;
        reasons.push("Too shady: it needs sun");
      } else if (light === "full" && !plant.sun.includes("part")) {
        add(2, "Too much sun: it burns");
      } else if (light === "full") add(2, "More sun than it likes: expect scorched leaves unless it gets afternoon shade and extra water");
      else add(1, "A bit shady for it: expect fewer flowers or fruit");
    }
  }

  const final = unsuited ? 6 : Math.max(1, Math.min(5, score));
  return { score: final, rating: RATINGS[final], reasons };
}

// ── How often it needs you ─────────────────────────────────────

export const FREQ = {
  daily: { rank: 0, name: "Daily", word: "Daily" },
  every2: { rank: 1, name: "Every 2–3 days", word: "Daily" },
  weekly: { rank: 2, name: "Weekly", word: "Weekly" },
  biweekly: { rank: 3, name: "Every 2 weeks", word: "Weekly" },
  monthly: { rank: 4, name: "Monthly", word: "Monthly" },
  yearly: { rank: 5, name: "A few times a year", word: "Seasonal" },
  never: { rank: 6, name: "Never", word: "Never" },
};
export const CADENCE_WORDS = ["Daily", "Weekly", "Monthly", "Seasonal", "Never"];

export const KINDS = {
  water: { name: "Water", verb: "Water", group: "water" },
  trim: { name: "Trim", verb: "Trim", group: "trim" },
  deadhead: { name: "Deadhead", verb: "Deadhead", group: "trim" },
  divide: { name: "Divide", verb: "Divide", group: "trim" },
  feed: { name: "Feed", verb: "Feed", group: "feed" },
  mulch: { name: "Mulch", verb: "Mulch", group: "feed" },
  sun: { name: "Sunlight", verb: "Check light for", group: "sun" },
  check: { name: "Check", verb: "Check", group: "other" },
  protect: { name: "Protect", verb: "Protect", group: "other" },
  weed: { name: "Weed", verb: "Weed around", group: "other" },
  mow: { name: "Mow", verb: "Mow", group: "other" },
  aerate: { name: "Aerate", verb: "Aerate", group: "other" },
  harvest: { name: "Harvest", verb: "Harvest", group: "other" },
};

export const GROUPS = [
  { id: "water", name: "Watering" },
  { id: "trim", name: "Trimming" },
  { id: "feed", name: "Nutrients" },
  { id: "sun", name: "Sunlight" },
  { id: "other", name: "Other upkeep" },
];

// Dry summers mean watering more often than the tag says.
function climateFreq(care, climate) {
  if (care.kind !== "water" || !climate || climate.summerRain == null || care.freq === "never") return { freq: care.freq, adjusted: false };
  if (climate.summerRain < 25) {
    const order = ["daily", "every2", "weekly", "biweekly", "monthly"];
    const i = order.indexOf(care.freq);
    if (i > 0) return { freq: order[i - 1], adjusted: true };
  }
  return { freq: care.freq, adjusted: false };
}

/**
 * For each group (watering, trimming, nutrients, sunlight, other): how often
 * it needs you, in the words Daily / Weekly / Monthly / Seasonal / Never.
 */
export function cadence(plant, climate) {
  return GROUPS.map(g => {
    const items = plant.care.filter(c => KINDS[c.kind]?.group === g.id).map(c => ({ ...c, ...climateFreq(c, climate) }));
    const ongoing = items.filter(c => !c.firstYear && c.freq !== "never");
    const firstYear = items.filter(c => c.firstYear);
    let word = "Never";
    let detail = "";
    if (ongoing.length) {
      const top = ongoing.reduce((a, b) => (FREQ[a.freq].rank <= FREQ[b.freq].rank ? a : b));
      word = FREQ[top.freq].word;
      detail = top.note;
    } else if (firstYear.length) {
      word = "Never";
      detail = `${FREQ[firstYear[0].freq].name} in the first year, then rain does the job`;
    } else if (items.length) {
      detail = items[0].note;
    }
    if (g.id === "sun") {
      detail = plant.sun.includes("full") && plant.sun.length === 1 ? "Pick a sunny spot once and you're set" : plant.sun.includes("shade") && !plant.sun.includes("full") ? "Pick a shady spot once and you're set" : "Pick the right spot once and you're set";
    }
    return { ...g, word, detail, adjusted: items.some(c => c.adjusted) };
  });
}

// ── Jobs for a day ─────────────────────────────────────────────

/**
 * Jobs for one garden entry on one day.
 * entry: { id, plantId, status: "growing"|"planned", planted: "YYYY-MM-DD"|null }
 * prefs.gardenDay: weekday (0 = Sunday) for weekly jobs.
 */
export function entryTasks(entry, plant, climate, day, prefs = {}) {
  if (!plant || !climate) return [];
  const d = dayNum(day);
  const key = dayKey(d);
  const gardenDay = prefs.gardenDay ?? 6;
  const out = [];
  const name = entry.name || plant.name;

  if (entry.status === "planned") {
    // Planting reminders on the day each window opens.
    for (const w of windowsBetween(plant, climate, d, d)) {
      if (w.action === "harvest" || w.start !== d) continue;
      out.push({ id: `${entry.id}:${w.action}:${key}`, entryId: entry.id, kind: "plant", action: w.action, title: `${ACTIONS[w.action].short}: ${name}`, note: `${ACTIONS[w.action].name} now through ${endLabel(w.end)}` });
    }
    return out;
  }

  const planted = entry.planted ? dayNum(entry.planted) : null;
  if (planted != null && d < planted) return out;
  // Annuals and vegetables finish at the first fall frost after planting.
  if (!plant.zones && planted != null && !climate.frostless) {
    const ff = windowsEndAfter(climate, planted);
    if (d > ff + (isFrostHardy(plant) ? 42 : 0) && plant.when !== "garlic") return out;
  }

  for (const [i, c] of plant.care.entries()) {
    if (c.freq === "never") continue;
    if (c.firstYear && planted != null && d > planted + 365) continue;
    const { freq } = climateFreq(c, climate);
    let due = false;
    if (freq === "yearly") {
      const anchors = c.anchors.length ? c.anchors : ["spring"];
      due = anchors.some(a => anchorDays(a, climate, yearOf(d)).includes(d));
    } else {
      const period = c.anchors[0] ?? "growing";
      let inside;
      if (period === "harvest") inside = harvestOpen(plant, climate, planted, d);
      else inside = inPeriod(period, climate, d);
      if (inside) due = onCadence(freq, d, planted, gardenDay);
    }
    if (!due) continue;
    const verb = KINDS[c.kind]?.verb ?? c.kind;
    out.push({ id: `${entry.id}:${c.kind}${i}:${key}`, entryId: entry.id, kind: c.kind, title: `${verb} · ${name}`, note: c.note });
  }
  return out;
}

function endLabel(num) {
  const d = new Date(num * 86400000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function windowsEndAfter(climate, planted) {
  // The first fall frost that follows the planting day.
  for (const y of [yearOf(planted) - 1, yearOf(planted), yearOf(planted) + 1]) {
    const lf = Math.round(Date.UTC(y, 0, 1) / 86400000) + climate.lastFrost - 1;
    const ff = lf + climate.frostFree;
    if (ff >= planted) return ff;
  }
  return Infinity;
}

function harvestOpen(plant, climate, planted, d) {
  if (planted == null || !plant.days) return inPeriod("summer", climate, d);
  return d >= planted + plant.days;
}

function onCadence(freq, d, planted, gardenDay) {
  switch (freq) {
    case "daily":
      return true;
    case "every2":
      return (d - (planted ?? 0)) % 2 === 0;
    case "weekly":
      return weekday(d) === gardenDay;
    case "biweekly":
      return weekday(d) === gardenDay && Math.floor(d / 7) % 2 === 0;
    case "monthly":
      return weekday(d) === gardenDay && dateOfMonth(d) <= 7;
    default:
      return false;
  }
}

/** All jobs for a garden on a day. */
export function dayTasks(garden, plantsById, climate, day, prefs) {
  return garden.flatMap(e => entryTasks(e, plantsById.get(e.plantId), climate, day, prefs));
}
