// Shopping trips and the monthly budget: what you spent, where, and how the
// month is going. Days are "YYYY-MM-DD" in the shopper's own time zone.

const cents = n => Math.round(n * 100) / 100;

export function localDay(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export const monthOf = day => day.slice(0, 7);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = month => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const shortMonth = month => MONTHS[Number(month.slice(5, 7)) - 1];

// The `count` months ending with `month`, oldest first.
export function lastMonths(month, count) {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(5, 7));
  const out = [];
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function spendingSummary(trips, today, budget, months = 6) {
  const month = monthOf(today);
  const span = lastMonths(month, months);
  const byMonth = Object.fromEntries(span.map(m => [m, 0]));
  const stores = new Map();
  for (const t of trips) {
    const m = monthOf(t.date);
    if (m in byMonth) byMonth[m] = cents(byMonth[m] + t.total);
    if (m === month) {
      const s = stores.get(t.storeName) ?? { name: t.storeName, total: 0, trips: 0 };
      s.total = cents(s.total + t.total);
      s.trips += 1;
      stores.set(t.storeName, s);
    }
  }
  const thisMonth = byMonth[month];
  const tripsThisMonth = trips.filter(t => monthOf(t.date) === month);
  // Where the month is heading at this pace, once a few days have passed.
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const pace = dayOfMonth >= 5 && thisMonth > 0 ? cents((thisMonth / dayOfMonth) * daysInMonth) : null;
  const earlier = span.slice(0, -1).map(m => byMonth[m]).filter(v => v > 0);
  return {
    month,
    thisMonth,
    trips: tripsThisMonth.length,
    perTrip: tripsThisMonth.length ? cents(thisMonth / tripsThisMonth.length) : null,
    left: budget ? cents(budget - thisMonth) : null,
    pace,
    overPace: Boolean(budget && pace && pace > budget),
    average: earlier.length ? cents(earlier.reduce((a, b) => a + b, 0) / earlier.length) : null,
    months: span.map(m => ({ month: m, total: byMonth[m] })),
    stores: [...stores.values()].sort((a, b) => b.total - a.total),
  };
}
