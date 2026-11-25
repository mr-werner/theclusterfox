// What a trip costs: getting there, where you sleep, food, things to do.
// Every number is an estimate the person can override, and says so.

import { STAY_KINDS, VEHICLES } from "../state/tripStore.js";
import { nightsOf, tripDays } from "./days.js";
import { milesBetween } from "./geo.js";

export const LODGING_FEES = 0.13; // taxes and resort or cleaning fees, roughly
export const KID_FOOD = 0.6; // a kid eats about this share of an adult's food budget
const EV_KWH_PER_MILE = 0.32;
const EV_PRICE_KWH = 0.45; // fast charging on a trip
export const DEFAULT_GAS = 3.25;

export const people = trip => trip.adults + trip.kids;
export const paidStay = trip => trip.stayKind !== "free" && trip.nightly > 0;
const round = n => Math.round(n);

/**
 * Getting there and back for the whole party:
 * { amount, basis: "fare" | "route" | "estimate" | "yours", note }.
 *   home: where you leave from; route: { miles, minutes } one way, if known;
 *   fare: cheapest round trip per seat from recent fares, if known.
 */
export function travelCost(trip, { home, route, fare, gasPrice } = {}) {
  if (trip.travelCost != null) return { amount: trip.travelCost, basis: "yours", note: "The amount you entered" };
  const seats = people(trip);
  const crow = milesBetween(home, trip.dest);
  if (trip.travel === "drive") {
    const miles = route?.miles ?? (crow != null ? crow * 1.25 : null);
    if (miles == null) return { amount: null, basis: "estimate", note: "Set where you're leaving from" };
    const v = VEHICLES.find(x => x.id === trip.vehicle) ?? VEHICLES[1];
    const both = Math.round(miles * 2).toLocaleString("en-US");
    if (!v.mpg) return { amount: round(miles * 2 * EV_KWH_PER_MILE * EV_PRICE_KWH), basis: route ? "route" : "estimate", note: `${both} miles there and back, fast charging at about $${EV_PRICE_KWH.toFixed(2)} a kWh` };
    const gas = gasPrice ?? DEFAULT_GAS;
    return { amount: round(((miles * 2) / v.mpg) * gas), basis: route ? "route" : "estimate", note: `${both} miles there and back at ${v.mpg} mpg and $${gas.toFixed(2)} a gallon` };
  }
  if (trip.travel === "fly") {
    if (fare != null) return { amount: round(fare * seats), basis: "fare", note: `${seats} seat${seats > 1 ? "s" : ""} at about $${Math.round(fare)} round trip, from fares travelers found recently. Bags cost extra on most airlines.` };
    if (crow == null) return { amount: null, basis: "estimate", note: "Set where you're leaving from" };
    const perSeat = 2 * (90 + crow * 0.11);
    return { amount: round(perSeat * seats), basis: "estimate", note: `A rough guess of $${Math.round(perSeat)} a seat for ${Math.round(crow).toLocaleString("en-US")} miles. Pick both airports for real fares.` };
  }
  if (crow == null) return { amount: null, basis: "estimate", note: "Set where you're leaving from" };
  const rate = trip.travel === "train" ? 0.22 : 0.12;
  const perSeat = 2 * Math.max(25, crow * 1.2 * rate);
  return { amount: round(perSeat * seats), basis: "estimate", note: `A rough guess of $${Math.round(perSeat)} a seat round trip. Check the real fare and type it in.` };
}

/** The full budget: { lines: [{ id, name, amount, note }], total, perPerson, perDay, left, nights, days }. */
export function budgetFor(trip, context = {}) {
  const nights = nightsOf(trip);
  const days = Math.max(1, tripDays(trip).length);
  const travel = travelCost(trip, context);
  const lodging = paidStay(trip) ? round(trip.nightly * nights * trip.rooms * (1 + LODGING_FEES)) : 0;
  const eaters = trip.adults + trip.kids * KID_FOOD;
  const food = round(trip.food * eaters * days);
  const planned = trip.plan.reduce((sum, i) => sum + (i.cost ?? 0) * (i.perPerson ? people(trip) : 1), 0);
  const fun = round(trip.fun * people(trip) * days + planned);
  const stayName = STAY_KINDS.find(k => k.id === trip.stayKind)?.name ?? "Stay";
  const lines = [
    { id: "travel", name: "Getting there and back", amount: travel.amount, note: travel.note, basis: travel.basis },
    {
      id: "stay",
      name: "Places to stay",
      amount: lodging,
      note: paidStay(trip)
        ? `${stayName}: ${nights} night${nights === 1 ? "" : "s"} × ${trip.rooms} room${trip.rooms > 1 ? "s" : ""} × $${trip.nightly}, plus about ${Math.round(LODGING_FEES * 100)}% taxes and fees`
        : `${stayName}: nothing to pay`,
    },
    { id: "food", name: "Food", amount: food, note: `$${trip.food} a day for each adult${trip.kids ? `, about ${Math.round(KID_FOOD * 100)}% of that for each kid` : ""}, ${days} day${days > 1 ? "s" : ""}` },
    { id: "fun", name: "Things to do", amount: fun, note: `$${trip.fun} a day each${planned ? `, plus $${Math.round(planned)} for tickets you added` : ""}` },
  ];
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  return { lines, total, perPerson: round(total / people(trip)), perDay: round(total / days), left: trip.budget ? trip.budget - total : null, nights, days };
}

/**
 * The most a night can cost and still fit the budget, or null with no
 * budget or no nights. Can be negative (the rest already doesn't fit).
 */
export function maxNightly(trip, context = {}) {
  const nights = nightsOf(trip);
  if (!trip.budget || !nights) return null;
  const rest = budgetFor({ ...trip, stayKind: "free", nightly: 0 }, context).total;
  return Math.floor((trip.budget - rest) / (nights * trip.rooms * (1 + LODGING_FEES)));
}

/** Kinds of places to stay that fit a nightly amount, priciest that fits first. */
export function staysForNightly(nightly) {
  if (nightly == null) return STAY_KINDS.filter(k => k.id !== "free");
  if (nightly < 25) return STAY_KINDS.filter(k => k.id === "free" || k.id === "camp");
  return STAY_KINDS.filter(k => k.id !== "free" && k.nightly <= nightly * 1.15).sort((a, b) => b.nightly - a.nightly);
}
