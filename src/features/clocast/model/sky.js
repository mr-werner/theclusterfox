// Which sky to paint behind CloCast, from a WMO weather code and whether
// the sun is up. Kept to a handful of looks so each one stays readable.
export const SKIES = ["clear-day", "clear-night", "partly-day", "partly-night", "cloudy", "fog", "rain", "snow", "storm"];

export function skyFor(code, isDay = true) {
  if (!Number.isFinite(code)) return isDay ? "partly-day" : "partly-night";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 51) return "rain";
  if (code >= 45) return "fog";
  if (code === 3) return "cloudy";
  if (code >= 1) return isDay ? "partly-day" : "partly-night";
  return isDay ? "clear-day" : "clear-night";
}
