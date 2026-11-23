import { isRegion, parseSearchResult, parseWatchProviders } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "./_tmdb.js";

const MAX_RESULTS = 10;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = req.query.q?.trim();
  const region = String(req.query.region ?? "US").toUpperCase();

  if (!query) {
    return res.status(400).json({ error: "A show or movie to search for is required." });
  }

  if (!isRegion(region)) {
    return res.status(400).json({ error: "Unknown region." });
  }

  try {
    const data = await tmdb("/search/multi", {
      query: query.slice(0, 100),
      include_adult: "false",
      language: "en-US",
    });

    const titles = (data.results ?? [])
      .map(parseSearchResult)
      .filter(Boolean)
      .slice(0, MAX_RESULTS);

    // Where each title streams. One title failing shouldn't sink the search.
    const results = await Promise.all(
      titles.map(async (title) => {
        try {
          const providers = await tmdb(`/${title.type}/${title.id}/watch/providers`);
          return { ...title, providers: parseWatchProviders(providers.results, region) };
        } catch {
          return { ...title, providers: null };
        }
      })
    );

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");

    return res.status(200).json({ query, region, results });
  } catch (error) {
    return sendError(res, error, "Unable to search shows and movies.");
  }
}
