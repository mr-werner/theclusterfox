// Live shelf prices for the compared stores that have them (Kroger-family
// stores, through the site's Kroger API endpoint, the same one CookFox uses),
// and which optional features the site has keys for.
import { useEffect, useMemo, useRef, useState } from "react";

export async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "That didn't work. Try again in a moment.");
  return body;
}

export function usePrices(place, stores, items) {
  const [features, setFeatures] = useState({});
  const [live, setLive] = useState({}); // storeId -> term -> products
  const asked = useRef(new Set());

  const at = place ? `${place.lat.toFixed(3)},${place.lon.toFixed(3)}` : null;
  useEffect(() => {
    if (!at) return undefined;
    const [lat, lon] = at.split(",");
    const controller = new AbortController();
    getJson(`/api/cook/stores?lat=${lat}&lon=${lon}&radius=1`, { signal: controller.signal })
      .then(body => setFeatures(body.features ?? {}))
      .catch(() => {});
    return () => controller.abort();
  }, [at]);

  const terms = useMemo(() => [...new Set(items.map(i => i.term))], [items]);
  const livePrices = Boolean(features.livePrices);
  useEffect(() => {
    if (!livePrices) return;
    for (const s of stores) {
      if (!s.krogerId) continue;
      const missing = terms.filter(t => !asked.current.has(`${s.id}|${t}`)).slice(0, 40);
      if (!missing.length) continue;
      for (const t of missing) asked.current.add(`${s.id}|${t}`);
      const fill = results => setLive(l => ({ ...l, [s.id]: { ...l[s.id], ...Object.fromEntries(missing.map(t => [t, results?.[t] ?? []])) } }));
      getJson(`/api/cook/prices?store=${encodeURIComponent(s.krogerId)}&terms=${encodeURIComponent(missing.join("|"))}`)
        .then(body => fill(body.results))
        .catch(() => fill({}));
    }
  }, [livePrices, stores, terms]);

  const waitingFor = s => livePrices && Boolean(s.krogerId) && terms.some(t => !live[s.id]?.[t]);
  return { features, live, waitingFor };
}
