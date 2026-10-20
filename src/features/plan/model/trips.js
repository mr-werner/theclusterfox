// Trip planning from one-way fares: the cheapest way there and back for
// each day, and the best departure and return pairs for a trip.

import { addDays, dayRange } from "./dates.js";

export const AIRLINES = {
  AA: "American",
  AC: "Air Canada",
  AF: "Air France",
  AM: "Aeroméxico",
  AS: "Alaska",
  B6: "JetBlue",
  BA: "British Airways",
  DL: "Delta",
  EI: "Aer Lingus",
  F8: "Flair",
  F9: "Frontier",
  G4: "Allegiant",
  HA: "Hawaiian",
  IB: "Iberia",
  KL: "KLM",
  LH: "Lufthansa",
  MX: "Breeze",
  NK: "Spirit",
  SY: "Sun Country",
  TP: "TAP Air Portugal",
  UA: "United",
  VS: "Virgin Atlantic",
  WN: "Southwest",
  WS: "WestJet",
  Y4: "Volaris",
};
export const airlineName = code => AIRLINES[code] ?? code;

export const FLEX = [
  { id: 3, name: "± 3 days" },
  { id: 7, name: "± 1 week" },
  { id: 30, name: "Any time this month" },
];
export const TOPS = [3, 5, 10];

/** A watched trip with every option filled in. */
export function tripDefaults(trip = {}) {
  const minNights = Math.min(21, Math.max(1, Math.round(Number(trip.minNights) || 3)));
  return {
    code: trip.code,
    name: trip.name,
    around: trip.around ?? null,
    flex: FLEX.some(f => f.id === trip.flex) ? trip.flex : 7,
    minNights,
    maxNights: Math.min(28, Math.max(minNights, Math.round(Number(trip.maxNights) || minNights + 2))),
    nonstop: trip.nonstop === true,
    airlines: Array.isArray(trip.airlines) ? trip.airlines.filter(a => /^[A-Z0-9]{2}$/.test(a)).slice(0, 8) : [],
    top: TOPS.includes(trip.top) ? trip.top : 3,
  };
}

/**
 * Days a trip can leave: around a date (± flex days), or the dates on
 * screen when no date is set. Never before today.
 */
export function departWindow(trip, { from, to, today }) {
  let start = from;
  let end = to;
  if (trip.around && trip.flex >= 30) {
    start = `${trip.around.slice(0, 7)}-01`;
    end = addDays(`${addDays(start, 32).slice(0, 7)}-01`, -1);
  } else if (trip.around) {
    start = addDays(trip.around, -trip.flex);
    end = addDays(trip.around, trip.flex);
  }
  if (today && start < today) start = today;
  return start <= end ? [start, end] : null;
}

/** Months to fetch fares for: departures, plus the return leg. */
export function tripMonths(trip, window) {
  if (!window) return [];
  return [...new Set(dayRange(window[0], addDays(window[1], trip.maxNights)).map(d => d.slice(0, 7)))].slice(0, 3);
}

const matches = (fare, trip) => (!trip.nonstop || fare.transfers === 0) && (!trip.airlines.length || trip.airlines.includes(fare.airline));

/** The cheapest fare per day that fits the trip's airline and nonstop picks. */
export function cheapestByDay(fares, trip) {
  const best = new Map();
  for (const f of fares) {
    if (!matches(f, trip)) continue;
    if (!best.has(f.day) || f.price < best.get(f.day).price) best.set(f.day, f);
  }
  return best;
}

/**
 * The best departure and return pairs, cheapest total first, one per
 * departure day: [{ rank, depart, back, nights, out, ret, total }].
 */
export function suggestTrips(outFares, backFares, trip, window) {
  if (!window) return [];
  const out = cheapestByDay(outFares, trip);
  const back = cheapestByDay(backFares, trip);
  const pairs = [];
  for (const [day, fare] of out) {
    if (day < window[0] || day > window[1]) continue;
    let best = null;
    for (let n = trip.minNights; n <= trip.maxNights; n++) {
      const ret = back.get(addDays(day, n));
      if (ret && (!best || ret.price < best.ret.price)) best = { ret, nights: n };
    }
    if (best) pairs.push({ depart: day, back: best.ret.day, nights: best.nights, out: fare, ret: best.ret, total: fare.price + best.ret.price });
  }
  return pairs
    .sort((a, b) => a.total - b.total || a.depart.localeCompare(b.depart))
    .slice(0, trip.top)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/** Airlines seen in the fares, most common first. */
export function airlinesIn(fares) {
  const counts = new Map();
  for (const f of fares) if (f.airline) counts.set(f.airline, (counts.get(f.airline) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

