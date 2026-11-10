/* global process */
// Grocery stores near a point. Every store comes from OpenStreetMap (free,
// keyless, through the Overpass API; data © OpenStreetMap contributors,
// ODbL). When Kroger keys are set, Kroger-family stores come from Kroger
// instead, so they carry the store ID that live prices need.

import { clean, isLat, isLon, miles, webUrl } from "./_geo.js";
import { kroger, krogerReady, parseLocations } from "./_kroger.js";

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const SHOPS = "supermarket|grocery|wholesale|greengrocer|health_food";
const KROGER_BRANDS = /kroger|ralphs|fred meyer|king soopers|smith'?s|fry'?s|qfc|harris teeter|dillons|mariano'?s|pick ?'?n ?save|metro market|foods co|city market|gerbes|baker'?s|jay ?c|pay ?less|food ?4 ?less|ruler|copps/i;
const MAX_MILES = 25;

export function overpassQuery(lat, lon, meters) {
  return `[out:json][timeout:10];nwr(around:${Math.round(meters)},${lat.toFixed(5)},${lon.toFixed(5)})["shop"~"^(${SHOPS})$"]["name"];out center tags 150;`;
}

export function parseOsm(body, here) {
  const out = [];
  for (const e of Array.isArray(body?.elements) ? body.elements : []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!t.name || !isLat(lat) || !isLon(lon)) continue;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    out.push({
      id: `osm:${e.type}/${e.id}`,
      name: clean(t.name, 80),
      brand: clean(t.brand, 60) || null,
      kind: clean(t.shop, 20),
      lat,
      lon,
      distance: Math.round(miles(here, { lat, lon }) * 10) / 10,
      address: [street, t["addr:city"], [t["addr:state"], t["addr:postcode"]].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      website: webUrl(t.website ?? t["contact:website"] ?? t["brand:website"]),
      phone: clean(t.phone ?? t["contact:phone"], 30) || null,
      hours: clean(t.opening_hours, 120) || null,
    });
  }
  return out;
}

// Kroger's own list replaces OSM's copies of the same stores.
export function mergeStores(osm, krogerStores, here) {
  const withDistance = krogerStores.map(s => ({ ...s, brand: s.name, kind: "supermarket", distance: Math.round(miles(here, s) * 10) / 10, website: null, hours: null }));
  const kept = osm.filter(s => !(KROGER_BRANDS.test(s.brand ?? s.name) && withDistance.some(k => miles(k, s) < 0.35)));
  const seen = new Set();
  return [...kept, ...withDistance]
    .filter(s => {
      // OSM sometimes maps a store as both a point and a building.
      const key = `${(s.brand ?? s.name).toLowerCase()}|${s.lat.toFixed(3)}|${s.lon.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.distance - b.distance);
}

// Asks every Overpass mirror at once and takes the first good answer, since
// any one of them can be busy.
async function fromOsm(lat, lon, radius) {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius * 1609.34) }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timed out")), 12000);
  try {
    return await Promise.any(
      OVERPASS.map(async url => {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "TheClusterFox-CookFox/1.0 (+https://theclusterfox.com)" },
            body,
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`${response.status}`);
          return parseOsm(await response.json(), { lat, lon });
        } catch (error) {
          throw new Error(`${new URL(url).host}: ${error.message}`, { cause: error });
        }
      })
    );
  } catch (error) {
    throw new Error(error.errors ? error.errors.map(e => e.message).join("; ") : error.message, { cause: error });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export default async function stores(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Math.min(MAX_MILES, Math.max(1, Number(req.query.radius) || 10));
  if (!isLat(lat) || !isLon(lon)) return res.status(400).json({ error: "A location is required." });
  const here = { lat, lon };

  const [osm, krogerStores] = await Promise.allSettled([
    fromOsm(lat, lon, radius),
    krogerReady() ? kroger("/locations", { "filter.lat.near": lat, "filter.lon.near": lon, "filter.radiusInMiles": radius, "filter.limit": 50 }).then(parseLocations) : Promise.resolve([]),
  ]);
  if (osm.status === "rejected") console.error("CookFox stores (OpenStreetMap):", osm.reason?.message ?? osm.reason);
  if (krogerStores.status === "rejected") console.error("CookFox stores (Kroger):", krogerStores.reason?.message ?? krogerStores.reason);
  const list = mergeStores(osm.value ?? [], krogerStores.value ?? [], here).filter(s => s.distance <= radius);
  // With OpenStreetMap down, an empty or Kroger-only list isn't the real answer: say so and don't cache it.
  if (osm.status === "rejected" && !list.length) return res.status(502).json({ error: "Store search isn't responding. Try again in a moment." });
  res.setHeader("Cache-Control", osm.status === "rejected" ? "no-store" : "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({
    stores: list.slice(0, 80),
    partial: osm.status === "rejected",
    features: { livePrices: krogerReady(), instacart: Boolean(process.env.INSTACART_API_KEY?.trim()) },
  });
}
