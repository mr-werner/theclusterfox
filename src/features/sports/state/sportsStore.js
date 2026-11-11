// What ScoreFox remembers, kept in this browser: the leagues you follow and
// the services you have, so it can tell which games you can watch.

import { isRegion, LIVE_SERVICES } from "../../../services/watch/parse.js";
import { sportsLeaguesById } from "../../../services/sports/leagues.js";
import { toggleIn, toggleService } from "../../watch/state/watchStore.js";

export { toggleIn, toggleService };

export const STORAGE_KEY = "clusterfox:sports-v1";
// Sports used to live inside WatchFox. Its picks seed ScoreFox once.
export const WATCH_STORAGE_KEY = "clusterfox:watch-v1";
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
    // Betting lines (spread, total, moneyline) on games that have them.
    showOdds: true,
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
  const leagues = Array.isArray(value.leagues) ? [...new Set(value.leagues.filter(id => sportsLeaguesById.has(id)))] : base.leagues;
  return {
    ...base,
    region: isRegion(value.region) ? value.region : base.region,
    services,
    live,
    leagues,
    showOdds: value.showOdds !== false,
  };
}

const readJson = key => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};

// First visit: carry over the leagues and services picked back when sports
// was a WatchFox tab, so nobody has to set them up again.
export function loadData() {
  const own = readJson(STORAGE_KEY);
  if (own) return normalizeData(own);
  return normalizeData(readJson(WATCH_STORAGE_KEY));
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or full storage: keep working for this visit.
  }
}

// Every service name the viewer picked, for matching sports networks.
export const pickedNames = data => [...data.services.map(s => s.name), ...data.live];
