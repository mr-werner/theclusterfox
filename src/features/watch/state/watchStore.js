// What WatchFox remembers, kept in this browser.

import { isRegion, leaguesById, LIVE_SERVICES } from "../../../services/watch/parse.js";

export const STORAGE_KEY = "clusterfox:watch-v1";
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
  return {
    ...base,
    region: isRegion(value.region) ? value.region : base.region,
    services,
    live,
    leagues,
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
