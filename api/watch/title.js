import { isRegion, parseDetails } from "../../src/services/watch/parse.js";
import { sendError, tmdb } from "./_tmdb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const type = String(req.query.type ?? "");
  const id = String(req.query.id ?? "");
  const region = String(req.query.region ?? "US").toUpperCase();

  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "A movie or show id is required." });
  }

  if (!isRegion(region)) {
    return res.status(400).json({ error: "Unknown region." });
  }

  try {
    const data = await tmdb(`/${type}/${id}`, {
      language: "en-US",
      append_to_response: "videos,watch/providers",
    });

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");

    return res.status(200).json({ title: parseDetails(data, type, region) });
  } catch (error) {
    return sendError(res, error, "Unable to load this title.");
  }
}
