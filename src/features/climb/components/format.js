// Formatting and small helpers shared by ClimbFox screens.

export const TYPE_NAMES = {
  sport: "Sport",
  trad: "Trad",
  tr: "Top rope",
  bouldering: "Boulder",
  alpine: "Alpine",
  ice: "Ice",
  mixed: "Mixed",
  aid: "Aid",
  deepwatersolo: "Deep water solo",
  snow: "Snow",
};

export const SAFETY_TEXT = {
  PG: "PG: some runouts, mostly safe",
  PG13: "PG-13: runout in places; a fall could hurt",
  R: "R: serious runouts; a fall could injure you badly",
  X: "X: a fall could be fatal",
  runout: "Runout",
  terrain: "Watch for ledges and terrain below",
};

export const fmtTemp = (c, units) => (Number.isFinite(c) ? (units === "metric" ? `${Math.round(c)}°C` : `${Math.round((c * 9) / 5 + 32)}°F`) : "–");
export const fmtLen = (m, units) => (Number.isFinite(m) ? (units === "metric" ? `${Math.round(m)} m` : `${Math.round(m * 3.28084)} ft`) : null);
export const fmtWind = (ms, units) => (units === "metric" ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * 2.237)} mph`);
export const fmtHour = h => `${h % 12 === 0 ? 12 : h % 12}${h < 12 || h === 24 ? "a" : "p"}`;

export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function dayName(day, today = localDay()) {
  if (day === today) return "Today";
  const d = new Date(`${day}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((d - t) / 864e5);
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
export const shortDay = day => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

export const directionsHref = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`;
export const osmHref = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=15/${lat.toFixed(5)}/${lng.toFixed(5)}`;
