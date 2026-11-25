// Things to do and places to stay near where you're going, from three free
// sources that don't depend on each other, so one being slow or down
// never leaves the list empty:
//   - Wikipedia's map search: landmarks, museums, parks and history
//   - OpenStreetMap: attractions, parks, zoos, and hotels to campgrounds
//   - Ticketmaster (through TaskFox's /api/plan/events): shows and games on your dates
// Plain functions so the tests can run them.

import { milesBetween } from "./geo.js";

export const KINDS = [
  { id: "sights", name: "Sights and history" },
  { id: "museums", name: "Museums and art" },
  { id: "outdoors", name: "Outdoors" },
  { id: "family", name: "Kids and family" },
  { id: "events", name: "Shows and games" },
];
export const kindName = id => KINDS.find(k => k.id === id)?.name ?? "Plan";

// Wikipedia articles near a city include schools, streets and companies.
// Keep the ones whose short description says it's somewhere worth a visit.
const WIKI_KINDS = [
  ["family", /\b(zoo|aquarium|amusement park|theme park|water ?park|children'?s museum|science (center|centre|museum)|planetarium|carousel)\b/i],
  ["museums", /\b(museum|gallery|art (center|centre)|exhibit|library and museum)\b/i],
  ["outdoors", /\b(park|garden|arboretum|trail|lake|river|falls|waterfall|mountain|peak|canyon|beach|reserve|wilderness|forest|botanical|island|hot spring|scenic)\b/i],
  ["sights", /\b(landmark|monument|memorial|historic|national register|castle|cathedral|basilica|mission|lighthouse|bridge|tower|observatory|fort|palace|plaza|square|theat(er|re)|opera|stadium|arena|ballpark|market|pier|boardwalk|statue|ruins|site|district|capitol)\b/i],
];
const WIKI_SKIP = /\b(school|college|university|company|corporation|neighbou?rhood|street|road|highway|interstate|station|hospital|church in|congregation|apartment|office|building in|residential|census|unincorporated|township|county|city in|town in|village in|businessman|politician|radio|television|newspaper|airport|cemetery)\b/i;
const INDOOR = new Set(["museums"]);
const INDOOR_WORDS = /\b(museum|gallery|aquarium|planetarium|theat(er|re)|opera|science|library|mall|market hall|arena|observatory|cinema|bowling|arcade)\b/i;

/** Wikipedia geosearch pages -> [{ id, title, kind, about, lat, lon, miles, url, image, indoor, source }]. */
export function thingsFromWiki(body, center) {
  const pages = Object.values(body?.query?.pages ?? {});
  const out = [];
  for (const p of pages) {
    const c = p.coordinates?.[0];
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon) || typeof p.title !== "string") continue;
    const about = typeof p.description === "string" ? p.description : "";
    const text = `${p.title} ${about}`;
    if (WIKI_SKIP.test(about) && !/museum|park|zoo|aquarium|landmark|historic/i.test(about)) continue;
    const kind = WIKI_KINDS.find(([, re]) => re.test(text))?.[0];
    if (!kind) continue;
    out.push({
      id: `w${p.pageid}`,
      title: p.title,
      kind,
      about: about ? about[0].toUpperCase() + about.slice(1) : "",
      lat: c.lat,
      lon: c.lon,
      miles: milesBetween(center, c),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replaceAll(" ", "_"))}`,
      image: typeof p.thumbnail?.source === "string" && p.thumbnail.source.startsWith("https://") ? p.thumbnail.source : null,
      indoor: INDOOR.has(kind) || INDOOR_WORDS.test(text),
      source: "Wikipedia",
    });
  }
  return out;
}

function osmKind(t) {
  if (["zoo", "aquarium", "theme_park"].includes(t.tourism) || ["water_park", "miniature_golf", "amusement_arcade", "trampoline_park"].includes(t.leisure)) return "family";
  if (["museum", "gallery"].includes(t.tourism) || t.amenity === "arts_centre" || t.amenity === "planetarium") return "museums";
  if (t.tourism === "viewpoint" || ["park", "nature_reserve", "garden", "beach_resort"].includes(t.leisure) || ["peak", "beach", "waterfall", "hot_spring"].includes(t.natural) || t.waterway === "waterfall" || t.boundary === "national_park") return "outdoors";
  if (t.tourism === "attraction" || t.historic || t.amenity === "theatre") return "sights";
  return null;
}

const OSM_ABOUT = {
  zoo: "Zoo",
  aquarium: "Aquarium",
  theme_park: "Theme park",
  water_park: "Water park",
  miniature_golf: "Mini golf",
  amusement_arcade: "Arcade",
  trampoline_park: "Trampoline park",
  museum: "Museum",
  gallery: "Art gallery",
  arts_centre: "Arts center",
  planetarium: "Planetarium",
  viewpoint: "Viewpoint",
  park: "Park",
  nature_reserve: "Nature reserve",
  garden: "Garden",
  peak: "Mountain peak",
  beach: "Beach",
  waterfall: "Waterfall",
  hot_spring: "Hot spring",
  national_park: "National park",
  attraction: "Attraction",
  theatre: "Theater",
};

const website = t => [t.website, t["contact:website"], t.url].find(u => typeof u === "string" && /^https?:\/\//.test(u))?.replace(/^http:/, "https:") ?? null;
const at = e => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon });

/** Overpass elements -> things to do, named ones only. */
export function thingsFromOsm(body, center) {
  const out = [];
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const { lat, lon } = at(e);
    if (!t.name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const kind = osmKind(t);
    if (!kind) continue;
    // Little neighborhood parks crowd out the good ones; keep parks with a page or a site.
    if (t.leisure === "park" && !t.wikipedia && !t.wikidata && !website(t)) continue;
    const key = t.tourism ?? t.leisure ?? t.natural ?? t.amenity ?? t.boundary ?? (t.historic ? "historic" : "");
    out.push({
      id: `o${e.type?.[0] ?? "n"}${e.id}`,
      title: t.name,
      kind,
      about: t.historic && !OSM_ABOUT[key] ? "Historic site" : (OSM_ABOUT[key] ?? ""),
      lat,
      lon,
      miles: milesBetween(center, { lat, lon }),
      url: website(t) ?? (typeof t.wikipedia === "string" && /^en:/.test(t.wikipedia) ? `https://en.wikipedia.org/wiki/${encodeURIComponent(t.wikipedia.slice(3).replaceAll(" ", "_"))}` : null),
      image: null,
      indoor: kind === "museums" || ["aquarium", "amusement_arcade", "trampoline_park", "theatre", "planetarium"].includes(key),
      source: "OpenStreetMap",
    });
  }
  return out;
}

