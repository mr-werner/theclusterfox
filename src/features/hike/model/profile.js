// How hard and how long a hike is: climb and descent from an elevation
// profile, a walking time from Tobler's hiking function, and a difficulty
// rating. Profiles are [[distanceM, elevationM], ...] for one way along the
// trail; the trip shape ("loop", "out-back", "one-way") says how it's walked.

export const SHAPES = {
  loop: "Loop",
  "out-back": "Out and back",
  "one-way": "One way (shuttle)",
};

/** The profile actually walked: an out-and-back goes there and back again. */
export function tripProfile(profile, shape) {
  if (shape !== "out-back" || profile.length < 2) return profile;
  const total = profile[profile.length - 1][0];
  const back = profile
    .slice(0, -1)
    .reverse()
    .map(([d, e]) => [2 * total - d, e]);
  return profile.concat(back);
}

/**
 * Climb and descent in metres. Small wiggles below `threshold` are ignored,
 * since elevation models are noisy and they'd add up to climb that isn't there.
 */
export function climb(profile, threshold = 4) {
  let gain = 0;
  let loss = 0;
  if (!profile.length) return { gain, loss, min: null, max: null };
  let ref = profile[0][1];
  let min = ref;
  let max = ref;
  for (const [, e] of profile) {
    if (!Number.isFinite(e)) continue;
    min = Math.min(min, e);
    max = Math.max(max, e);
    if (e - ref >= threshold) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= threshold) {
      loss += ref - e;
      ref = e;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss), min: Math.round(min), max: Math.round(max) };
}

/** Tobler's hiking function: walking speed in km/h on a slope (rise/run). */
export const toblerKmh = slope => 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));

export const PACES = [
  { id: 0.8, name: "Relaxed" },
  { id: 1, name: "Average" },
  { id: 1.2, name: "Brisk" },
  { id: 1.45, name: "Fast" },
];

/**
 * Minutes to walk a profile at a pace factor (1 is an average hiker),
 * plus about five minutes of rest an hour.
 */
export function walkMinutes(profile, pace = 1) {
  let hours = 0;
  for (let i = 1; i < profile.length; i++) {
    const run = profile[i][0] - profile[i - 1][0];
    if (run <= 0) continue;
    const rise = (profile[i][1] ?? 0) - (profile[i - 1][1] ?? 0);
    // Very steep pitches are walked no slower than a scramble.
    const kmh = Math.max(0.6, toblerKmh(Math.max(-0.6, Math.min(0.6, rise / run))) * pace);
    hours += run / 1000 / kmh;
  }
  return Math.round(hours * 60 * (1 + 5 / 60));
}

/**
 * A difficulty rating from distance and climb (the Shenandoah National
 * Park formula: √(2 × gain ft × miles)), nudged up by OSM's sac_scale.
 */
export function difficulty(distanceM, gainM, sac) {
  const miles = distanceM / 1609.344;
  const feet = gainM * 3.28084;
  const score = Math.sqrt(2 * feet * miles);
  const levels = [
    { max: 50, id: "easy", name: "Easy" },
    { max: 100, id: "moderate", name: "Moderate" },
    { max: 150, id: "hard", name: "Moderately strenuous" },
    { max: 200, id: "strenuous", name: "Strenuous" },
    { max: Infinity, id: "very", name: "Very strenuous" },
  ];
  let i = levels.findIndex(l => score < l.max);
  const sacStep = { mountain_hiking: 1, demanding_mountain_hiking: 2, alpine_hiking: 3, demanding_alpine_hiking: 3, difficult_alpine_hiking: 4 }[sac] ?? 0;
  i = Math.min(levels.length - 1, Math.max(i, sacStep));
  return { ...levels[i], score: Math.round(score) };
}

export const SAC_TEXT = {
  hiking: "Well-made trail",
  mountain_hiking: "Mountain trail: uneven footing, some steep bits",
  demanding_mountain_hiking: "Demanding mountain trail: may need hands for balance",
  alpine_hiking: "Alpine route: exposed, sometimes no trail, easy scrambling",
  demanding_alpine_hiking: "Demanding alpine: scrambling and exposure",
  difficult_alpine_hiking: "Difficult alpine: climbing skills needed",
};

/** Everything the trail page shows about the effort, in one go. */
export function summarize(profile, shape, pace = 1, sac) {
  const trip = tripProfile(profile, shape);
  const distanceM = trip.length ? trip[trip.length - 1][0] : 0;
  const c = climb(trip);
  return { distanceM, ...c, minutes: walkMinutes(trip, pace), difficulty: difficulty(distanceM, c.gain, sac), trip };
}

/** Elevation at a distance along a profile, interpolated. */
export function elevationAt(profile, d) {
  if (!profile.length) return null;
  if (d <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    if (profile[i][0] >= d) {
      const [d0, e0] = profile[i - 1];
      const [d1, e1] = profile[i];
      return e0 + ((e1 - e0) * (d - d0)) / (d1 - d0 || 1);
    }
  }
  return profile[profile.length - 1][1];
}

/** Minutes left from a distance along the trip profile to its end. */
export function minutesLeft(trip, along, pace = 1) {
  const rest = trip.filter(([d]) => d > along);
  if (!rest.length) return 0;
  return walkMinutes([[along, elevationAt(trip, along)], ...rest], pace);
}
