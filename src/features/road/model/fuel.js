// Fuel and charging for RoadFox: where you'll need to stop, which station
// to pick near each spot, and what the gas will cost. Plain functions.

import { priceForState } from "../data/states.js";
import { cumulative, sampleEvery, stateAt } from "./geo.js";

export const VEHICLE_PRESETS = [
  { id: "sedan", name: "Sedan", kind: "gas", mpg: 32, tankGal: 13 },
  { id: "suv", name: "SUV / crossover", kind: "gas", mpg: 25, tankGal: 16 },
  { id: "truck", name: "Pickup", kind: "gas", mpg: 19, tankGal: 24 },
  { id: "minivan", name: "Minivan", kind: "gas", mpg: 22, tankGal: 19 },
  { id: "rv", name: "RV / towing", kind: "gas", mpg: 9, tankGal: 50 },
  { id: "diesel", name: "Diesel truck", kind: "diesel", mpg: 20, tankGal: 30 },
  { id: "hybrid", name: "Hybrid", kind: "gas", mpg: 50, tankGal: 11 },
  { id: "ev", name: "Electric (EV)", kind: "ev", rangeMi: 280, plug: "ccs" },
];

export const PLUGS = [
  { id: "ccs", name: "CCS", nrel: "J1772COMBO", osm: "socket:type2_combo|socket:ccs|socket:type1_combo" },
  { id: "nacs", name: "NACS (Tesla)", nrel: "TESLA", osm: "socket:tesla_supercharger|socket:nacs|socket:tesla_destination" },
  { id: "chademo", name: "CHAdeMO", nrel: "CHADEMO", osm: "socket:chademo" },
];

/**
 * How far you can go between stops, in miles. Gas: refill when the tank is
 * down to `reserve` (a quarter by default). EV: charge to 80% and arrive
 * with at least 15%; the first leg starts at `startPct`.
 */
export function legRange(vehicle, { reserve = 0.25, startPct = 0.9 } = {}) {
  if (vehicle.kind === "ev") {
    const r = Math.max(50, vehicle.rangeMi || 250);
    return { first: r * (startPct - 0.15), next: r * (0.8 - 0.15) };
  }
  const full = Math.max(1, vehicle.mpg) * Math.max(1, vehicle.tankGal) * (1 - reserve);
  return { first: full, next: full };
}

/** The miles where you'll want to be stopping: [mile, ...] before `total`. */
export function stopTargets(total, range) {
  const out = [];
  let at = range.first;
  while (at < total - 5 && out.length < 60) {
    out.push(Math.round(at));
    at += range.next;
  }
  return out;
}

/**
 * Pick a station for each stop: the one nearest the target (but not past
 * it, since that's where you'd run low) and close to the road. stations
 * carry .mile and .off. Once a station is picked, the next target counts
 * from that station. Returns [{ target, station | null }].
 */
export function planStops(total, range, stations, { window = 0.3 } = {}) {
  const out = [];
  let from = 0;
  let reach = range.first;
  while (from + reach < total - 5 && out.length < 60) {
    const target = from + reach;
    const lo = target - reach * window;
    const pick = stations
      .filter(s => s.mile <= target && s.mile >= lo && s.mile > from + 1)
      .sort((a, b) => (target - a.mile) + a.off * 6 - ((target - b.mile) + b.off * 6))[0] ?? null;
    out.push({ target: Math.round(target), station: pick });
    from = pick ? pick.mile : target;
    reach = range.next;
  }
  return out;
}

/**
 * What the gas costs along a route, state by state, from EIA weekly
 * averages ({ area: $/gal }). Returns { gallons, cost, byState: [{ code,
 * miles, price }] } with cost null when there are no prices.
 */
