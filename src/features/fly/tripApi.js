// PilotFox trip data, all free and called from the browser: runway details
// through /api/fly, the forecast along the route from Open-Meteo, the
// latest radar picture from RainViewer, and things to do near an airport
// from Wikipedia and OpenStreetMap (Overpass).

import { fetchAirports } from "./api";
import { mergePlaces, parseRouteHours, placesFromOverpass, placesFromWikipedia } from "./model/trip.js";

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

// Ask every Overpass mirror at once and take the first good answer, so one
// busy server doesn't leave the list empty.
async function overpass(query, { signal, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop);
  try {
    return await Promise.any(
      OVERPASS.map(async url => {
        const response = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
    );
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    throw new Error("The map database (OpenStreetMap) is busy. Try again in a minute.", { cause: error });
  } finally {
    clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener("abort", stop);
  }
}

/** Airport details (runways, fuel, tower) for many ids, 60 at a time. Missing ones are left out. */
export async function fetchAirportDetails(ids, { signal } = {}) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
  const lists = await Promise.all(chunks.map(c => fetchAirports(c, { signal }).catch(e => (e.name === "AbortError" ? Promise.reject(e) : []))));
  return lists.flat();
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ROUTE_HOURLY = ["precipitation", "precipitation_probability", "weather_code", "cloud_cover_low", "cloud_cover", "visibility", "wind_gusts_10m", "cape", "freezing_level_height", "temperature_2m"];

/**
 * The hourly forecast at many points along a route (Open-Meteo takes a list
 * of places in one request), from now until `hours` ahead.
 * points: [{ lat, lon }]; returns the points with .hours added.
 */
export async function fetchRouteForecast(points, hours, { signal } = {}) {
  const out = [];
  for (let i = 0; i < points.length; i += 60) {
    const batch = points.slice(i, i + 60);
    const params = new URLSearchParams({
      latitude: batch.map(p => p.lat.toFixed(2)).join(","),
      longitude: batch.map(p => p.lon.toFixed(2)).join(","),
      hourly: ROUTE_HOURLY.join(","),
      wind_speed_unit: "ms",
      timeformat: "unixtime",
      timezone: "GMT",
      forecast_hours: String(Math.max(2, Math.min(384, Math.ceil(hours)))),
      past_hours: "1",
    });
    let response;
    try {
      response = await fetch(`${FORECAST_URL}?${params}`, { signal });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error("Couldn't reach the forecast service. Check your connection.", { cause: error });
    }
    if (!response.ok) throw new Error(response.status === 429 ? "The forecast service is busy. Try again in a minute." : "The forecast service isn't responding. Try again in a moment.");
    const body = await response.json();
    const list = Array.isArray(body) ? body : [body];
    batch.forEach((p, k) => out.push({ ...p, hours: parseRouteHours(list[k]) }));
  }
  return out;
}

const RADAR_URL = "https://api.rainviewer.com/public/weather-maps.json";

/** The latest radar picture from RainViewer: { url(tile), time (ms) }. Tiles stop at zoom 7. */
export async function fetchRadar({ signal } = {}) {
  const response = await fetch(RADAR_URL, { signal });
  if (!response.ok) throw new Error("Radar isn't available right now.");
  const body = await response.json();
  const past = body.radar?.past ?? [];
  const last = past[past.length - 1];
  if (!last) throw new Error("Radar isn't available right now.");
  return { time: last.time * 1000, url: t => `${body.host}${last.path}/256/${t.z}/${t.x}/${t.y}/2/1_1.png` };
}

const WIKI = "https://en.wikipedia.org/w/api.php";

/**
 * Things to do near an airport: notable places from Wikipedia (sights,
 * parks, museums, towns) within 10 km, plus food a short walk or cab ride
 * from the field and attractions from OpenStreetMap. Either source can be
 * down; this returns whatever came back, and throws only if both failed.
 */
export async function fetchThingsToDo(airport, { signal } = {}) {
  const from = { lat: airport.lat, lon: airport.lon };
  const wiki = (async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "geosearch",
      ggscoord: `${from.lat}|${from.lon}`,
      ggsradius: "10000",
      ggslimit: "40",
      prop: "coordinates|description|pageimages|info",
      inprop: "url",
      piprop: "thumbnail",
      pithumbsize: "160",
    });
    const response = await fetch(`${WIKI}?${params}`, { signal });
    if (!response.ok) throw new Error(String(response.status));
    return placesFromWikipedia(await response.json(), from, { skipName: airport.name });
  })();
  const near = `(around:3000,${from.lat.toFixed(4)},${from.lon.toFixed(4)})`;
  const wide = `(around:12000,${from.lat.toFixed(4)},${from.lon.toFixed(4)})`;
  const osm = overpass(
    `[out:json][timeout:20];(
      nwr["amenity"~"^(restaurant|cafe|fast_food|pub|ice_cream)$"]["name"]${near};
      nwr["tourism"~"^(museum|attraction|viewpoint|zoo|aquarium|theme_park|gallery)$"]["name"]${wide};
      nwr["leisure"~"^(park|nature_reserve|water_park)$"]["name"]${wide};
      nwr["tourism"~"^(hotel|motel)$"]["name"]${near};
    );out center tags 80;`,
    { signal }
  ).then(body => placesFromOverpass(body, from));
  const [w, o] = await Promise.allSettled([wiki, osm]);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (w.status === "rejected" && o.status === "rejected") throw new Error("Couldn't look up places near this airport right now. The links below still work.");
  return { places: mergePlaces([w.value ?? [], o.value ?? []]), partial: w.status === "rejected" || o.status === "rejected" };
}
