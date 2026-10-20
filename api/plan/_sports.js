import { leaguesById, parseScoreboard } from "../../src/services/watch/parse.js";

// ESPN's public scoreboard feed for a stretch of days (no key needed).
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports";
const MAX_DAYS = 45;

const toDate = key => new Date(Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8)));

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const league = leaguesById.get(req.query.league);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  if (!league) {
    return res.status(400).json({ error: "Unknown league." });
  }

  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to) || to < from) {
    return res.status(400).json({ error: "Dates like from=20261001&to=20261031 are required." });
  }

  if ((toDate(to) - toDate(from)) / 86400000 > MAX_DAYS) {
    return res.status(400).json({ error: `Ask for ${MAX_DAYS} days or fewer.` });
  }

  try {
    const url = new URL(`${ESPN_URL}/${league.path}/scoreboard`);
    url.searchParams.set("dates", `${from}-${to}`);
    url.searchParams.set("limit", "1000");
    if (league.groups) url.searchParams.set("groups", league.groups);

    const response = await fetch(url, { headers: { accept: "application/json" } });

    if (!response.ok) {
      throw new Error(`ESPN request failed with status ${response.status}`);
    }

    const games = parseScoreboard(await response.json(), league.id).map(game => ({
      id: game.id,
      league: game.league,
      name: game.name,
      start: game.start,
      state: game.state,
      detail: game.detail,
      home: { name: game.home.name, short: game.home.short, logo: game.home.logo, score: game.home.score },
      away: { name: game.away.name, short: game.away.short, logo: game.away.logo, score: game.away.score },
      venue: game.venue,
      venueCity: game.venueCity,
      networks: game.networks.filter(n => n.market === "national").map(n => n.name),
    }));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");

    return res.status(200).json({ league: league.id, from, to, games });
  } catch (error) {
    console.error("ESPN schedule error:", error);

    return res.status(502).json({ error: "Unable to load the game schedule." });
  }
}