export function fuelCost(points, vehicle, prices, shapes, step = 10) {
  const mpg = Math.max(1, vehicle.mpg || 25);
  const cum = cumulative(points);
  const total = cum[cum.length - 1] ?? 0;
  const byState = [];
  let cost = 0;
  let priced = 0;
  let prev = null;
  for (const s of sampleEvery(points, cum, step)) {
    const len = Math.min(step, total - s.mile);
    if (len <= 0) continue;
    const code = stateAt(shapes, s) ?? prev ?? "";
    prev = code || prev;
    const price = priceForState(code, prices);
    const last = byState[byState.length - 1];
    if (last && last.code === code) last.miles += len;
    else byState.push({ code, miles: len, price });
    if (Number.isFinite(price)) {
      cost += (len / mpg) * price;
      priced += len;
    }
  }
  // Any stretch without a price (outside the US) uses the average of the rest.
  if (priced && priced < total) cost *= total / priced;
  return {
    gallons: total / mpg,
    cost: priced ? cost : null,
    byState: byState.map(s => ({ ...s, miles: Math.round(s.miles) })),
  };
}

/** NREL's station record trimmed to what RoadFox shows. */
export function parseNrelStation(s) {
  if (!Number.isFinite(s?.latitude) || !Number.isFinite(s?.longitude)) return null;
  const plugs = (Array.isArray(s.ev_connector_types) ? s.ev_connector_types : []).map(String);
  return {
    id: `nrel:${s.id}`,
    name: String(s.station_name ?? "Charging station").slice(0, 90),
    lat: s.latitude,
    lon: s.longitude,
    network: s.ev_network ? String(s.ev_network).replace(/_/g, " ").slice(0, 40) : null,
    fast: Number(s.ev_dc_fast_num) || 0,
    level2: Number(s.ev_level2_evse_num) || 0,
    plugs: plugs.map(p => ({ J1772COMBO: "CCS", TESLA: "NACS", CHADEMO: "CHAdeMO", J1772: "J1772" })[p] ?? p),
    address: [s.street_address, s.city, s.state].filter(Boolean).join(", ").slice(0, 120),
    hours: s.access_days_time ? String(s.access_days_time).slice(0, 80) : null,
    pricing: s.ev_pricing ? String(s.ev_pricing).slice(0, 100) : null,
    source: "nrel",
  };
}

/** OSM fuel and charging stations as RoadFox stations. */
export function stationsFromOsm(body) {
  const out = [];
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (t.amenity === "fuel") {
      out.push({
        id: `osm:${e.type}/${e.id}`,
        kind: "fuel",
        name: String(t.brand ?? t.name ?? "Gas station").slice(0, 60),
        detail: t.brand && t.name && t.name !== t.brand ? String(t.name).slice(0, 60) : null,
        lat,
        lon,
        diesel: t["fuel:diesel"] === "yes",
        open24: t.opening_hours === "24/7",
        address: [[t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), t["addr:city"]].filter(Boolean).join(", "),
      });
    } else if (t.amenity === "charging_station") {
      const plugs = PLUGS.filter(p => p.osm.split("|").some(k => t[k] && t[k] !== "no")).map(p => p.name.split(" ")[0]);
      const kw = Math.max(0, ...Object.entries(t).filter(([k]) => /^socket:.+:output$/.test(k)).map(([, v]) => parseFloat(v) || 0));
      out.push({
        id: `osm:${e.type}/${e.id}`,
        kind: "ev",
        name: String(t.name ?? t.operator ?? t.network ?? "Charging station").slice(0, 60),
        network: t.network ?? t.operator ?? null,
        lat,
        lon,
        fast: kw >= 50 || Boolean(t["socket:tesla_supercharger"]) ? 1 : 0,
        plugs,
        address: [t["addr:street"], t["addr:city"]].filter(Boolean).join(", "),
        source: "osm",
      });
    } else if (t.place) {
      out.push({ id: `osm:${e.type}/${e.id}`, kind: "town", name: String(t.name ?? "").slice(0, 60), state: t["is_in:state_code"] ?? t["addr:state"] ?? null, lat, lon, pop: Number(t.population) || 0, size: t.place });
    }
  }
  return out;
}