/** Ticketmaster events (TaskFox's shape) -> things to do on a set day. */
export function thingsFromEvents(events) {
  return (Array.isArray(events) ? events : []).map(e => ({
    id: `e${e.id}`,
    title: e.title,
    kind: "events",
    about: [e.genre, e.venue].filter(Boolean).join(" · "),
    day: e.day,
    time: e.time ?? null,
    lat: null,
    lon: null,
    miles: e.distance ?? null,
    url: typeof e.url === "string" && e.url.startsWith("https://") ? e.url : null,
    image: e.image ?? null,
    indoor: true,
    price: Number.isFinite(e.price?.min) ? e.price.min : Number.isFinite(e.priceMin) ? e.priceMin : null,
    family: e.kind === "family",
    source: "Ticketmaster",
  }));
}

const norm = s => s.toLowerCase().replace(/^the /, "").replace(/[^a-z0-9]/g, "");

/**
 * One list from every source: the same place from two sources shows once
 * (Wikipedia's write-up wins), closest first, kid-friendly first for a family.
 */
export function mergeThings(lists, { kids = 0 } = {}) {
  const seen = new Map();
  for (const t of lists.flat()) {
    const key = t.kind === "events" ? t.id : norm(t.title);
    const had = seen.get(key);
    if (!had) seen.set(key, t);
    else if (!had.image && t.image) seen.set(key, { ...had, image: t.image });
  }
  const rank = t => (kids && (t.kind === "family" || t.family) ? 0 : 1);
  return [...seen.values()].sort((a, b) => rank(a) - rank(b) || (a.day ?? "").localeCompare(b.day ?? "") || (a.miles ?? 99) - (b.miles ?? 99));
}

// Places to stay, by what OpenStreetMap calls them.
export const LODGING = {
  hotel: ["hotel"],
  motel: ["motel"],
  rental: ["apartment", "chalet", "guest_house"],
  hostel: ["hostel", "guest_house"],
  camp: ["camp_site", "caravan_site"],
  free: ["camp_site"],
};
const LODGING_NAME = { hotel: "Hotel", motel: "Motel", apartment: "Apartment", chalet: "Cabin or chalet", guest_house: "Guest house or B&B", hostel: "Hostel", camp_site: "Campground", caravan_site: "RV park" };

/** Overpass elements -> [{ id, name, kind, label, stars, lat, lon, miles, url, brand, free }]. */
export function staysFromOsm(body, center) {
  const out = [];
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const { lat, lon } = at(e);
    if (!t.name || !LODGING_NAME[t.tourism] || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const stars = Number.parseFloat(t.stars);
    out.push({
      id: `s${e.type?.[0] ?? "n"}${e.id}`,
      name: t.name,
      kind: t.tourism,
      label: LODGING_NAME[t.tourism],
      stars: Number.isFinite(stars) && stars > 0 && stars <= 7 ? stars : null,
      lat,
      lon,
      miles: milesBetween(center, { lat, lon }),
      url: website(t),
      brand: typeof t.brand === "string" ? t.brand : null,
      free: t.fee === "no",
    });
  }
  return out.sort((a, b) => a.miles - b.miles);
}

