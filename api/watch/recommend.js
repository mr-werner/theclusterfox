import { parseSearchResult, rankRecommendations } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "./_tmdb.js";

const MAX_SEEDS = 10;
const MAX_RESULTS = 60;

// Titles like the viewer's favorites, from TMDB's recommendations for each.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // items=movie:603,tv:1396 (most recent favorites first)
  const seeds = String(req.query.items ?? "")
    .split(",")
    .map((part) => part.split(":"))
    .filter(([type, id]) => (type === "movie" || type === "tv") && /^\d+$/.test(id ?? ""))
    .slice(0, MAX_SEEDS);

  if (!seeds.length) {
    return res.status(400).json({ error: "Favorite a few titles first." });
  }

  try {
    const lists = await Promise.all(
      seeds.map(([type, id]) =>
        tmdb(`/${type}/${id}/recommendations`, { language: "en-US" })
          .then((data) => (data.results ?? []).map((item) => parseSearchResult(item, item.media_type ?? type)).filter(Boolean))
          .catch(() => [])
      )
    );

    const exclude = seeds.map(([type, id]) => `${type}-${id}`);
    const results = rankRecommendations(lists, exclude).slice(0, MAX_RESULTS);

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");

    return res.status(200).json({ results });
  } catch (error) {
    return sendError(res, error, "Unable to load recommendations.");
  }
}
