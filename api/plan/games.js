/* global process */
// Upcoming video game releases from RAWG (https://rawg.io/apidocs).
// Needs a free API key in RAWG_API_KEY.

const RAWG_URL = "https://api.rawg.io/api/games";
const MAX_DAYS = 62;
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  if (!isDay(from) || !isDay(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) {
    return res.status(400).json({ error: "Dates like from=2026-10-01&to=2026-10-31 are required." });
  }

  const key = process.env.RAWG_API_KEY?.trim();
  if (!key) {
    return res.status(503).json({ error: "Game releases aren't set up yet: the RAWG API key is missing.", code: "no-key" });
  }

  try {
    const url = new URL(RAWG_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("dates", `${from},${to}`);
    url.searchParams.set("ordering", "-added");
    url.searchParams.set("page_size", "40");

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`RAWG request failed with status ${response.status}`);
    const data = await response.json();

    const games = (data.results ?? [])
      .filter(g => g.released && g.released >= from && g.released <= to)
      .map(g => ({
        id: g.id,
        title: g.name,
        day: g.released,
        image: g.background_image ?? null,
        platforms: (g.parent_platforms ?? []).map(p => p.platform?.name).filter(Boolean),
        url: g.slug ? `https://rawg.io/games/${g.slug}` : null,
      }));

    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");

    return res.status(200).json({ from, to, games });
  } catch (error) {
    console.error("Unable to load game releases.", error);
    return res.status(502).json({ error: "Unable to load game releases." });
  }
}
