import { isRegion, TMDB_IMAGE } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "../watch/_tmdb.js";

const MAX_DAYS = 62;
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);

// Theatrical (2, 3) and digital (4) release dates in a region, from TMDB.
const TYPES = { theaters: "2|3", digital: "4" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const region = String(req.query.region ?? "US").toUpperCase();

  if (!isDay(from) || !isDay(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) {
    return res.status(400).json({ error: "Dates like from=2026-10-01&to=2026-10-31 are required." });
  }

  if (!isRegion(region)) {
    return res.status(400).json({ error: "Unknown region." });
  }

  const discover = (type, page) =>
    tmdb("/discover/movie", {
      region,
      "release_date.gte": from,
      "release_date.lte": to,
      with_release_type: TYPES[type],
      sort_by: "popularity.desc",
      include_adult: "false",
      language: "en-US",
      page: String(page),
    }).then(data =>
      (data.results ?? []).map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        day: item.release_date ?? null,
        overview: item.overview ?? "",
        poster: item.poster_path ? `${TMDB_IMAGE}/w185${item.poster_path}` : null,
        popularity: item.popularity ?? 0,
        release: type,
      }))
    );

  try {
    const lists = await Promise.all([discover("theaters", 1), discover("theaters", 2), discover("digital", 1)]);
    const seen = new Set();
    const movies = lists
      .flat()
      .filter(m => m.day && m.day >= from && m.day <= to && !seen.has(m.id) && seen.add(m.id))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 80);

    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");

    return res.status(200).json({ from, to, region, movies });
  } catch (error) {
    return sendError(res, error, "Unable to load movie releases.");
  }
}
