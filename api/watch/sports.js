import { sportsLeaguesById } from "../../src/services/sports/leagues.js";
import { parseEspnScoreboard, parseSummary, parseTsdbEvents } from "../../src/services/sports/parse.js";

// ESPN's public site API (no key) for most sports, and TheSportsDB's free
// API for the ones ESPN doesn't carry (boxing, skiing, biathlon...).
//   ?league=nfl&date=20261108   the day's events for one league
//   ?league=nfl&event=401873038 one game's box score, leaders, line and standings
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports";
const TSDB_URL = "https://www.thesportsdb.com/api/v1/json/123";

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

async function loadDay(league, date) {
  if (league.source === "tsdb") {
    const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    return parseTsdbEvents(await getJson(`${TSDB_URL}/eventsday.php?d=${day}&l=${league.tsdb}`), league);
  }
  const url = new URL(`${ESPN_URL}/${league.path}/scoreboard`);
  url.searchParams.set("dates", date);
  url.searchParams.set("limit", "300");
  if (league.groups) url.searchParams.set("groups", league.groups);
  return parseEspnScoreboard(await getJson(url), league, date);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const league = sportsLeaguesById.get(req.query.league);
  if (!league) {
    return res.status(400).json({ error: "Unknown league." });
  }

  const event = String(req.query.event ?? "");
  if (event) {
    if (league.source !== "espn" || league.kind !== "match" || !/^\d{1,15}$/.test(event)) {
      return res.status(400).json({ error: "Game details are only available for team games." });
    }
    try {
      const summary = parseSummary(await getJson(`${ESPN_URL}/${league.path}/summary?event=${event}`));
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
      return res.status(200).json({ league: league.id, event, summary });
    } catch (error) {
      console.error("ESPN summary error:", error);
      return res.status(502).json({ error: "Unable to load this game." });
    }
  }

  const date = String(req.query.date ?? "");
  if (!/^\d{8}$/.test(date)) {
    return res.status(400).json({ error: "A date like 20261019 is required." });
  }

  try {
    const events = await loadDay(league, date);
    // TheSportsDB's free tier is rate limited, so its answers are kept longer.
    res.setHeader("Cache-Control", league.source === "tsdb" ? "s-maxage=3600, stale-while-revalidate=21600" : "s-maxage=300, stale-while-revalidate=900");
    // `games` is the older name, kept for anything that still reads it.
    return res.status(200).json({ league: league.id, date, events, games: events });
  } catch (error) {
    console.error("Sports schedule error:", error);
    return res.status(502).json({ error: "Unable to load the schedule." });
  }
}
