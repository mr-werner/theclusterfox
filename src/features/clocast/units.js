export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export function formatTemp(celsius, units, { unit = true } = {}) {
  if (!Number.isFinite(celsius)) return "–";
  const value = units === "metric" ? celsius : (celsius * 9) / 5 + 32;
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
