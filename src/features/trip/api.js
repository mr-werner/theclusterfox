// TripFox's data, all free and keyless in the browser:
//  - things to do: Wikipedia's map search, OpenStreetMap (Overpass), and
//    Ticketmaster events through TaskFox's /api/plan/events
//  - places to stay: OpenStreetMap, plus booking links with your dates
//  - weather: Open-Meteo forecast, or what's typical for the dates further
//    out (RoadTripFox's weather helper)
//  - drive time and gas: the public OSRM server and EIA prices (RoadTripFox's)
//  - fares: TaskFox's /api/plan/flights (Travelpayouts)
// Each source is asked on its own, so one being down leaves the others.

import { fetchNearby } from "../../services/plan/planApi";
import { fetchGasPrices, fetchRoutes, fetchStayWeather } from "../road/api";
import { staysFromOsm, thingsFromEvents, thingsFromOsm, thingsFromWiki } from "./model/places";

export { fetchStayWeather };

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

// Ask every Overpass mirror at once and take the first good answer.
async function overpass(query, { signal, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop);
  try {
    return await Promise.any(
      OVERPASS.map(async url => {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }).toString(), signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status}`);
        const body = await response.json();
        // A mirror that ran out of time answers 200 with a remark and no elements.
        if (!body.elements?.length && body.remark) throw new Error(body.remark);
        return body;
      })
    );
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    throw new Error("OpenStreetMap is busy right now.", { cause: error });
  } finally {
    clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener("abort", stop);
  }
}

/** Landmarks, museums and parks within about 6 miles, from Wikipedia. */
export async function fetchWikiThings(place, { signal } = {}) {
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggscoord: `${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`,
    ggsradius: "10000",
    ggslimit: "80",
    prop: "coordinates|description|pageimages",
    colimit: "max",
    piprop: "thumbnail",
    pithumbsize: "240",
    pilimit: "max",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${qs}`, { signal });
  if (!response.ok) throw new Error("Wikipedia isn't answering right now.");
  return thingsFromWiki(await response.json(), place);
}

/** Attractions, parks, zoos and museums within about 12 miles, from OpenStreetMap. */
export async function fetchOsmThings(place, { signal } = {}) {
  const around = `(around:20000,${place.lat.toFixed(4)},${place.lon.toFixed(4)})`;
  const query = `[out:json][timeout:25];(
nwr["tourism"~"^(attraction|museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"]${around};
nwr["leisure"~"^(water_park|miniature_golf|amusement_arcade|trampoline_park|nature_reserve|garden)$"]["name"]${around};
nwr["leisure"="park"]["name"]["wikidata"]${around};
nwr["natural"~"^(peak|beach|waterfall|hot_spring)$"]["name"]["wikidata"]${around};
nwr["amenity"~"^(theatre|arts_centre|planetarium)$"]["name"]${around};
nwr["historic"]["name"]["wikidata"]${around};
);out center tags 300;`;
  return thingsFromOsm(await overpass(query, { signal }), place);
}

/** Concerts, games and shows on the trip's dates (needs TaskFox's Ticketmaster key). */
export async function fetchEventThings(place, start, end, { signal } = {}) {
  return thingsFromEvents(await fetchNearby({ latitude: place.lat, longitude: place.lon }, start, end, 30, { signal }));
}

/** Hotels to campgrounds within about 15 miles, from OpenStreetMap. */
export async function fetchStays(place, { signal } = {}) {
  const around = `(around:25000,${place.lat.toFixed(4)},${place.lon.toFixed(4)})`;
  const query = `[out:json][timeout:25];nwr["tourism"~"^(hotel|motel|hostel|guest_house|apartment|chalet|camp_site|caravan_site)$"]["name"]${around};out center tags 400;`;
  return staysFromOsm(await overpass(query, { signal }), place);
}

/** One-way drive from home: { miles, minutes }. */
export async function fetchDrive(home, dest, { signal } = {}) {
  const [route] = await fetchRoutes([home, dest], { signal });
  return { miles: route.miles, minutes: route.minutes };
}

/** This week's U.S. average for regular gas, a number or null. */
export async function fetchGasAverage({ signal } = {}) {
  const body = await fetchGasPrices({ signal });
  const price = body?.gas?.NUS;
  return Number.isFinite(price) ? price : null;
}
