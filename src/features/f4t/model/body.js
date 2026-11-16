// Body math for the diet planner: how much energy a day takes, the target
// for your goal, how to split it into protein, carbs and fat, and what your
// weigh-ins say about how it's going. Pure functions.

import { caloriesPerMinute } from "../../../domain/exercise/energy.js";

export const LBS_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;
export const KCAL_PER_LB = 3500;

// Everyday movement, not counting planned workouts (those are added per day).
export const ACTIVITY = {
  desk: { name: "Mostly sitting", blurb: "Desk job, little walking", factor: 1.2 },
  light: { name: "On my feet some", blurb: "Some walking, errands, chores", factor: 1.35 },
  active: { name: "On my feet a lot", blurb: "Retail, teaching, a lot of walking", factor: 1.5 },
  physical: { name: "Physical work", blurb: "Construction, farm, warehouse", factor: 1.7 },
};

export const GOALS = {
  lose: { name: "Lose weight", verb: "losing" },
  maintain: { name: "Stay where I am", verb: "holding" },
  gain: { name: "Gain (build muscle)", verb: "gaining" },
};

// Pounds a week. Losing faster than about 1% of body weight a week costs muscle.
export const RATES = { lose: [0.5, 1, 1.5, 2], gain: [0.25, 0.5, 1], maintain: [0] };

// --- Your usual day -----------------------------------------------------------
// How big each meal usually is and how you usually get it. The planner
// splits the day's calories by size and fills each meal the way you eat it.

export const MEALS = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
// Typical share of the day for a regular-sized meal, before sizing.
const BASE_SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.35, snack: 0.1 };

export const SIZES = {
  skip: { name: "Skip it", weight: 0 },
  light: { name: "Light", weight: 0.35 },
  regular: { name: "Regular", weight: 1 },
  big: { name: "Big", weight: 1.7 },
};

export const HOWS = {
  cook: { name: "Cook", blurb: "A CookFox recipe, cooked that day" },
  prep: { name: "Meal prep", blurb: "Cooked ahead in a batch" },
  out: { name: "Eat out", blurb: "Restaurant or takeout, with ordering tips" },
  grab: { name: "Grab & go", blurb: "No cooking: coffee, yogurt, a wrap" },
};

const meal = (size, how) => ({ size, how });
export const DAY_PRESETS = {
  three: { name: "Three meals", day: { breakfast: meal("regular", "grab"), lunch: meal("regular", "prep"), dinner: meal("regular", "cook"), snack: meal("light", "grab") } },
  night: { name: "Coffee, skip lunch, big dinner", day: { breakfast: meal("light", "grab"), lunch: meal("skip", "grab"), dinner: meal("big", "cook"), snack: meal("light", "grab") } },
  noBreakfast: { name: "Skip breakfast", day: { breakfast: meal("skip", "grab"), lunch: meal("regular", "prep"), dinner: meal("big", "cook"), snack: meal("light", "grab") } },
  onTheGo: { name: "Busy, eat out a lot", day: { breakfast: meal("light", "out"), lunch: meal("regular", "out"), dinner: meal("regular", "cook"), snack: meal("light", "grab") } },
  grazer: { name: "Small meals and snacks", day: { breakfast: meal("regular", "grab"), lunch: meal("light", "grab"), dinner: meal("regular", "cook"), snack: meal("big", "grab") } },
};

// Before the usual day existed, every meal was cooked (or prepped) at regular size.
const legacyDay = style => Object.fromEntries(MEALS.map(m => [m, meal("regular", style === "prep" ? "prep" : "cook")]));

function cleanDay(day, style) {
  const base = legacyDay(style);
  if (!day || typeof day !== "object") return base;
  return Object.fromEntries(
    MEALS.map(m => {
      const d = day[m] ?? {};
      return [m, { size: SIZES[d.size] ? d.size : base[m].size, how: HOWS[d.how] ? d.how : base[m].how }];
    })
  );
}

/** Each meal's share of the day's calories, from how big it usually is. */
export function mealShares(profile) {
  const day = profile?.day ?? legacyDay();
  const raw = Object.fromEntries(MEALS.map(m => [m, BASE_SHARE[m] * SIZES[day[m].size].weight]));
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(MEALS.map(m => [m, raw[m] / total]));
}

