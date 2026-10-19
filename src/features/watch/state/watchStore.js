// What WatchFox remembers, kept in this browser.

import { isRegion, leaguesById, LIVE_SERVICES } from "../../../services/watch/parse.js";

export const STORAGE_KEY = "clusterfox:watch-v1";
export const MAX_FAVORITES = 200;
export const DEFAULT_LEAGUES = ["nfl", "cfb", "nba", "mlb", "nhl"];

export function emptyData() {
  return {
    version: 1,
    region: "US",
    // Streaming services from TMDB: { id, name, logo }
    services: [],
    // Live TV and sports services by label (see LIVE_SERVICES).
    live: [],
    leagues: DEFAULT_LEAGUES,
    // Saved titles, newest first: { id, type, title, year, poster }
    favorites: [],
    showRatings: true,
  };
}

const liveLabels = new Set(LIVE_SERVICES.map(s => s.label));

export function normalizeData(value) {
  const base = emptyData();
  if (!value || typeof value !== "object") return base;
  const services = Array.isArray(value.services)
    ? value.services
        .filter(s => s && Number.isInteger(s.id) && typeof s.name === "string")
        .map(s => ({ id: s.id, name: s.name.slice(0, 80), logo: typeof s.logo === "string" ? s.logo : null }))
        .slice(0, 60)
    : [];
  const live = Array.isArray(value.live) ? [...new Set(value.live.filter(l => liveLabels.has(l)))] : [];
  const leagues = Array.isArray(value.leagues) ? [...new Set(value.leagues.filter(id => leaguesById.has(id)))] : base.leagues;
  const favorites = Array.isArray(value.favorites)
    ? value.favorites
        .filter(f => f && Number.isInteger(f.id) && (f.type === "movie" || f.type === "tv") && typeof f.title === "string")
        .map(f => ({
          id: f.id,
          type: f.type,
          title: f.title.slice(0, 200),
          year: typeof f.year === "string" ? f.year.slice(0, 4) : "",
          poster: typeof f.poster === "string" ? f.poster : null,
        }))
        .slice(0, MAX_FAVORITES)
    : [];
  return {
    ...base,
    region: isRegion(value.region) ? value.region : base.region,
    services,
    live,
    leagues,
    favorites,
    showRatings: value.showRatings !== false,
  };
}

export function loadData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or full storage: keep working for this visit.
  }
}

export function toggleService(data, provider) {
  const has = data.services.some(s => s.id === provider.id);
  return {
    ...data,
    services: has
      ? data.services.filter(s => s.id !== provider.id)
      : [...data.services, { id: provider.id, name: provider.name, logo: provider.logo ?? null }],
  };
}

export const toggleIn = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

// Every service name the viewer picked, for matching sports networks.
export const pickedNames = data => [...data.services.map(s => s.name), ...data.live];

export const isFavorite = (data, item) => data.favorites.some(f => f.id === item.id && f.type === item.type);

export function toggleFavorite(data, item) {
  if (isFavorite(data, item)) {
    return { ...data, favorites: data.favorites.filter(f => !(f.id === item.id && f.type === item.type)) };
  }
  const saved = { id: item.id, type: item.type, title: item.title, year: item.year ?? "", poster: item.poster ?? null };
  return { ...data, favorites: [saved, ...data.favorites].slice(0, MAX_FAVORITES) };
}
