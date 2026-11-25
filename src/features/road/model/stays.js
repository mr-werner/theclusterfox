// Where to sleep on a RoadTripFox trip: hotels in the bigger towns along the
// way by default, or campgrounds, rest areas, truck stops and free
// (dispersed) camping. Places come from OpenStreetMap; nightly prices are
// estimates from the hotel's brand or stars, since nobody publishes real
// rates for free. Plain functions so tests can use them.

import { locate, miles } from "./geo.js";

export const STAY_KINDS = [
  { id: "city", name: "Hotels in a bigger town", short: "Hotel", blurb: "Towns with the most hotels, so there's a choice and a fair price." },
  { id: "camp", name: "Campgrounds & RV parks", short: "Campground", blurb: "Paid campgrounds and RV parks near the road." },
  { id: "free", name: "Dispersed / free camping", short: "Free camping", blurb: "Free and basic campsites. Most national forest and BLM land also allows free camping." },
  { id: "rest", name: "Rest areas", short: "Rest area", blurb: "Free, but check the state's overnight rules. Many allow a few hours, some don't allow sleeping." },
  { id: "truck", name: "Truck stops", short: "Truck stop", blurb: "Free overnight parking, showers and food. Park with the cars, not in the truck lanes." },
];
export const STAY_BY_ID = Object.fromEntries(STAY_KINDS.map(k => [k.id, k]));

// Rough nightly rates (USD, before tax) by brand tier.
const TIERS = [
  [68, /motel 6|studio 6|super 8|red roof|days inn|econo ?lodge|rodeway|travelodge|americas? best value|knights inn|microtel|budget host|scottish inn|howard johnson|ho-?jo|budget inn|deluxe inn|value place|extended stay america|intown suites|e-?z 8/i],
  [96, /quality inn|sleep inn|la quinta|baymont|wingate|clarion|ramada|surestay|best western(?! plus| premier)|americinn|country inn|cobblestone|boarders|stayable|woodspring|candlewood|mainstay|suburban/i],
  [128, /hampton|holiday inn|comfort (inn|suites)|best western plus|fairfield|courtyard|hilton garden|drury|towneplace|home2|tru by|springhill|grandstay|\bavid\b|tryp|sonesta|hyatt place|staybridge|holiday inn express|cambria|best western premier|four points|homewood|residence inn|\bac hotel|aloft|element hotel|hotel indigo|\beven hotel/i],
  [185, /marriott|hilton(?! garden)|hyatt(?! place)|sheraton|westin|embassy suites|doubletree|kimpton|renaissance|\bomni\b|crowne plaza|radisson|le meridien|autograph|curio|tapestry|canopy|graduate|loews|fairmont|intercontinental|\bw hotel|ritz|four seasons|waldorf|conrad|jw marriott|st\.? regis|andaz/i],
];
const STARS = { 1: 70, 2: 92, 3: 135, 4: 205, 5: 340 };
const TRUCK_BRANDS = /love'?s|pilot|flying j|petro|\bta\b|travelcenters|travel centers|sapp bros|bosselman|roady'?s|ambest|kwik star|boss shop|road ranger|town pump|little america|iowa 80|buc-?ee'?s/i;