export function emptyProfile() {
  return {
    sex: null, // "male" | "female" | null
    birthYear: null,
    heightCm: null,
    activity: "light",
    goal: "maintain",
    rate: 0,
    goalLbs: null,
    budget: null, // dollars a week for groceries
    people: 1, // how many people the plan feeds
    style: "daily", // "daily" cooks most days, "prep" batch-cooks for the week
    prepDay: 6, // 0 = Monday ... 6 = Sunday
    heightUnit: "in", // "in" | "cm"
    day: legacyDay("daily"), // your usual day, see DAY_PRESETS
    daySet: false, // true once you've told us about your usual day
    tips: true, // show the starting-out suggestions
  };
}

const isNum = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

export function cleanProfile(p) {
  const base = emptyProfile();
  if (!p || typeof p !== "object") return base;
  const goal = GOALS[p.goal] ? p.goal : base.goal;
  return {
    sex: p.sex === "male" || p.sex === "female" ? p.sex : null,
    birthYear: isNum(p.birthYear, 1900, 2030) ? Math.round(p.birthYear) : null,
    heightCm: isNum(p.heightCm, 90, 250) ? p.heightCm : null,
    activity: ACTIVITY[p.activity] ? p.activity : base.activity,
    goal,
    rate: RATES[goal].includes(p.rate) ? p.rate : RATES[goal][Math.min(1, RATES[goal].length - 1)],
    goalLbs: isNum(p.goalLbs, 50, 700) ? p.goalLbs : null,
    budget: isNum(p.budget, 1, 5000) ? p.budget : null,
    people: isNum(p.people, 1, 12) ? Math.round(p.people) : 1,
    style: p.style === "prep" ? "prep" : "daily",
    prepDay: isNum(p.prepDay, 0, 6) ? Math.round(p.prepDay) : 6,
    heightUnit: p.heightUnit === "cm" ? "cm" : "in",
    day: cleanDay(p.day, p.style),
    daySet: p.daySet === true,
    tips: p.tips !== false,
  };
}

export const ageOf = (profile, year = new Date().getFullYear()) => (profile.birthYear ? year - profile.birthYear : null);

/** True once the profile has what the energy math needs. */
export const profileReady = (profile, weightLbs) => Boolean(weightLbs && profile.heightCm && profile.birthYear);

/**
 * Resting energy (Mifflin-St Jeor). With sex left blank, the midpoint of the
 * two formulas is used.
 */
export function restingCalories(profile, weightLbs, year) {
  const age = ageOf(profile, year);
  if (!weightLbs || !profile.heightCm || !age) return null;
  const kg = weightLbs / LBS_PER_KG;
  const s = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  return 10 * kg + 6.25 * profile.heightCm - 5 * age + s;
}

/** A day's energy without workouts: resting energy times everyday movement. */
export function everydayCalories(profile, weightLbs, year) {
  const rest = restingCalories(profile, weightLbs, year);
  return rest ? rest * ACTIVITY[profile.activity].factor : null;
}

// Daily surplus or deficit for the goal.
export const goalAdjustment = profile =>
  profile.goal === "lose" ? -(profile.rate * KCAL_PER_LB) / 7 : profile.goal === "gain" ? (profile.rate * KCAL_PER_LB) / 7 : 0;

/** Lowest daily target the planner will suggest without a clinician. */
export const floorCalories = profile => (profile.sex === "male" ? 1500 : 1200);

/** Calories a workout burns above resting, for a weight. */
export const workoutCalories = (workout, weightLbs) =>
  Math.round(caloriesPerMinute(workout.met, weightLbs || 170, "net") * workout.minutes);

/**
 * The day's targets. workouts: [{ minutes, met }] planned that day.
 * Returns null until the profile is filled in.
 */
export function dayTargets(profile, weightLbs, workouts = [], year) {
  const everyday = everydayCalories(profile, weightLbs, year);
  if (!everyday) return null;
  const training = workouts.reduce((sum, w) => sum + workoutCalories(w, weightLbs), 0);
  const raw = everyday + training + goalAdjustment(profile);
  const floor = floorCalories(profile);
  const kcal = Math.round(Math.max(floor, raw) / 10) * 10;
  // Protein: about 0.7 g per pound (more while losing or training), capped for very heavy bodies.
  const perLb = profile.goal === "maintain" && !workouts.length ? 0.7 : 0.85;
  const protein = Math.round(Math.min(weightLbs, 260) * perLb);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, everyday: Math.round(everyday), training, floored: raw < floor };
}

// --- Weigh-ins -----------------------------------------------------------

