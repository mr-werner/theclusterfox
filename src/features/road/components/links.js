import { Footprints, Gauge, Landmark, Mountain, Shuffle, UtensilsCrossed } from "lucide-react";

export const THEME_ICONS = { fastest: Gauge, alt: Shuffle, scenic: Mountain, food: UtensilsCrossed, history: Landmark, outdoors: Footprints };

/** Google Maps turn-by-turn for a trip (it takes up to nine stops in between). */
export function directionsUrl(from, to, stops = []) {
  const ll = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  const qs = new URLSearchParams({ api: "1", origin: ll(from), destination: ll(to), travelmode: "driving" });
  if (stops.length) qs.set("waypoints", stops.slice(0, 9).map(ll).join("|"));
  return `https://www.google.com/maps/dir/?${qs}`;
}

export const placeUrl = p => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
