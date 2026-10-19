// Holidays and dates worth knowing. US dates are worked out here, so they
// need no network; other countries come from Nager.Date (free, keyless).

import { dayKey } from "./dates.js";

const nth = (year, month, weekday, n) => {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
};

const last = (year, month, weekday) => {
  const end = new Date(year, month + 1, 0);
  return new Date(year, month, end.getDate() - ((end.getDay() - weekday + 7) % 7));
};

// Federal holidays on a weekend are observed on the nearest weekday.
const observed = date => {
  const day = date.getDay();
  if (day === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  if (day === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return date;
};

// Anonymous Gregorian algorithm.
export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const CLOSED = "Post offices, most banks and government offices are closed, and there's no regular mail.";

/**
 * US holidays and observances for a year.
 * Returns [{ day, name, kind: "holiday" | "observance", note }].
 */
export function usHolidays(year) {
  const thanksgiving = nth(year, 10, 4, 4);
  const federal = [
    ["New Year's Day", new Date(year, 0, 1)],
    ["Martin Luther King Jr. Day", nth(year, 0, 1, 3)],
    ["Presidents' Day", nth(year, 1, 1, 3)],
    ["Memorial Day", last(year, 4, 1)],
    ["Juneteenth", new Date(year, 5, 19)],
    ["Independence Day", new Date(year, 6, 4)],
    ["Labor Day", nth(year, 8, 1, 1)],
    ["Columbus Day / Indigenous Peoples' Day", nth(year, 9, 1, 2)],
    ["Veterans Day", new Date(year, 10, 11)],
    ["Thanksgiving", thanksgiving],
    ["Christmas Day", new Date(year, 11, 25)],
  ];

  const out = [];
  for (const [name, date] of federal) {
    const off = observed(date);
    if (off.getTime() !== date.getTime()) {
      out.push({ day: dayKey(date), name, kind: "holiday", note: `Observed ${off.toLocaleDateString("en-US", { weekday: "long" })}.` });
      out.push({ day: dayKey(off), name: `${name} (observed)`, kind: "holiday", closed: true, note: CLOSED });
    } else {
      out.push({ day: dayKey(date), name, kind: "holiday", closed: true, note: CLOSED });
    }
  }

  // Tax Day moves to the next weekday (ignoring DC's Emancipation Day).
  let tax = new Date(year, 3, 15);
  while (tax.getDay() === 0 || tax.getDay() === 6) tax = new Date(year, 3, tax.getDate() + 1);

  const easterDay = easter(year);
  const observances = [
    ["Valentine's Day", new Date(year, 1, 14), "Restaurants book up. Reserve early."],
    ["Daylight saving time starts", nth(year, 2, 0, 2), "Clocks go forward an hour at 2 AM. You lose an hour of sleep."],
    ["St. Patrick's Day", new Date(year, 2, 17), "Expect crowds and parade closures downtown in many cities."],
    ["Good Friday", new Date(year, easterDay.getMonth(), easterDay.getDate() - 2), "US stock markets are closed."],
    ["Easter", easterDay, null],
    ["Tax Day", tax, "Federal income tax returns are due, or file for an extension."],
    ["Mother's Day", nth(year, 4, 0, 2), "Brunch spots book up. Reserve early."],
    ["Father's Day", nth(year, 5, 0, 3), null],
    ["Halloween", new Date(year, 9, 31), "Trick-or-treaters out from dusk. Drive slowly through neighborhoods."],
    ["Daylight saving time ends", nth(year, 10, 0, 1), "Clocks go back an hour at 2 AM. Evenings get dark early."],
    ["Election Day", new Date(year, 10, nth(year, 10, 1, 1).getDate() + 1), year % 2 === 0 ? "Federal elections. Check your polling place." : "Local elections in many places."],
    ["Black Friday", new Date(year, 10, thanksgiving.getDate() + 1), "Heavy traffic near shopping centers."],
    ["Christmas Eve", new Date(year, 11, 24), "Many businesses close early."],
    ["New Year's Eve", new Date(year, 11, 31), "Expect road closures and crowds downtown."],
  ];
  for (const [name, date, note] of observances) out.push({ day: dayKey(date), name, kind: "observance", note });

  return out.sort((a, b) => a.day.localeCompare(b.day));
}

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "MX", name: "Mexico" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
];

export function parseNager(list) {
  return (Array.isArray(list) ? list : []).map(h => ({
    day: h.date,
    name: h.name && h.localName && h.name !== h.localName ? `${h.name} (${h.localName})` : h.name || h.localName,
    kind: h.global === false ? "observance" : "holiday",
    closed: h.global !== false && (h.types ?? []).includes("Public"),
    note: h.global === false && h.counties?.length ? `Regional: ${h.counties.map(c => c.split("-")[1] ?? c).join(", ")}.` : null,
  }));
}

export async function fetchHolidays(year, country, { signal } = {}) {
  if (country === "US") return usHolidays(year);
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, { signal });
  if (!response.ok) throw new Error("Holidays aren't available right now.");
  return parseNager(await response.json());
}