const q = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")).toString();
const placeText = p => (p.region ? `${p.name}, ${p.region}` : p.name);

/** Where to look up prices and book, with your dates and party filled in. */
export function stayLinks(trip, maxNight) {
  if (!trip.dest) return [];
  const where = placeText(trip.dest);
  const dates = trip.start && trip.end && trip.end > trip.start;
  const links = [];
  if (["hotel", "motel", "hostel", "rental"].includes(trip.stayKind) || !trip.stayKind) {
    links.push({
      id: "booking",
      name: "Booking.com",
      href: `https://www.booking.com/searchresults.html?${q({
        ss: where,
        checkin: dates ? trip.start : null,
        checkout: dates ? trip.end : null,
        group_adults: trip.adults,
        group_children: trip.kids || null,
        no_rooms: trip.rooms,
        nflt: maxNight > 0 ? `price=USD-0-${Math.round(maxNight)}-1` : null,
      })}`,
      note: maxNight > 0 ? `Up to $${Math.round(maxNight)} a night` : "Hotels, motels and more",
    });
    links.push({ id: "google", name: "Google Hotels", href: `https://www.google.com/travel/search?${q({ q: `hotels in ${where}` })}`, note: "Compare prices across sites" });
  }
  if (trip.stayKind === "rental" || trip.stayKind === "hostel" || trip.kids) {
    links.push({
      id: "airbnb",
      name: "Airbnb",
      href: `https://www.airbnb.com/s/${encodeURIComponent(where)}/homes?${q({ checkin: dates ? trip.start : null, checkout: dates ? trip.end : null, adults: trip.adults, children: trip.kids || null, price_max: maxNight > 0 ? Math.round(maxNight) : null })}`,
      note: "Whole homes, good for families",
    });
  }
  if (trip.stayKind === "camp" || trip.stayKind === "free") {
    links.push({ id: "recgov", name: "Recreation.gov", href: `https://www.recreation.gov/search?${q({ q: where })}`, note: "National park and forest campgrounds" });
    links.push({ id: "hipcamp", name: "Hipcamp", href: `https://www.hipcamp.com/en-US/search?${q({ q: where, arrive: dates ? trip.start : null, depart: dates ? trip.end : null, adults: trip.adults, children: trip.kids || null })}`, note: "Private land, cabins and glamping" });
  }
  if (trip.stayKind === "free") {
    links.push({ id: "freecamp", name: "FreeCampsites.net", href: "https://freecampsites.net/", note: "Free and dispersed camping, by map" });
  }
  return links;
}

/** Ways to book getting there. */
export function travelLinks(trip, { home, homeAirport }) {
  if (!trip.dest) return [];
  const where = placeText(trip.dest);
  const from = home ? placeText(home) : null;
  const maps = mode => `https://www.google.com/maps/dir/?${q({ api: 1, origin: from, destination: where, travelmode: mode })}`;
  if (trip.travel === "drive") return [{ id: "maps", name: "Google Maps", href: maps("driving"), note: "Live traffic" }];
  if (trip.travel === "fly") {
    const a = homeAirport?.code ?? from;
    const b = trip.airport?.code ?? where;
    const text = `Flights from ${a} to ${b}${trip.start ? ` on ${trip.start}` : ""}${trip.end && trip.end > trip.start ? ` returning ${trip.end}` : ""} for ${trip.adults} adult${trip.adults > 1 ? "s" : ""}${trip.kids ? ` and ${trip.kids} child${trip.kids > 1 ? "ren" : ""}` : ""}`;
    return [{ id: "gflights", name: "Google Flights", href: `https://www.google.com/travel/flights?${q({ q: text })}`, note: "Every airline, including Southwest" }];
  }
  if (trip.travel === "train") return [{ id: "amtrak", name: "Amtrak", href: "https://www.amtrak.com/", note: "U.S. trains" }, { id: "maps", name: "Google Maps", href: maps("transit"), note: "Routes and times" }];
  return [{ id: "greyhound", name: "Greyhound", href: "https://www.greyhound.com/", note: "U.S. buses" }, { id: "flix", name: "FlixBus", href: "https://www.flixbus.com/", note: "U.S. and Europe" }, { id: "maps", name: "Google Maps", href: maps("transit"), note: "Routes and times" }];
}

/** A map link for one place. */
export const mapLink = (lat, lon, name) => `https://www.google.com/maps/search/?${q({ api: 1, query: name ? `${name} ${lat.toFixed(5)},${lon.toFixed(5)}` : `${lat.toFixed(5)},${lon.toFixed(5)}` })}`;
