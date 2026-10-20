/* global process */
// Cheapest fares by departure day, from the Travelpayouts (Aviasales) data
// API (free token: travelpayouts.com). Prices are what travelers found in
// recent searches, so they're a guide to cheap days rather than a quote.

const PRICES = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const PLACES = "https://autocomplete.travelpayouts.com/places2";
const isCode = value => /^[A-Z]{3}$/.test(value);
const isMonth = value => /^\d{4}-\d{2}$/.test(value);

/**
 * Cheapest fare per departure day, airline and nonstop-or-not, so a trip
 * can still be filtered by airline: [{ day, price, airline, transfers, link }].
 */
export function parseFares(body) {
  const best = new Map();
  for (const f of Array.isArray(body?.data) ? body.data : []) {
    const day = typeof f.departure_at === "string" ? f.departure_at.slice(0, 10) : null;
    if (!day || !Number.isFinite(f.price)) continue;
    const key = `${day}|${f.airline ?? ""}|${f.transfers === 0 ? 0 : 1}`;
    const current = best.get(key);
    if (current && current.price <= f.price) continue;
    best.set(key, {
      day,
      price: f.price,
      airline: f.airline ?? "",
      transfers: Number.isFinite(f.transfers) ? f.transfers : null,
      returnDay: typeof f.return_at === "string" ? f.return_at.slice(0, 10) : null,
      link: typeof f.link === "string" && f.link.startsWith("/") ? `https://www.aviasales.com${f.link}` : null,
    });
  }
  return [...best.values()].sort((a, b) => a.day.localeCompare(b.day) || a.price - b.price);
}

export function parsePlaces(list) {
  return (Array.isArray(list) ? list : [])
    .filter(p => isCode(p.code) && (p.type === "city" || p.type === "airport"))
    .map(p => ({
      code: p.code,
      name: p.type === "airport" ? `${p.name} (${p.code})` : p.name,
      city: p.city_name ?? p.name,
      country: p.country_name ?? "",
      type: p.type,
    }))
    .slice(0, 8);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.term !== undefined) {
    const term = String(req.query.term).trim().slice(0, 60);
    if (term.length < 2) return res.status(200).json({ places: [] });
    try {
      const params = new URLSearchParams({ term, locale: "en" });
      params.append("types[]", "city");
      params.append("types[]", "airport");
      const response = await fetch(`${PLACES}?${params}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Place search failed with status ${response.status}`);
      res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=2592000");
      return res.status(200).json({ places: parsePlaces(await response.json()) });
    } catch (error) {
      console.error("Airport search error:", error);
      return res.status(502).json({ error: "Airport search isn't responding. Try again in a moment." });
    }
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN?.trim();
  if (!token) {
    return res.status(503).json({ error: "Flight prices aren't set up yet: the Travelpayouts token is missing.", code: "no-key" });
  }
  const origin = String(req.query.from ?? "").toUpperCase();
  const destination = String(req.query.to ?? "").toUpperCase();
  const month = String(req.query.month ?? "");
  const currency = /^[a-z]{3}$/i.test(String(req.query.currency ?? "")) ? String(req.query.currency).toLowerCase() : "usd";
  if (!isCode(origin) || !isCode(destination) || origin === destination || !isMonth(month)) {
    return res.status(400).json({ error: "Airport or city codes and a month like 2026-11 are required." });
  }

  try {
    const params = new URLSearchParams({
      origin,
      destination,
      departure_at: month,
      one_way: "true",
      direct: "false",
      sorting: "price",
      currency,
      limit: "1000",
      token,
    });
    const response = await fetch(`${PRICES}?${params}`, { headers: { accept: "application/json", "x-access-token": token } });
    if (response.status === 401 || response.status === 403) {
      return res.status(503).json({ error: "Travelpayouts didn't accept the token. Check TRAVELPAYOUTS_TOKEN in Vercel.", code: "no-key" });
    }
    if (!response.ok) throw new Error(`Travelpayouts request failed with status ${response.status}`);
    const fares = parseFares(await response.json());
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ from: origin, to: destination, month, currency, fares });
  } catch (error) {
    console.error("Flight prices error:", error);
    return res.status(502).json({ error: "Flight prices aren't responding. Try again in a moment." });
  }
}
