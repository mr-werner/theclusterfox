// Totals and streaks from the session history.

export function toIsoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(isoDay, n) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return toIsoDay(new Date(y, m - 1, d + n));
}

/** Consecutive days with at least one session, counting back from today (or yesterday, if today is still open). */
export function currentStreak(history, today) {
  const days = new Set(history.map(h => h.date));
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(history) {
  const days = [...new Set(history.map(h => h.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** Minutes for each of the last `count` days, oldest first. */
export function lastDays(history, today, count = 7) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const minutes = history.filter(h => h.date === date).reduce((sum, h) => sum + h.minutes, 0);
    out.push({ date, minutes });
  }
  return out;
}

export function summarize(history, today) {
  return {
    minutes: Math.round(history.reduce((sum, h) => sum + h.minutes, 0)),
    sessions: history.length,
    streak: currentStreak(history, today),
    best: longestStreak(history),
  };
}

/** "12:05" or "1:02:05" */
export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
