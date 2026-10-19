// Browser side of the /api/plan functions. Answers are kept for the visit
// so flipping between months doesn't fetch them again.

const cache = new Map();

async function getJson(path, { signal } = {}) {
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(path, { signal });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON error page (for example, the dev server without functions).
  }
  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong. Try again.");
    error.code = data.code;
    throw error;
  }
  cache.set(path, data);
  return data;
}

const compact = key => key.replaceAll("-", "");

export async function fetchSchedule(league, from, to, options) {
  const data = await getJson(`/api/plan/sports?league=${league}&from=${compact(from)}&to=${compact(to)}`, options);
  return data.games ?? [];
}

export async function fetchMovies(from, to, region, options) {
  const data = await getJson(`/api/plan/movies?from=${from}&to=${to}&region=${region}`, options);
  return data.movies ?? [];
}

export async function fetchGameReleases(from, to, options) {
  const data = await getJson(`/api/plan/games?from=${from}&to=${to}`, options);
  return data.games ?? [];
}

export async function fetchFeed(url, options) {
  return getJson(`/api/plan/feed?url=${encodeURIComponent(url)}`, options);
}

export function forgetFeed(url) {
  cache.delete(`/api/plan/feed?url=${encodeURIComponent(url)}`);
}
