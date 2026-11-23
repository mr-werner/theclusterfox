import { isRegion, mergeProviderLists } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "./_tmdb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const region = String(req.query.region ?? "US").toUpperCase();

  if (!isRegion(region)) {
    return res.status(400).json({ error: "Unknown region." });
  }

  try {
    const [tv, movie] = await Promise.all([
      tmdb("/watch/providers/tv", { watch_region: region }),
      tmdb("/watch/providers/movie", { watch_region: region }),
    ]);

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

    return res.status(200).json({
      region,
      providers: mergeProviderLists(tv.results ?? [], movie.results ?? []),
    });
  } catch (error) {
    return sendError(res, error, "Unable to load streaming services.");
  }
}
