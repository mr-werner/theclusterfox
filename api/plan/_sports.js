import { leaguesById, parseScoreboard } from "../../src/services/watch/parse.js";

// ESPN's public scoreboard feed for a stretch of days (no key needed).
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports";
const MAX_DAYS = 45;

const toDate = key => new Date(Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8)));
const toKey = date => date.toISOString().slice(0, 10).replaceAll("-", "");

/**
 * What to ask ESPN for. ESPN no longer accepts a range like
 * 20261101-20261130 (it answers 400), but a whole month (202611) works and
 * returns every game for the pro leagues. College feeds only return 25 games
 * per answer, so those are asked for one day at a time.
 */
export function scoreboardDates(from, to, { daily = false } = {}) {
  const out = [];
  if (daily) {
    for (let d = toDate(from); toKey(d) <= to; d = new Date(d.getTime() + 86400000)) out.push(toKey(d));
    return out;
  }
  for (let d = toDate(from.slice(0, 6) + "01"); toKey(d).slice(0, 6) <= to.slice(0, 6); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    out.push(toKey(d).slice(0, 6));
  }
  return out;
}

async function fetchScoreboard(league, dates) {
  const url = new URL(`${ESPN_URL}/${league.path}/scoreboard`);
  url.searchParams.set("dates", dates);
  url.searchParams.set("limit", "1000");
  if (league.groups) url.searchParams.set("groups", league.groups);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`ESPN request failed with status ${response.status}`);
  return (await response.json()).events ?? [];
}

/** Every game in [from, to] (YYYYMMDD), one copy each. */
async function loadEvents(league, from, to) {
  const asks = scoreboardDates(from, to, { daily: Boolean(league.groups) });
  const lists = [];
  // A few at a time, so a 45-day college range doesn't fire 45 at once.
  for (let i = 0; i < asks.length; i += 8) {
    const batch = await Promise.allSettled(asks.slice(i, i + 8).map(d => fetchScoreboard(league, d)));
    lists.push(...batch);
  }
  if (lists.every(r => r.status === "rejected")) throw lists[0].reason;
  // Keep games that start within the range, allowing a day either side so
  // late games still land on the right local evening.
  const start = toDate(from).getTime() - 86400000;
  const end = toDate(to).getTime() + 2 * 86400000;
  const seen = new Map();
  for (const r of lists) {
    if (r.status !== "fulfilled") continue;
    for (const e of r.value) {
      const t = Date.parse(e.date);
      if (Number.isFinite(t) && t >= start && t < end && !seen.has(e.id)) seen.set(e.id, e);
    }
  }
  return [...seen.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

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
    const events = await loadEvents(league, from, to);
    const games = parseScoreboard({ events }, league.id).map(game => ({
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
