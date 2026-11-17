import { useEffect, useState } from "react";

import { fetchForecast } from "../../../services/weather/openMeteo";
import { dailyConditions, isSandstone } from "../model/conditions";
import { localDay } from "./format";

const forecastCache = new Map();

/** Daily climbing conditions for a spot, using SkyFox's weather source. */
export function useConditions(lat, lng, path) {
  const key = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(2)},${lng.toFixed(2)}` : null;
  const [state, setState] = useState({ key: null, days: null, error: null });
  const sandstone = isSandstone(path);

  useEffect(() => {
    if (!key) return undefined;
    const ctrl = new AbortController();
    const cached = forecastCache.get(key);
    const run = cached ? Promise.resolve(cached) : fetchForecast({ latitude: lat, longitude: lng }, { signal: ctrl.signal, pastDays: 2 });
    run
      .then(f => {
        forecastCache.set(key, f);
        const today = f.hours.find(h => h.time >= new Date())?.localDay ?? localDay();
        setState({ key, days: dailyConditions(f.hours, { sandstone, today }), error: null });
      })
      .catch(e => {
        if (e.name !== "AbortError") setState({ key, days: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [key, lat, lng, sandstone]);

  if (!key) return { days: null, error: null, loading: false, sandstone };
  const fresh = state.key === key;
  return { days: fresh ? state.days : null, error: fresh ? state.error : null, loading: !fresh, sandstone };
}