/** A dollar amount from OSM's charge tag ("25 USD", "$30/night", "USD 18"), or null. */
export function parseCharge(text) {
  if (typeof text !== "string") return null;
  const m = /(\d{1,4}(?:\.\d{1,2})?)/.exec(text.replace(/,/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n < 2000 ? n : null;
}

/** The estimated nightly price of a stay, in dollars. */
export function estimatePrice(stay, townPop = 0) {
  if (stay.kind === "rest" || stay.kind === "truck" || stay.kind === "free") return stay.charge ?? 0;
  if (stay.charge != null) return stay.charge;
  if (stay.kind === "camp") return /koa/i.test(stay.name) ? 58 : stay.rv ? 48 : 32;
  let base = null;
  const label = `${stay.brand ?? ""} ${stay.name}`;
  // Cheapest tier first: "Days Inn by Wyndham" is a Days Inn.
  for (const [price, re] of TIERS) if (base == null && re.test(label)) base = price;
  if (base == null && STARS[stay.stars]) base = STARS[stay.stars];
  if (base == null) base = stay.type === "motel" ? 78 : stay.type === "hostel" ? 42 : stay.type === "guest_house" ? 115 : 120;
  // Big cities cost more.
  const city = townPop > 500000 ? 1.3 : townPop > 150000 ? 1.14 : townPop > 0 && townPop < 8000 ? 0.92 : 1;
  return Math.round(base * city);
}

const short = (v, n = 70) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/**
 * OpenStreetMap elements as overnight options and the towns near the road:
 * [{ id, kind, name, lat, lon, ... }] where kind is a STAY_KINDS id, "hotel"
 * (a lodging that belongs to the city option), "fuel" or "town".
 */
export function corridorFromOsm(body) {
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = `osm:${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const base = { id, lat, lon, website: /^https?:\/\//.test(t.website ?? t["contact:website"] ?? "") ? t.website ?? t["contact:website"] : null, phone: short(t.phone ?? t["contact:phone"], 30) };
    if (t.place === "city" || t.place === "town") {
      if (!t.name) continue;
      out.push({ ...base, kind: "town", name: short(t.name, 60), size: t.place, pop: Number(String(t.population ?? "").replace(/[^\d]/g, "")) || 0, state: short(t["is_in:state_code"] ?? t["addr:state"], 4) });
    } else if (/^(hotel|motel|guest_house|hostel)$/.test(t.tourism ?? "")) {
      if (t.access === "private") continue;
      out.push({ ...base, kind: "hotel", type: t.tourism, name: short(t.name ?? t.brand, 70) ?? (t.tourism === "motel" ? "Motel" : "Hotel"), brand: short(t.brand, 50), stars: Number.parseInt(t.stars, 10) || null, town: short(t["addr:city"], 40) });
    } else if (t.tourism === "camp_site" || t.tourism === "caravan_site") {
      if (t.access === "private" || t.access === "no" || t.camp_site === "camp_pitch") continue;
      const free = t.fee === "no" || t.backcountry === "yes" || /^(basic|primitive|dispersed)$/.test(t.camp_site ?? "") || t.informal === "yes";
      out.push({ ...base, kind: free ? "free" : "camp", name: short(t.name, 70) ?? (free ? "Free campsite" : t.tourism === "caravan_site" ? "RV park" : "Campground"), rv: t.tourism === "caravan_site" || t.caravans === "yes", charge: free ? (t.fee === "no" ? 0 : parseCharge(t.charge)) : parseCharge(t.charge), toilets: t.toilets === "yes", water: t.drinking_water === "yes", showers: t.shower === "yes" });
    } else if (t.highway === "rest_area" || t.highway === "services") {
      out.push({ ...base, kind: t.highway === "services" && TRUCK_BRANDS.test(`${t.brand ?? ""} ${t.name ?? ""}`) ? "truck" : "rest", name: short(t.name, 70) ?? (t.highway === "services" ? "Service plaza" : "Rest area"), toilets: t.toilets !== "no" });
    } else if (t.amenity === "fuel") {
      const label = `${t.brand ?? ""} ${t.name ?? ""} ${t.operator ?? ""}`;
      const truck = t.hgv === "yes" || t["fuel:HGV_diesel"] === "yes" || TRUCK_BRANDS.test(label);
      out.push({ ...base, kind: "fuel", name: short(t.brand ?? t.name, 60) ?? "Gas station", brand: short(t.brand, 50), truck, diesel: t["fuel:diesel"] === "yes" || truck, open24: t.opening_hours === "24/7" });
      if (truck && TRUCK_BRANDS.test(label)) out.push({ ...base, id: `${id}#stay`, kind: "truck", name: short(t.brand ?? t.name, 60) ?? "Truck stop", showers: t.shower === "yes" });
    }
  }
  return out;
}

/** Each item's spot along the route: adds { mile, off } and drops the far ones. */
export function placeOnRoute(items, samples, maxOff = 12) {
  return items
    .map(p => ({ ...p, ...locate(samples, p) }))
    .filter(p => p.off <= (p.kind === "town" ? 14 : maxOff))
    .map(p => ({ ...p, mile: Math.round(p.mile * 10) / 10, off: Math.round(p.off * 10) / 10 }));
}

