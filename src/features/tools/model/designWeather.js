// Design weather from hourly history, the same way ASHRAE builds its design
// conditions: percentiles of all the hours in the record.
//  - Heating 99.6% / 99%: the dry bulb that is colder only 0.4% / 1% of hours.
//  - Cooling 0.4% / 1%: the dry bulb that is hotter only 0.4% / 1% of hours,
//    with the mean coincident wet bulb (MCWB) of the hours near that dry bulb.
//  - Mean daily range: average of (daily high − daily low) in the hottest month.
// Everything is SI: K, m, Pa.

import { psychrometrics, satPressure, standardAtmosphere } from "./air.js";

/** Value below which a fraction p of the sorted list falls (linear between samples). */
export function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const x = p * (sorted.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}

/** Wet bulb (K) from dry bulb and dew point (K) at pressure p. */
export function wetBulbFromDew(T, Td, p) {
  const rh = Math.min(1, satPressure(Math.min(Td, T)) / satPressure(T));
  return psychrometrics(T, rh, p).wet;
}

/**
 * hours: { t: unix seconds (UTC), T: °C[], Td: °C[] }, offset: UTC offset in seconds, z: elevation m.
 * Returns design conditions in K, or null when the record is too short.
 */
export function designConditions({ t, T, Td }, { offset = 0, z = 0 } = {}) {
  const p = standardAtmosphere(z).p;
  const rows = [];
  for (let k = 0; k < t.length; k++) {
    if (T[k] == null || !Number.isFinite(T[k])) continue;
    rows.push({ t: t[k] + offset, T: T[k] + 273.15, Td: Td?.[k] == null ? NaN : Td[k] + 273.15 });
  }
  if (rows.length < 24 * 300) return null;
  const sorted = rows.map((r) => r.T).sort((a, b) => a - b);
  const heat996 = percentile(sorted, 0.004);
  const heat99 = percentile(sorted, 0.01);
  const cool04 = percentile(sorted, 0.996);
  const cool1 = percentile(sorted, 0.99);

  // Mean coincident wet bulb: hours within ±0.5 K of the design dry bulb (widen if the band is thin).
  const mcwb = (Tdes) => {
    for (const band of [0.5, 1, 2]) {
      const near = rows.filter((r) => Math.abs(r.T - Tdes) <= band && Number.isFinite(r.Td));
      if (near.length >= 20) return near.reduce((a, r) => a + wetBulbFromDew(r.T, r.Td, p), 0) / near.length;
    }
    return NaN;
  };

  // Hottest month by mean temperature; then the mean daily range in that month.
  const monthSum = Array(12).fill(0), monthN = Array(12).fill(0);
  const days = new Map();
  for (const r of rows) {
    const d = new Date(r.t * 1000);
    const m = d.getUTCMonth();
    monthSum[m] += r.T;
    monthN[m]++;
    const key = Math.floor(r.t / 86400);
    const day = days.get(key) || { m, lo: Infinity, hi: -Infinity, n: 0 };
    day.lo = Math.min(day.lo, r.T);
    day.hi = Math.max(day.hi, r.T);
    day.n++;
    days.set(key, day);
  }
  const monthMean = monthSum.map((s, m) => (monthN[m] ? s / monthN[m] : -Infinity));
  const hottest = monthMean.indexOf(Math.max(...monthMean));
  const coldest = monthMean.indexOf(Math.min(...monthMean.map((x) => (x === -Infinity ? Infinity : x))));
  const full = [...days.values()].filter((d) => d.m === hottest && d.n >= 20);
  const DR = full.length ? full.reduce((a, d) => a + (d.hi - d.lo), 0) / full.length : NaN;
  const years = rows.length / (24 * 365.25);

  return {
    heat996, heat99, cool04, cool1,
    mcwb04: mcwb(cool04), mcwb1: mcwb(cool1),
    DR, month: hottest + 1, coldMonth: coldest + 1, years,
  };
}

// The chosen place and its design conditions travel in the page link as one short string.
const KEYS = ["name", "lat", "lon", "z", "heat996", "heat99", "cool04", "mcwb04", "cool1", "mcwb1", "DR", "month", "years", "hp", "cp"];
const round = (x) => (typeof x === "number" ? String(Number(x.toFixed(3))) : String(x ?? ""));

export function encodeLocation(loc) {
  if (!loc) return "";
  return KEYS.map((k) => round(loc[k]).replaceAll("~", "-")).join("~");
}

export function decodeLocation(text) {
  if (!text) return null;
  const parts = String(text).split("~");
  if (parts.length < 13) return null;
  const loc = {};
  KEYS.forEach((k, i) => {
    const v = parts[i] ?? "";
    loc[k] = k === "name" || k === "hp" || k === "cp" ? v : Number(v);
  });
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.heat996)) return null;
  loc.hp ||= "99.6";
  loc.cp ||= "0.4";
  return loc;
}

/** The design inputs a location sets, using the chosen heating and cooling percentiles. */
export function designInputs(loc) {
  const Twin = loc.hp === "99" ? loc.heat99 : loc.heat996;
  const Tdb = loc.cp === "1" ? loc.cool1 : loc.cool04;
  const Twb = loc.cp === "1" ? loc.mcwb1 : loc.mcwb04;
  const out = { lat: Math.max(-66, Math.min(66, loc.lat)), z: Math.max(-400, Math.min(6000, loc.z)), Twin, Tdb };
  if (Number.isFinite(Twb)) out.Twb = Math.min(Twb, Tdb);
  if (Number.isFinite(loc.DR)) out.DR = loc.DR;
  if (loc.month >= 1 && loc.month <= 12) out.month = String(loc.month);
  return out;
}
