// Browser side of the /api/watch functions.

async function getJson(path, { signal } = {}) {
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

  return data;
}

export async function fetchProviders(region, options) {
  const data = await getJson(`/api/watch/providers?region=${region}`, options);
  return data.providers ?? [];
}

export async function searchTitles(query, region, options) {
  const data = await getJson(`/api/watch/search?q=${encodeURIComponent(query.trim())}&region=${region}`, options);
  return data.results ?? [];
}

export async function fetchGames(league, date, options) {
  const data = await getJson(`/api/watch/sports?league=${league}&date=${date}`, options);
  return data.games ?? [];
}

export async function browseTitles(list, region, { providers = [], page = 1, genre = "", signal } = {}) {
  const params = new URLSearchParams({ list, region, page: String(page) });
  if (providers.length) params.set("providers", providers.join(","));
  if (genre) params.set("genre", genre);
  const data = await getJson(`/api/watch/browse?${params}`, { signal });
  return data.results ?? [];
}

export async function fetchTitle(type, id, region, options) {
  const data = await getJson(`/api/watch/title?type=${type}&id=${id}&region=${region}`, options);
  return data.title;
}

export async function recommendTitles(favorites, options) {
  const items = favorites.map(f => `${f.type}:${f.id}`).join(",");
  const data = await getJson(`/api/watch/recommend?items=${items}`, options);
  return data.results ?? [];
}

// Never throws: direct links are a bonus on top of the regular ones.
export async function fetchDirectLinks(type, id, region, options) {
  try {
    const data = await getJson(`/api/watch/links?type=${type}&id=${id}&region=${region}`, options);
    return data.links ?? [];
  } catch {
    return [];
  }
}
