/* global process */
// Kroger-family stores near a point, with the store IDs that live prices
// need, plus which optional features this site has keys for. Every other
// store comes from OpenStreetMap, which the browser asks directly
// (see _osm.js), and the two lists are merged there.

import { isLat, isLon } from "./_geo.js";
import { kroger, krogerReady, parseLocations } from "./_kroger.js";

const MAX_MILES = 25;

export default async function stores(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Math.min(MAX_MILES, Math.max(1, Number(req.query.radius) || 10));
  if (!isLat(lat) || !isLon(lon)) return res.status(400).json({ error: "A location is required." });
  const features = { livePrices: krogerReady(), instacart: Boolean(process.env.INSTACART_API_KEY?.trim()) };
  if (!features.livePrices) {
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    return res.status(200).json({ stores: [], features });
  }
  try {
    const list = parseLocations(await kroger("/locations", { "filter.lat.near": lat, "filter.lon.near": lon, "filter.radiusInMiles": radius, "filter.limit": 50 }));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ stores: list, features });
  } catch (error) {
    console.error("CookFox stores (Kroger):", error.message);
    // Without Kroger's list, its stores still show up from OpenStreetMap, just without live prices.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ stores: [], features: { ...features, livePrices: false } });
  }
}