const dayMs = 86400000;
const dayNum = day => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / dayMs;

/**
 * Smoothed weight: a moving average that ignores day-to-day water swings
 * (about a 10-day window). weights: [{ day, lbs }] in any order.
 */
export function weightTrend(weights) {
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const out = [];
  let trend = null;
  let last = null;
  for (const w of sorted) {
    if (trend === null) trend = w.lbs;
    else {
      const gap = Math.max(1, dayNum(w.day) - dayNum(last));
      const keep = Math.pow(0.9, gap);
      trend = trend * keep + w.lbs * (1 - keep);
    }
    last = w.day;
    out.push({ day: w.day, lbs: w.lbs, trend });
  }
  return out;
}

/**
 * Pounds a week your weight is moving: a straight-line fit through the last
 * four weeks of weigh-ins, so one salty dinner doesn't swing it. Null when
 * there isn't enough to tell (three weigh-ins over at least a week).
 */
export function weeklyChange(weights, today) {
  if (weights.length < 3) return null;
  const end = dayNum(today ?? [...weights].sort((a, b) => a.day.localeCompare(b.day)).at(-1).day);
  const recent = weights.filter(w => dayNum(w.day) >= end - 28 && dayNum(w.day) <= end);
  if (recent.length < 3) return null;
  const xs = recent.map(w => dayNum(w.day));
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = recent.reduce((a, w) => a + w.lbs, 0) / recent.length;
  let num = 0;
  let den = 0;
  recent.forEach((w, i) => {
    num += (xs[i] - mx) * (w.lbs - my);
    den += (xs[i] - mx) ** 2;
  });
  return den ? (num / den) * 7 : null;
}

/**
 * Plain feedback on the weigh-ins against the goal:
 * { tone: "good" | "nudge" | "info", title, text, kcal? } where kcal is a
 * suggested daily change.
 */
export function weightFeedback(profile, weights, today) {
  if (weights.length === 0) return { tone: "info", title: "Start with a weigh-in", text: "Weigh yourself a few mornings a week, before breakfast. After two weeks the trend shows how the plan is working." };
  const change = weeklyChange(weights, today);
  if (change === null) return { tone: "info", title: "Keep weighing in", text: "Daily weight bounces around with water and salt. A couple more weeks of weigh-ins and the trend line will tell the real story." };
  const want = profile.goal === "lose" ? -profile.rate : profile.goal === "gain" ? profile.rate : 0;
  const diff = change - want;
  const kcal = Math.round(((-diff * KCAL_PER_LB) / 7) / 50) * 50;
  const pace = `${change > 0 ? "+" : ""}${change.toFixed(1)} lb a week`;
  const latest = weightTrend(weights).at(-1).trend;

  if (profile.goal === "lose" && change < -Math.max(2, latest * 0.01)) {
    return { tone: "nudge", title: `Losing fast (${pace})`, text: "That's quicker than is easy to keep up and can cost muscle. Eat a bit more, especially protein on training days.", kcal };
  }
  if (Math.abs(diff) <= 0.25) {
    const text = profile.goal === "maintain" ? "Your weight is steady. The plan's calories match what you burn." : `Right on the pace you picked. Keep the plan as it is.`;
    return { tone: "good", title: `On track (${pace})`, text };
  }
  const direction = kcal > 0 ? `about ${Math.abs(kcal)} more calories a day` : `about ${Math.abs(kcal)} fewer calories a day`;
  const label = profile.goal === "maintain" ? (change > 0 ? "Creeping up" : "Drifting down") : diff * (want || 1) > 0 ? "Ahead of pace" : "Behind pace";
  return {
    tone: "nudge",
    title: `${label} (${pace})`,
    text: `To get to ${want === 0 ? "steady" : `${Math.abs(want)} lb a week`}, try ${direction}. The planner can adjust portions for you.`,
    kcal,
  };
}

/** Days until the trend reaches the goal weight at the current pace, if it's heading there. */
export function daysToGoal(profile, weights, today) {
  if (!profile.goalLbs || profile.goal === "maintain") return null;
  const change = weeklyChange(weights, today);
  const latest = weightTrend(weights).at(-1)?.trend;
  if (!change || !latest) return null;
  const left = profile.goalLbs - latest;
  if (Math.sign(left) !== Math.sign(change) || Math.abs(left) < 0.5) return null;
  return Math.round((left / change) * 7);
}
