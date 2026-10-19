import { BROWSE_LISTS, interleave, isRegion, parseSearchResult } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "./_tmdb.js";

const STREAMING = "flatrate|free|ads";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const list = String(req.query.list ?? "trending");
  const region = String(req.query.region ?? "US").toUpperCase();
  const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 10);
  const providers = String(req.query.providers ?? "")
    .split(",")
    .filter((id) => /^\d+$/.test(id))
    .slice(0, 40);

  if (!BROWSE_LISTS.some((item) => item.id === list)) {
    return res.status(400).json({ error: "Unknown list." });
  }

  if (!isRegion(region)) {
    return res.status(400).json({ error: "Unknown region." });
  }

  if (list === "mine" && !providers.length) {
    return res.status(400).json({ error: "Pick your services first." });
  }

  // Popular titles that actually stream somewhere in this region.
  const discover = (type, extra = {}) =>
    tmdb(`/discover/${type}`, {
      sort_by: "popularity.desc",
      watch_region: region,
      with_watch_monetization_types: STREAMING,
      include_adult: "false",
      language: "en-US",
      page: String(page),
      ...extra,
    }).then((data) => (data.results ?? []).map((item) => parseSearchResult(item, type)).filter(Boolean));

  try {
    let results;

    if (list === "trending") {
      const data = await tmdb("/trending/all/week", { language: "en-US", page: String(page) });
      results = (data.results ?? []).map((item) => parseSearchResult(item)).filter(Boolean);
    } else if (list === "movies") {
      results = await discover("movie");
    } else if (list === "shows") {
      results = await discover("tv");
    } else {
      const extra = { with_watch_providers: providers.join("|") };
      const [movies, shows] = await Promise.all([discover("movie", extra), discover("tv", extra)]);
      results = interleave(shows, movies);
    }

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");

    return res.status(200).json({ list, region, page, results });
  } catch (error) {
    return sendError(res, error, "Unable to load popular titles.");
  }
}
