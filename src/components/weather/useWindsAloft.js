// Fetches winds aloft for a place and refetches when the place changes.
// status: "idle" | "loading" | "ready" | "error"; at is when it arrived.
import { useEffect, useState } from "react";

import { fetchWindsAloft } from "../../services/weather/windsAloft";

const placeKey = place => (place ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null);

/** Fetches winds aloft for a place, refetching when the place changes. */
export function useWindsAloft(place, { hours = 36 } = {}) {
  const key = placeKey(place);
  const [state, setState] = useState({ key: null, status: "idle", data: null, error: "", at: 0 });
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    const [latitude, longitude] = key.split(",").map(Number);
    fetchWindsAloft({ latitude, longitude }, { signal: controller.signal, hours })
      .then(data => setState({ key, status: "ready", data, error: "", at: Date.now() }))
      .catch(error => {
        if (error.name === "AbortError") return;
        setState({ key, status: "error", data: null, at: 0, error: error instanceof TypeError ? "Couldn't reach the weather service. Check your connection." : error.message });
      });
    return () => controller.abort();
  }, [key, hours, reloads]);
  const current = state.key === key ? state : { key, status: key ? "loading" : "idle", data: null, error: "", at: 0 };
  return { ...current, reload: () => setReloads(n => n + 1) };
}

