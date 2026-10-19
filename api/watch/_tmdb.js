/* global process */
// Shared by the /api/watch functions. Files starting with "_" are not
// deployed as functions of their own.

const TMDB_URL = "https://api.themoviedb.org/3";

export class MissingKeyError extends Error {}

// Accepts either a v3 API key or a v4 read access token (starts with "eyJ").
export async function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY?.trim();

  if (!key) {
    throw new MissingKeyError("TMDB API key is not configured.");
  }

  const url = new URL(`${TMDB_URL}${path}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));

  const headers = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}`);
  }

  return response.json();
}

export function sendError(res, error, fallback) {
  if (error instanceof MissingKeyError) {
    return res.status(503).json({ error: "Show search isn't set up yet: the TMDB API key is missing.", code: "no-key" });
  }

  console.error(fallback, error);
  return res.status(502).json({ error: fallback });
}
