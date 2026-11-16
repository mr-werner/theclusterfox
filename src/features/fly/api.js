// FlyFox's data: aviation weather and live traffic through /api/fly (those
// sources don't allow browser requests), plus Open-Meteo place search and
// OpenStreetMap flight-school lookups straight from the browser.

import { searchPlaces } from "../../services/weather/openMeteo";

async function get(path, params, { signal } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  let response;
  try {
    response = await fetch(`/api/fly/${path}?${qs}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach FlyFox's data service. Check your connection.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Aviation data isn't responding. Try again in a moment.");
  return body;
}

const box = b => b.map(v => v.toFixed(3)).join(",");

export const fetchMetars = (ids, opts) => get("metar", { ids: ids.join(",") }, opts).then(b => b.metars);
export const fetchMetarsInBox = (bbox, opts) => get("metar", { bbox: box(bbox) }, opts).then(b => b.metars);
export const fetchTafs = (ids, opts) => get("taf", { ids: ids.join(",") }, opts).then(b => b.tafs);
export const fetchAirports = (ids, opts) => get("airport", { ids: ids.join(",") }, opts).then(b => b.airports);
export const fetchStations = (bbox, opts) => get("stations", { bbox: box(bbox) }, opts).then(b => b.stations);
export const fetchHazards = opts => get("hazards", {}, opts).then(b => b.hazards);
export const fetchTraffic = (query, opts) => get("traffic", query, opts);

/** Airport ids to try for what someone typed: "den" -> KDEN, "1V6" stays. */
export function idCandidates(text) {
  const t = text.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(t)) return [];
  if (t.length === 3 && /^[A-Z]{3}$/.test(t)) return [`K${t}`, `P${t}`, t];
  return [t];
}

/**
 * Airports matching a code or a place name. A code is looked up directly;
 * a name is found as a place, then the airports with weather reports near it.
 * Each result: { id, name, lat, lon, elevFt, magVar?, distNm? }.
 */
export async function searchAirports(text, { signal } = {}) {
  const q = text.trim();
  if (q.length < 2) return [];
  const ids = idCandidates(q);
  const found = [];
  if (ids.length) {
    const airports = await fetchAirports(ids, { signal }).catch(() => []);
    found.push(...airports);
    if (found.length) return found.slice(0, 1).concat(await nearby(found[0], signal, found[0].id));
  }
  const places = await searchPlaces(q, { signal }).catch(() => []);
  if (!places.length) return found;
  const p = places[0];
  const near = await nearby({ lat: p.latitude, lon: p.longitude }, signal);
  return [...found, ...near];
}

async function nearby(center, signal, skip) {
  const d = 0.7;
  const stations = await fetchStations([center.lat - d, center.lon - d, center.lat + d, center.lon + d], { signal }).catch(() => []);
  const k = Math.cos((center.lat * Math.PI) / 180);
  return stations
    .filter(s => s.id !== skip)
    .map(s => ({ ...s, distNm: Math.hypot(s.lat - center.lat, (s.lon - center.lon) * k) * 60 }))
    .sort((a, b) => a.distNm - b.distNm)
    .slice(0, 8);
}

const OVERPASS = "https://overpass-api.de/api/interpreter";

/**
 * Flight schools and flying clubs mapped in OpenStreetMap within radiusKm
 * of a point. Coverage depends on local mappers, so it's a start, not a
 * complete list: [{ id, name, lat, lon, website, phone, kind }].
 */
export async function fetchFlightSchools({ lat, lon }, radiusKm = 80, { signal } = {}) {
  const r = Math.round(radiusKm * 1000);
  const around = `(around:${r},${lat.toFixed(4)},${lon.toFixed(4)})`;
  const query = `[out:json][timeout:25];(
    nwr["amenity"="flight_school"]${around};
    nwr["school"="flight"]${around};
    nwr["club"="aviation"]${around};
    nwr["club"="flying"]${around};
    nwr["name"~"flight (school|training|academy|center|centre)|aviation (academy|training)|flying club|aero club|aeroclub",i]${around};
  );out center tags 80;`;
  let response;
  try {
    response = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: query }), signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach the OpenStreetMap school directory right now. The links below still work.");
  }
  if (!response.ok) throw new Error("The map database is busy. Try again in a minute.");
  const body = await response.json();
  const seen = new Set();
  return (body.elements ?? [])
    .map(e => ({
      id: `${e.type}/${e.id}`,
      name: e.tags?.name,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
      website: e.tags?.website ?? e.tags?.["contact:website"] ?? null,
      phone: e.tags?.phone ?? e.tags?.["contact:phone"] ?? null,
      kind: /club/i.test(`${e.tags?.club ?? ""} ${e.tags?.name ?? ""}`) ? "Flying club" : "Flight school",
    }))
    .filter(s => s.name && Number.isFinite(s.lat) && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()));
}

export { searchPlaces };
