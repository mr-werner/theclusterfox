export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

// delta: format a difference in temperature rather than a reading.
export function formatTemp(celsius, units, { unit = true, delta = false } = {}) {
  if (!Number.isFinite(celsius)) return "–";
  const value = units === "metric" ? celsius : (celsius * 9) / 5 + (delta ? 0 : 32);
  return `${Math.round(value)}°${unit ? (units === "metric" ? "C" : "F") : ""}`;
}

export function formatWind(metersPerSecond, units) {
  if (!Number.isFinite(metersPerSecond)) return "–";
  return units === "metric"
    ? `${Math.round(metersPerSecond * 3.6)} km/h`
    : `${Math.round(metersPerSecond * 2.23694)} mph`;
}

export function formatHour(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}
