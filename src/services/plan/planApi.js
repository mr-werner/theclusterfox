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

export async function fetchSchools(zip, options) {
  const data = await getJson(`/api/plan/schools?zip=${encodeURIComponent(zip)}`, options);
  return data.schools ?? [];
}

export async function fetchNearby(place, from, to, radius, options) {
  const data = await getJson(`/api/plan/events?lat=${place.latitude.toFixed(3)}&lon=${place.longitude.toFixed(3)}&from=${from}&to=${to}&radius=${radius}`, options);
  return data.events ?? [];
}

export async function fetchFares(origin, destination, month, currency, options) {
  const data = await getJson(`/api/plan/flights?from=${origin}&to=${destination}&month=${month}&currency=${currency}`, options);
  return data.fares ?? [];
}

export async function searchAirports(term, options) {
  const data = await getJson(`/api/plan/flights?term=${encodeURIComponent(term)}`, options);
  return data.places ?? [];
}

export async function fetchFeed(url, options) {
  return getJson(`/api/plan/feed?url=${encodeURIComponent(url)}`, options);
}

export function forgetFeed(url) {
  cache.delete(`/api/plan/feed?url=${encodeURIComponent(url)}`);
}
