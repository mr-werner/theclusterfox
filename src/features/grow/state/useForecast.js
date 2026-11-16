import { useEffect, useState } from "react";
import { fetchLowForecast } from "../../../services/garden/climateApi";

// The next 7 days of highs, lows and rain for your place, fetched once per
// place per hour and shared by every card that asks.
const cache = new Map(); // key -> { at, promise }
const TTL = 60 * 60 * 1000;

function load(place) {
  const key = `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = fetchLowForecast(place).catch(error => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** [{ day, high, low, rain }] (°C, mm), or null while loading or without a place. */
export function useForecast(place) {
  const [state, setState] = useState({ key: null, days: null });
  const key = place ? `${place.latitude},${place.longitude}` : null;
  useEffect(() => {
    if (!place) return undefined;
    let live = true;
    load(place)
      .then(days => live && setState({ key: `${place.latitude},${place.longitude}`, days }))
      .catch(() => live && setState({ key: `${place.latitude},${place.longitude}`, days: null }));
    return () => {
      live = false;
    };
  }, [place]);
  return state.key === key ? state.days : null;
}
