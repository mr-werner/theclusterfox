// Training zones. Five effort zones shared by all three sports, turned
// into heart rate, running pace, cycling power or rowing split from what
// you have told PaceFox about yourself. Nothing set? The zone still comes
// with how it should feel, so every session works on day one.

import { fmtClock, fmtPace, unitMeters } from "./units.js";

export const ZONES = [
  null,
  { id: 1, short: "Z1", name: "Recovery", feel: "Very easy. You could chat all day.", talk: "full conversation" },
  { id: 2, short: "Z2", name: "Endurance", feel: "Easy and steady. You can talk in full sentences.", talk: "full sentences" },
  { id: 3, short: "Z3", name: "Tempo", feel: "Comfortably hard. Talking in short sentences.", talk: "short sentences" },
  { id: 4, short: "Z4", name: "Threshold", feel: "Hard but controlled. A few words at a time.", talk: "a few words" },
  { id: 5, short: "Z5", name: "VO2 max", feel: "Very hard. You can hold it for a few minutes at most.", talk: "no talking" },
  { id: 6, short: "Z6", name: "Sprint", feel: "All out, for seconds.", talk: "none" },
];

// Heart rate as a share of max (or of reserve when resting HR is known).
const HR_BANDS = [null, [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1], [0.95, 1]];
// Running pace as a multiple of threshold pace (slower is bigger).
const RUN_BANDS = [null, [1.3, 1.45], [1.15, 1.3], [1.06, 1.12], [0.98, 1.03], [0.9, 0.95], [0.78, 0.86]];
// Cycling power as a share of FTP.
const BIKE_BANDS = [null, [0, 0.55], [0.56, 0.75], [0.76, 0.9], [0.91, 1.05], [1.06, 1.2], [1.5, 2.5]];
// Rowing split, seconds slower than 2K split per 500 m, and stroke rate.
const ROW_BANDS = [null, [24, 30], [16, 23], [10, 15], [5, 9], [0, 3], [-6, -2]];
const ROW_RATES = [null, "18–20", "18–22", "22–24", "24–28", "30–34", "36+"];

/** Estimated max heart rate (Tanaka) when it hasn't been measured. */
export function maxHrFor(profile) {
  if (profile?.maxHr > 100 && profile.maxHr < 230) return Math.round(profile.maxHr);
  if (profile?.age >= 10 && profile.age <= 100) return Math.round(208 - 0.7 * profile.age);
  return null;
}

export function hrRange(zone, profile) {
  const max = maxHrFor(profile);
  const band = HR_BANDS[zone];
  if (!max || !band) return null;
  const rest = profile?.restHr > 30 && profile.restHr < 100 ? profile.restHr : null;
  const at = share => Math.round(rest ? rest + (max - rest) * share : max * share);
  return [at(band[0]), at(band[1])];
}

/** Riegel's race-time model: time for distance d from a known result. */
export const predictTime = (d, refDistM, refSec) => refSec * Math.pow(d / refDistM, 1.06);

/** Seconds per meter at threshold (roughly one-hour race pace), from a recent run. */
export function runThreshold(profile) {
  const r = profile?.runRace;
  if (!r?.distanceM || !r?.seconds) return null;
  const hourDist = r.distanceM * Math.pow(3600 / r.seconds, 1 / 1.06);
  return 3600 / hourDist;
}

export function runPaceRange(zone, profile, unit) {
  const t = runThreshold(profile);
  const band = RUN_BANDS[zone];
  if (!t || !band) return null;
  const per = unitMeters(unit);
  return [t * band[0] * per, t * band[1] * per]; // fast..slow is [0]<[1]
}

export function powerRange(zone, profile) {
  const ftp = profile?.ftp > 40 && profile.ftp < 700 ? profile.ftp : null;
  const band = BIKE_BANDS[zone];
  if (!ftp || !band) return null;
  return [Math.round(ftp * band[0]), Math.round(ftp * band[1])];
}

/** 2K split in seconds per 500 m. */
export const row2kSplit = profile => (profile?.row2k > 300 && profile.row2k < 900 ? profile.row2k / 4 : null);

export function splitRange(zone, profile) {
  const s = row2kSplit(profile);
  const band = ROW_BANDS[zone];
  if (!s || !band) return null;
  return [s + band[0], s + band[1]];
}

/**
 * Everything worth saying about a zone for one sport:
 * { zone, label, target, hr, rate, feel, metric, low, high }
 * metric/low/high describe the number live guidance compares against:
 * "pace" (s per unit, low is faster), "power" (watts), "split" (s/500m)
 * or "hr" (bpm).
 */
export function zoneTarget(zone, sport, profile, unit = "mi") {
  const z = ZONES[zone] ?? ZONES[2];
  const out = { zone: z.id, label: `${z.short} ${z.name}`, feel: z.feel, target: null, hr: null, rate: null, metric: null, low: null, high: null };
  const hr = hrRange(Math.min(zone, 5), profile);
  if (hr) out.hr = `${hr[0]}–${hr[1]} bpm`;
  if (sport === "run") {
    const p = runPaceRange(zone, profile, unit);
    if (p) {
      out.target = zone === 6 ? "fast and relaxed" : `${fmtClock(p[0])}–${fmtPace(p[1], unit)}`;
      if (zone < 6) Object.assign(out, { metric: "pace", low: p[0], high: p[1] });
    }
  } else if (sport === "ride") {
    const w = powerRange(zone, profile);
    if (w) {
      out.target = zone === 1 ? `under ${w[1]} W` : zone === 6 ? `${w[0]} W+` : `${w[0]}–${w[1]} W`;
      if (zone < 6) Object.assign(out, { metric: "power", low: w[0], high: w[1] });
    }
  } else if (sport === "row") {
    out.rate = `${ROW_RATES[zone]} spm`;
    const s = splitRange(zone, profile);
    if (s) {
      out.target = `${fmtClock(Math.max(60, s[0]))}–${fmtClock(s[1])} /500m`;
      if (zone < 6) Object.assign(out, { metric: "split", low: s[0], high: s[1] });
    }
  }
  if (!out.metric && hr && zone < 6) Object.assign(out, { metric: "hr", low: hr[0], high: hr[1] });
  return out;
}

/**
 * Is the live number in the zone? Returns "fast" | "slow" | "ok" | null.
 * For pace and split a lower number is faster; for power and HR higher is harder.
 * A little slack on each side keeps it from nagging.
 */
export function judge(metric, low, high, value) {
  if (!Number.isFinite(value) || !metric) return null;
  if (metric === "pace" || metric === "split") {
    const slack = metric === "pace" ? 5 : 1.5;
    if (value < low - slack) return "fast";
    if (value > high + slack) return "slow";
    return "ok";
  }
  const slack = metric === "power" ? 0.04 * high : 3;
  if (value > high + slack) return "fast";
  if (value < low - slack) return "slow";
  return "ok";
}

/** Race time predictions from a recent run, for a few common distances. */
export function runPredictions(profile) {
  const r = profile?.runRace;
  if (!r?.distanceM || !r?.seconds) return [];
  return [
    ["Mile", 1609.344],
    ["5K", 5000],
    ["10K", 10000],
    ["Half", 21097.5],
    ["Marathon", 42195],
  ].map(([name, d]) => ({ name, seconds: predictTime(d, r.distanceM, r.seconds) }));
}
