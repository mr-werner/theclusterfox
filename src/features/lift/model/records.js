// Numbers from logged sets: estimated one-rep max, personal records and
// weekly volume. Sets are { w: weight, r: reps } in the unit the lifter used.

const LB_PER_KG = 2.20462;

/** Weight converted to the unit asked for. */
export function convert(w, from, to) {
  if (from === to) return w;
  return from === "kg" ? w * LB_PER_KG : w / LB_PER_KG;
}

/**
 * Epley estimate of a one-rep max. Only trusted up to 12 reps; past that the
 * formula drifts, so those sets don't count as records.
 */
export function e1rm(w, r) {
  if (!(w > 0) || !(r >= 1) || r > 12) return null;
  return r === 1 ? w : w * (1 + r / 30);
}

const round = (n, step = 0.5) => Math.round(n / step) * step;
export const fmtWeight = (w, unit) => `${round(w, unit === "kg" ? 0.5 : 1)} ${unit}`;

/** First number in a reps target like "8-12" or "10". */
export function targetReps(item) {
  const n = parseInt(String(item.reps ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** A number from free text like "135 lb" or "22.5". */
export function parseLoad(text) {
  const n = parseFloat(String(text ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Best estimated 1RM per exercise over the history, in `unit`. */
export function bestByExercise(history, unit) {
  const best = {};
  for (const h of history) {
    for (const [id, sets] of Object.entries(h.sets ?? {})) {
      for (const s of sets) {
        const est = e1rm(convert(s.w, h.unit ?? unit, unit), s.r);
        if (est && (!best[id] || est > best[id].e1rm)) best[id] = { e1rm: est, w: convert(s.w, h.unit ?? unit, unit), r: s.r, date: h.date };
      }
    }
  }
  return best;
}

/** The most recent logged sets for an exercise, newest workout first. */
export function lastSets(history, exerciseId) {
  const h = history.find(x => x.sets?.[exerciseId]?.length);
  return h ? { date: h.date, unit: h.unit ?? "lb", sets: h.sets[exerciseId] } : null;
}

function mondayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Weight × reps per week for the last `weeks` weeks, oldest first, in `unit`. */
export function weeklyVolume(history, unit, today, weeks = 8) {
  const start = mondayOf(today);
  const keys = [];
  const [y, m, d] = start.split("-").map(Number);
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date(y, m - 1, d - i * 7);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
  }
  const totals = Object.fromEntries(keys.map(k => [k, 0]));
  for (const h of history) {
    const k = mondayOf(h.date.slice(0, 10));
    if (!(k in totals)) continue;
    for (const sets of Object.values(h.sets ?? {})) {
      for (const s of sets) if (s.w > 0 && s.r > 0) totals[k] += convert(s.w, h.unit ?? unit, unit) * s.r;
    }
  }
  return keys.map(week => ({ week, volume: Math.round(totals[week]) }));
}
