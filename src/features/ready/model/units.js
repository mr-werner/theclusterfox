// Dates, times and scores, written the way the tests write them.

export const toIsoDay = d => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const parseDay = iso => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (iso, n) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return toIsoDay(d);
};

export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);

export const weekday = iso => parseDay(iso).getDay();

/** "12:30" for 750 seconds; "1:05:00" past an hour. */
export function fmtTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return "–";
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Reads "12:30", "12.30", "750s" or "12" (minutes) into seconds. Null if it isn't a time. */
export function parseTime(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{1,2}):(\d{2})$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = s.match(/^(\d{1,3})[:.](\d{1,2})$/);
  if (m && +m[2] < 60) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d{1,4})\s*s(ec)?$/i);
  if (m) return +m[1];
  m = s.match(/^\d{1,3}$/);
  if (m) return +s * 60;
  return null;
}

/** Seconds for a hold, where a bare number means seconds ("45" = 0:45). */
export function parseHold(text) {
  const s = String(text ?? "").trim();
  if (/^\d{1,4}$/.test(s)) return +s;
  return parseTime(s);
}

export const fmtDay = (iso, opts = { weekday: "short", month: "short", day: "numeric" }) =>
  parseDay(iso).toLocaleDateString(undefined, opts);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
