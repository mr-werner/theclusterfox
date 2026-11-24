// Dates for TripFox. Days are "YYYY-MM-DD" in local time.

const ms = day => Date.parse(`${day}T12:00:00Z`);

export function addDays(day, n) {
  const d = new Date(ms(day) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Every day from start to end, both included (at most 45). */
export function tripDays(trip) {
  if (!trip?.start) return [];
  const end = trip.end ?? trip.start;
  const out = [];
  for (let d = trip.start; d <= end && out.length < 45; d = addDays(d, 1)) out.push(d);
  return out;
}

export const nightsOf = trip => (trip?.start && trip?.end ? Math.max(0, daysBetween(trip.start, trip.end)) : 0);

export function shortDay(day) {
  return new Date(ms(day)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function dateSpan(trip) {
  if (!trip?.start) return "Dates not set";
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  const a = new Date(ms(trip.start)).toLocaleDateString("en-US", opts);
  if (!trip.end || trip.end === trip.start) return a;
  const b = new Date(ms(trip.end)).toLocaleDateString("en-US", trip.start.slice(0, 7) === trip.end.slice(0, 7) ? { day: "numeric", timeZone: "UTC" } : opts);
  return `${a} – ${b}`;
}

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
