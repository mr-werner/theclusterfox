// Straight-line distance, in miles.
export function milesBetween(a, b) {
  if (!a || !b) return null;
  const r = 3958.8;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export const fmtMiles = mi => (mi == null ? "" : mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi).toLocaleString("en-US")} mi`);

export const fmtMoney = n => (n == null ? "–" : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);

/** A temperature given in °F, shown in the person's units. */
export const fmtTemp = (f, units) => (f == null ? "–" : units === "metric" ? `${Math.round(((f - 32) * 5) / 9)}°` : `${Math.round(f)}°`);