/** The towns with their hotels gathered round them: [{ town, hotels, count, lo, hi, prices }]. */
export function hotelTowns(items, budget) {
  const towns = items.filter(i => i.kind === "town");
  const hotels = items.filter(i => i.kind === "hotel");
  const groups = new Map(towns.map(t => [t.id, { town: t, hotels: [] }]));
  for (const h of hotels) {
    let best = null;
    let bestD = 9;
    for (const t of towns) {
      const d = miles(t, h);
      const reach = t.size === "city" ? 9 : 6;
      if (d < reach && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (best) groups.get(best.id).hotels.push(h);
  }
  return [...groups.values()]
    .filter(g => g.hotels.length)
    .map(g => {
      const priced = g.hotels.map(h => ({ ...h, price: estimatePrice(h, g.town.pop) })).sort((a, b) => a.price - b.price);
      const prices = priced.map(h => h.price);
      const fit = budget > 0 ? priced.filter(h => h.price <= budget).length : priced.length;
      return { town: g.town, hotels: priced, count: priced.length, lo: prices[0], hi: prices[prices.length - 1], typical: prices[Math.floor(prices.length / 2)], fit };
    });
}

/**
 * The best place to stop for the night near `target` miles, between lo and
 * hi. pref is a STAY_KINDS id. Returns the pick and, for comparison, the
 * best of every other kind:
 * { pick, options: { kind: option } } where an option is
 * { kind, mile, name, lat, lon, price, lo, hi, count, inBudget, place, hotels }.
 */
export function pickNight(items, { target, lo, hi, pref = "city", budget = 0 }) {
  const inWindow = items.filter(i => i.mile >= lo && i.mile <= hi);
  const away = m => Math.abs(m - target) * 0.045 + Math.max(0, m - target) * 0.03;
  const options = {};

  // Hotels: favor towns with lots of hotels (more choice, fairer prices).
  const towns = hotelTowns(inWindow, budget);
  let bestTown = null;
  for (const g of towns) {
    const share = budget > 0 ? g.fit / g.count : 1;
    const score = 3.2 * Math.log2(1 + g.count) + Math.min(2.5, Math.log10(1 + g.town.pop) / 2.2) + (budget > 0 ? 3 * share - (g.fit ? 0 : 2) : 0) - away(g.town.mile);
    if (!bestTown || score > bestTown.score) bestTown = { ...g, score };
  }
  if (bestTown) {
    const fits = bestTown.hotels.filter(h => !budget || h.price <= budget);
    options.city = { kind: "city", mile: bestTown.town.mile, name: bestTown.town.name, lat: bestTown.town.lat, lon: bestTown.town.lon, count: bestTown.count, lo: bestTown.lo, hi: bestTown.hi, price: fits.length ? fits[fits.length - 1].price : bestTown.lo, inBudget: !budget || bestTown.fit > 0, fit: bestTown.fit, hotels: bestTown.hotels.slice(0, 40), town: bestTown.town };
  } else {
    // No town with hotels mapped nearby: take the best lone hotel.
    const lone = inWindow.filter(i => i.kind === "hotel").map(h => ({ ...h, price: estimatePrice(h) }));
    const h = lone.sort((a, b) => away(a.mile) - away(b.mile))[0];
    if (h) options.city = { kind: "city", mile: h.mile, name: h.name, lat: h.lat, lon: h.lon, count: 1, lo: h.price, hi: h.price, price: h.price, inBudget: !budget || h.price <= budget, fit: !budget || h.price <= budget ? 1 : 0, hotels: [h], place: h };
  }

  for (const kind of ["camp", "free", "rest", "truck"]) {
    const list = inWindow.filter(i => i.kind === kind).map(p => ({ ...p, price: estimatePrice(p) }));
    const value = p => -away(p.mile) - p.off * 0.25 + (budget && p.price <= budget ? 2 : 0) + (p.name && !/^(rest area|campground|free campsite|rv park)$/i.test(p.name) ? 0.4 : 0) + (p.showers ? 0.4 : 0) + (p.toilets ? 0.3 : 0);
    const p = list.sort((a, b) => value(b) - value(a))[0];
    if (p) options[kind] = { kind, mile: p.mile, name: p.name, lat: p.lat, lon: p.lon, price: p.price, lo: p.price, hi: p.price, count: list.length, inBudget: !budget || p.price <= budget, place: p };
  }

  let pick = options[pref] ?? null;
  // Over budget? A cheaper kind nearby is offered, but your pick stays yours.
  if (!pick) {
    const order = pref === "city" ? ["camp", "truck", "rest", "free"] : pref === "camp" ? ["free", "city", "truck", "rest"] : pref === "free" ? ["camp", "rest", "truck", "city"] : pref === "rest" ? ["truck", "free", "camp", "city"] : ["rest", "free", "camp", "city"];
    pick = order.map(k => options[k]).find(Boolean) ?? null;
  }
  return { pick, options };
}

/** Booking and map search links for a night. */
export function stayLinks(option, { checkin, checkout } = {}) {
  const name = option.town?.name ?? option.name;
  const q = s => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`;
  const near = `${option.lat.toFixed(4)},${option.lon.toFixed(4)}`;
  if (option.kind === "city") {
    const qs = new URLSearchParams({ ss: name, group_adults: "2", no_rooms: "1" });
    if (checkin && checkout) {
      qs.set("checkin", checkin);
      qs.set("checkout", checkout);
    }
    return [
      { label: "Compare prices", href: `https://www.booking.com/searchresults.html?${qs}` },
      { label: "Hotels map", href: q(`hotels near ${name}`) },
    ];
  }
  if (option.kind === "free") return [{ label: "Map", href: q(near) }, { label: "More free sites", href: `https://freecampsites.net/#!${option.lat.toFixed(4)},${option.lon.toFixed(4)},10` }];
  if (option.kind === "camp") return [{ label: "Map", href: q(near) }, ...(option.place?.website ? [{ label: "Website", href: option.place.website }] : [])];
  return [{ label: "Map", href: q(near) }];
}
