// RoadTripFox's data, all free:
//  - places: Open-Meteo geocoding (keyless)
//  - routes: the public OSRM server (keyless, fair use)
//  - stops, gas stations, chargers, towns: OpenStreetMap through Overpass
//    (keyless; the browser asks directly through src/lib/osm/overpass.js)
//  - gas prices: U.S. EIA weekly averages, and DC fast chargers: NREL,
//    both through /api/road (free keys; DEMO_KEY works for light use)
//  - weather at each night's stop and where you stay: Open-Meteo forecast
//    and its archive for what's typical further out (keyless)

import { searchPlaces } from "../../services/weather/openMeteo";
import { osrmPath, parseOsrm, placesFromOsm } from "./model/route.js";
import { overpassAlong } from "./data/themes.js";
import { stationsFromOsm } from "./model/fuel.js";
import { overpass } from "../../lib/osm/overpass.js";
import { parseForecastDays, shiftYears, typicalDays } from "./model/packing.js";

const OSRM = "https://router.project-osrm.org";

export async function findPlaces(text, opts) {
  const list = await searchPlaces(text, opts);
  return list.map(p => ({ id: p.id, name: p.name, region: p.region, lat: p.latitude, lon: p.longitude }));
}

let lastOsrm = 0;
/** Driving routes through `points`. The public server asks for about one request a second. */
export async function fetchRoutes(points, { alternatives = false, signal } = {}) {
  const wait = lastOsrm + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastOsrm = Date.now();
  let response;
  try {
    response = await fetch(`${OSRM}${osrmPath(points, { alternatives })}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach the route service. Check your connection.", { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  if (body.code === "NoRoute") throw new Error("There's no road route between those places.");
  if (!response.ok) throw new Error(response.status === 429 ? "The route service is busy. Try again in a few seconds." : "The route service isn't responding. Try again in a moment.");
  const routes = parseOsrm(body);
  if (!routes.length) throw new Error("No route found between those places.");
  return routes;
}

/** Things to do near a route (sampled points with .lat/.lon). */
export async function fetchPlacesAlong(samples, opts) {
  return placesFromOsm(await overpass(overpassAlong(samples), opts));
}

/**
 * Gas stations, chargers and towns near given stretches. windows is
 * [{ kind: "fuel" | "ev" | "town", points: [{lat, lon}], meters }].
 */
export async function fetchServices(windows, opts) {
  if (!windows.length) return [];
  const filter = { fuel: '["amenity"="fuel"]', ev: '["amenity"="charging_station"]', town: '["place"~"^(city|town)$"]["name"]' };
  const parts = windows.map(w => {
    const line = w.points.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(",");
    return `${w.kind === "town" ? "node" : "nwr"}(around:${Math.round(w.meters)},${line})${filter[w.kind]};`;
  });
  return stationsFromOsm(await overpass(`[out:json][timeout:40];(${parts.join("")});out center tags 900;`, opts));
}

async function api(path, init) {
  let response;
  try {
    response = await fetch(`/api/road/${path}`, init);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach RoadTripFox's data service.", { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "RoadTripFox's data service isn't responding.");
  return body;
}

/** { week, gas: { area: $ }, diesel: { area: $ } } from EIA. */
export const fetchGasPrices = opts => api("gas", opts);

/** DC fast chargers within `miles` of a line ([[lat, lon]]) from NREL. */
export const fetchChargers = (line, plug, { signal } = {}) =>
  api("ev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line, plug, miles: 2 }), signal }).then(b => b.stations);

/** Daily forecast for several spots at once: [{ days: { "YYYY-MM-DD": { hi, lo, code, rain } } }]. */
export async function fetchDailyWeather(points, { signal } = {}) {
  if (!points.length) return [];
  const qs = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(3)).join(","),
    longitude: points.map(p => p.lon.toFixed(3)).join(","),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    forecast_days: "16",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`, { signal });
  if (!response.ok) throw new Error("Weather isn't responding.");
  const body = await response.json();
  const list = Array.isArray(body) ? body : [body];
  return list.map(b => {
    const d = b.daily ?? {};
    const days = {};
    (d.time ?? []).forEach((t, i) => {
      days[t] = { hi: d.temperature_2m_max?.[i], lo: d.temperature_2m_min?.[i], code: d.weather_code?.[i], rain: d.precipitation_probability_max?.[i] };
    });
    return { days };
  });
}

const stayWeather = new Map();

/**
 * Weather for one stay: { "YYYY-MM-DD": { hi, lo, rain, snow, code } }.
 * source "forecast" asks for the forecast; "typical" averages the same dates
 * over the last three years. Answers are kept for the visit.
 */
export function fetchStayWeather(place, dates, source, { signal } = {}) {
  if (!dates.length) return Promise.resolve({});
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}|${dates[0]}|${dates.length}|${source}`;
  if (!stayWeather.has(key)) {
    const job = (source === "forecast" ? forecastFor(place, dates) : typicalFor(place, dates)).catch(error => {
      stayWeather.delete(key);
      throw error;
    });
    stayWeather.set(key, job);
  }
  const job = stayWeather.get(key);
  if (!signal) return job;
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    job.then(resolve, reject);
  });
}

async function openMeteo(base, qs) {
  let response;
  try {
    response = await fetch(`${base}?${new URLSearchParams(qs)}`);
  } catch (error) {
    throw new Error("Couldn't reach the weather service. Check your connection.", { cause: error });
  }
  if (!response.ok) throw new Error("The weather service isn't responding. Try again in a moment.");
  return response.json();
}

async function forecastFor(place, dates) {
  const body = await openMeteo("https://api.open-meteo.com/v1/forecast", {
    latitude: place.lat.toFixed(3),
    longitude: place.lon.toFixed(3),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    start_date: dates[0],
    end_date: dates[dates.length - 1],
  });
  return parseForecastDays(body);
}

async function typicalFor(place, dates) {
  const years = [1, 2, 3];
  const bodies = await Promise.all(
    years.map(n =>
      openMeteo("https://archive-api.open-meteo.com/v1/archive", {
        latitude: place.lat.toFixed(3),
        longitude: place.lon.toFixed(3),
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum",
        temperature_unit: "fahrenheit",
        timezone: "auto",
        start_date: shiftYears(dates[0], n),
        end_date: shiftYears(dates[dates.length - 1], n),
      }).catch(() => null)
    )
  );
  const got = bodies.filter(Boolean);
  if (!got.length) throw new Error("The weather service isn't responding. Try again in a moment.");
  return typicalDays(got, dates);
}
