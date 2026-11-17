/* global process */
import { parseWatchmodeSources } from "../../src/services/watch/links.js";
import { isRegion } from "../../src/services/watch/parse.js";

// Direct links to a title on each service, from Watchmode. Optional: with
// no key, or once the monthly lookups run out, it returns no links and the
// page keeps its search and home page links.
const WATCHMODE_URL = "https://api.watchmode.com/v1";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const type = String(req.query.type ?? "");
  const id = String(req.query.id ?? "");
  const region = String(req.query.region ?? "US").toUpperCase();

  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id) || !isRegion(region)) {
    return res.status(400).json({ error: "A movie or show id is required." });
  }

  const apiKey = process.env.WATCHMODE_API_KEY?.trim();

  if (!apiKey) {
    return res.status(200).json({ links: [], reason: "no-key" });
  }

  try {
    // Watchmode accepts TMDB ids written as "movie-603" or "tv-1396".
    const url = new URL(`${WATCHMODE_URL}/title/${type}-${id}/sources/`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", region);

    const response = await fetch(url, { headers: { accept: "application/json" } });

    if (!response.ok) {
      // Not found or out of lookups: fall back quietly, and don't cache long.
      res.setHeader("Cache-Control", "s-maxage=3600");
      return res.status(200).json({ links: [], reason: `status-${response.status}` });
    }

    const links = parseWatchmodeSources(await response.json(), region);

    // Each title is looked up once a week at most, to save lookups.
    res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=1209600");

    return res.status(200).json({ links });
  } catch (error) {
    console.error("Watchmode error:", error);
    return res.status(200).json({ links: [], reason: "error" });
  }
}
