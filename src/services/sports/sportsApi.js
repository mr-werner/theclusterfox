// Browser side of /api/watch/sports for ScoreFox.

async function getJson(path, { signal } = {}) {
  const response = await fetch(path, { signal });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON error page (for example, the dev server without functions).
  }
  if (!response.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export async function fetchSportsDay(league, date, options) {
  const data = await getJson(`/api/watch/sports?league=${league}&date=${date}`, options);
  return data.events ?? data.games ?? [];
}

export async function fetchGameSummary(league, event, options) {
  const data = await getJson(`/api/watch/sports?league=${league}&event=${encodeURIComponent(event)}`, options);
  return data.summary;
}
