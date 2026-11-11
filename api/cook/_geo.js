// Small shared helpers for the CookFox store endpoints.

export const isLat = v => Number.isFinite(v) && v >= -90 && v <= 90;
export const isLon = v => Number.isFinite(v) && v >= -180 && v <= 180;

// Great-circle distance in miles.
export function miles(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const clean = (v, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Only plain web links make it to the page.
export function webUrl(v) {
  const s = clean(v, 300);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
