/* global process */
// Upcoming video game releases from RAWG (https://rawg.io/apidocs).
// Needs a free API key in RAWG_API_KEY.

const RAWG_URL = "https://api.rawg.io/api/games";
const MAX_DAYS = 62;
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** One game's summary, trailer and store links, for the detail pop-up. */
export function parseGame(game, movies, stores) {
  const links = new Map((stores?.results ?? []).map(s => [s.store_id, s.url]));
  const trailer = (movies?.results ?? []).find(m => m.data?.max || m.data?.["480"]);
  return {
    id: game.id,
    title: game.name,
    day: game.released ?? null,
    summary: (game.description_raw ?? "").replace(/\s+\n/g, "\n").trim().slice(0, 1200),
    image: game.background_image ?? null,
    genres: (game.genres ?? []).map(g => g.name).filter(Boolean),
    platforms: (game.parent_platforms ?? []).map(p => p.platform?.name).filter(Boolean),
    developers: (game.developers ?? []).map(d => d.name).filter(Boolean).slice(0, 3),
    rating: game.esrb_rating?.name ?? null,
    metacritic: Number.isFinite(game.metacritic) ? game.metacritic : null,
    website: game.website || null,
    trailer: trailer ? { video: trailer.data.max ?? trailer.data["480"], poster: trailer.preview ?? null, name: trailer.name ?? "Trailer" } : null,
    stores: (game.stores ?? [])
      .map(s => ({ name: s.store?.name, url: links.get(s.store?.id) ?? (s.store?.domain ? `https://${s.store.domain}` : null) }))
      .filter(s => s.name && s.url),
    url: game.slug ? `https://rawg.io/games/${game.slug}` : null,
  };
}

async function gameDetails(res, id, key) {
  const get = async path => {
    const url = new URL(`${RAWG_URL}/${id}${path}`);
    url.searchParams.set("key", key);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw Object.assign(new Error(`RAWG request failed with status ${response.status}`), { status: response.status });
    return response.json();
  };
  try {
    const [game, movies, stores] = await Promise.all([get(""), get("/movies").catch(() => null), get("/stores").catch(() => null)]);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ game: parseGame(game, movies, stores) });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: "That game wasn't found." });
    console.error("Unable to load the game.", error);
    return res.status(502).json({ error: "Unable to load this game." });
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.id !== undefined) {
    const key = process.env.RAWG_API_KEY?.trim();
    if (!key) return res.status(503).json({ error: "Game details aren't set up yet: the RAWG API key is missing.", code: "no-key" });
    if (!/^\d+$/.test(String(req.query.id))) return res.status(400).json({ error: "A game id is required." });
    return gameDetails(res, String(req.query.id), key);
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
