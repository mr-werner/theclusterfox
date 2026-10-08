// Standard Compendium approximation: 1 MET = 3.5 mL O2/kg/min.
// Net subtracts the 1-MET resting baseline; total includes it.
export function caloriesPerMinute(met, weightLbs, mode = "net") {
  const m = Number(met);
  const lbs = Number(weightLbs);
  if (!Number.isFinite(m) || !Number.isFinite(lbs) || m <= 0 || lbs <= 0) return 0;
  const effectiveMet = mode === "total" ? m : Math.max(0, m - 1);
  return (effectiveMet * 3.5 * (lbs / 2.2046226218)) / 200;
}

export function minutesToBurnCalories(calories, met, weightLbs, mode = "net") {
  const target = Number(calories);
  if (!Number.isFinite(target) || target <= 0) return 0;
  const rate = caloriesPerMinute(met, weightLbs, mode);
  return rate > 0 ? target / rate : Infinity;
}

export function calculateDistance(minutes, speedMph) {
  const time = Number(minutes);
  const speed = Number(speedMph);
  return Number.isFinite(time) && time >= 0 && Number.isFinite(speed) && speed > 0
    ? (time / 60) * speed
    : null;
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "Not achievable above rest";
  if (minutes <= 0) return "0 min";
  const rounded = Math.ceil(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
