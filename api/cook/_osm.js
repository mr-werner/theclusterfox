// Grocery stores from OpenStreetMap (free, keyless, through the Overpass
// API; data © OpenStreetMap contributors, ODbL). The browser asks Overpass
// directly: Overpass allows it, and it keeps each lookup on the shopper's
// own connection, since Overpass turns away busy cloud servers.

import { clean, isLat, isLon, miles, webUrl } from "./_geo.js";

export const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
export const SHOPS = "supermarket|grocery|wholesale|greengrocer|health_food";
export const KROGER_BRANDS = /kroger|ralphs|fred meyer|king soopers|smith'?s|fry'?s|qfc|harris teeter|dillons|mariano'?s|pick ?'?n ?save|metro market|foods co|city market|gerbes|baker'?s|jay ?c|pay ?less|food ?4 ?less|ruler|copps/i;

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
export async function fetchOsm(lat, lon, radius, { timeout = 15000 } = {}) {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius * 1609.34) }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timed out")), timeout);
  try {
    return await Promise.any(
      OVERPASS.map(async url => {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: controller.signal });
        if (!response.ok) throw new Error(`${new URL(url).host}: ${response.status}`);
        return parseOsm(await response.json(), { lat, lon });
      })
    );
  } catch (error) {
    throw new Error("Store search isn't responding. Try again in a moment.", { cause: error });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
