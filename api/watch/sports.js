import { leaguesById, parseScoreboard } from "../../src/services/watch/parse.js";

// ESPN's public scoreboard feed: no key needed, US broadcast listings.
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const league = leaguesById.get(req.query.league);
  const date = String(req.query.date ?? "");

  if (!league) {
    return res.status(400).json({ error: "Unknown league." });
  }

  if (!/^\d{8}$/.test(date)) {
    return res.status(400).json({ error: "A date like 20261019 is required." });
  }

  try {
    const url = new URL(`${ESPN_URL}/${league.path}/scoreboard`);
    url.searchParams.set("dates", date);
    url.searchParams.set("limit", "300");
    if (league.groups) url.searchParams.set("groups", league.groups);

    const response = await fetch(url, { headers: { accept: "application/json" } });

    if (!response.ok) {
      throw new Error(`ESPN request failed with status ${response.status}`);
    }

    const games = parseScoreboard(await response.json(), league.id);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");

    return res.status(200).json({ league: league.id, date, games });
  } catch (error) {
    console.error("ESPN scoreboard error:", error);

    return res.status(502).json({ error: "Unable to load the game schedule." });
  }
}
