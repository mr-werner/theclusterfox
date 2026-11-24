// SnowFox's data. Every source here is free and keyless:
//   Open-Meteo        mountain weather at the base and top elevations, snowfall, snow depth
//   avalanche.org     US avalanche center danger ratings (map layer)
//   Avalanche Canada  Canadian avalanche forecasts by point
//   NWS               watches and warnings (US)
//   OSRM              driving route and normal drive time (no live traffic)
//   OpenStreetMap     ski runs and lifts for the trail map (Overpass API)
//   /api/plan/snow    live lift status (Liftie) and SNOTEL snow sensors, which
//                     don't allow browser requests

import { searchPlaces } from "../../services/weather/openMeteo.js";
import { M_PER_FT, canadaLevel, inGeometry } from "./model/snow.js";
import { parseLiftie } from "../../../api/plan/_snow.js";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "weather_code",
  "snowfall",
  "rain",
  "snow_depth",
  "freezing_level_height",
  "cloud_cover",
  "visibility",
  "precipitation_probability",
];

async function json(url, init, failText) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(failText, { cause: error });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || failText);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(failText, { cause: error });
  }
}

function parseHours(body) {
  const h = body.hourly ?? {};
  const offset = body.utc_offset_seconds ?? 0;
  return (h.time ?? [])
    .map((s, i) => {
      const local = new Date((s + offset) * 1000);
      return {
        time: new Date(s * 1000),
        localDay: local.toISOString().slice(0, 10),
        localHour: local.getUTCHours(),
        temp: h.temperature_2m?.[i],
        feels: h.apparent_temperature?.[i] ?? h.temperature_2m?.[i],
        wind: h.wind_speed_10m?.[i] ?? null,
        gust: h.wind_gusts_10m?.[i] ?? null,
        dir: h.wind_direction_10m?.[i] ?? null,
        code: h.weather_code?.[i] ?? 0,
        snow: h.snowfall?.[i] ?? 0,
        rain: h.rain?.[i] ?? 0,
        depth: h.snow_depth?.[i] ?? null,
        freeze: h.freezing_level_height?.[i] ?? null,
        cloud: h.cloud_cover?.[i] ?? null,
        vis: h.visibility?.[i] ?? null,
        pop: h.precipitation_probability?.[i] ?? null,
      };
    })
    .filter(x => Number.isFinite(x.temp));
}

/**
 * Hourly weather at the base and the top of a mountain (elevations in feet),
 * three days back and ten ahead: { base: hours[], summit: hours[], timezone }.
 */
export async function fetchMountain({ lat, lon, base, summit }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: `${lat.toFixed(4)},${lat.toFixed(4)}`,
    longitude: `${lon.toFixed(4)},${lon.toFixed(4)}`,
    elevation: `${Math.round(base * M_PER_FT)},${Math.round(summit * M_PER_FT)}`,
    hourly: HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone: "auto",
    timeformat: "unixtime",
    past_days: "3",
    forecast_days: "10",
  });
  const body = await json(`${FORECAST}?${params}`, { signal }, "The mountain forecast isn't responding. Try again in a moment.");
  const [b, s] = Array.isArray(body) ? body : [body, body];
  return { fetchedAt: Date.now(), base: parseHours(b), summit: parseHours(s), timezone: s.timezone, gridElevFt: Number.isFinite(s.elevation) ? s.elevation / M_PER_FT : null };
}

/** One spot (backcountry) at one elevation: hours[]. */
export async function fetchSpot({ lat, lon, elev }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    elevation: String(Math.round(elev * M_PER_FT)),
    hourly: HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone: "auto",
    timeformat: "unixtime",
    past_days: "3",
    forecast_days: "7",
  });
  return parseHours(await json(`${FORECAST}?${params}`, { signal }, "The forecast isn't responding. Try again in a moment."));
}

/**
 * Snow at the top of many mountains at once, for the list:
 * [{ past48, next7, days: [{ day, snow }], high, low, gust, code }], snow in cm.
 */
export async function fetchSummaries(spots, { signal } = {}) {
  if (!spots.length) return [];
  const out = [];
  for (let i = 0; i < spots.length; i += 40) {
    const chunk = spots.slice(i, i + 40);
    const params = new URLSearchParams({
      latitude: chunk.map(s => s.lat.toFixed(3)).join(","),
      longitude: chunk.map(s => s.lon.toFixed(3)).join(","),
      elevation: chunk.map(s => Math.round((s.summit ?? s.elev) * M_PER_FT)).join(","),
      daily: "snowfall_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max,weather_code",
      wind_speed_unit: "ms",
      timezone: "auto",
      past_days: "2",
      forecast_days: "7",
    });
    const body = await json(`${FORECAST}?${params}`, { signal }, "Snow totals aren't responding. Try again in a moment.");
    const list = Array.isArray(body) ? body : [body];
    for (const item of list) {
      const d = item.daily ?? {};
      const snow = d.snowfall_sum ?? [];
      const days = (d.time ?? []).map((day, k) => ({ day, snow: snow[k] ?? 0, code: d.weather_code?.[k] ?? 0 }));
      out.push({
        past48: (snow[0] ?? 0) + (snow[1] ?? 0),
        next7: snow.slice(2).reduce((s, v) => s + (v ?? 0), 0),
        days: days.slice(2),
        high: d.temperature_2m_max?.[2] ?? null,
        low: d.temperature_2m_min?.[2] ?? null,
        gust: d.wind_gusts_10m_max?.[2] ?? null,
        code: d.weather_code?.[2] ?? 0,
      });
    }
  }
  return out;
}

// ---- Avalanche ----

let avyLayer = null; // Promise of the US map layer

/** Every US avalanche forecast zone with today's danger (GeoJSON features). */
// Shared by every caller, so it isn't tied to one caller's abort signal.
export function fetchAvalancheZones() {
  if (!avyLayer) {
    avyLayer = json("https://api.avalanche.org/v2/public/products/map-layer", {}, "Avalanche forecasts aren't responding right now.")
      .then(body => body.features ?? [])
      .catch(error => {
        avyLayer = null;
        throw error;
      });
  }
  return avyLayer;
}

const stripHtml = s =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * The avalanche forecast for a point:
 * { center, zone, level, danger, advice, link, offSeason, bands?: [{ name, level, label }] } or null.
 */
export async function fetchAvalanche({ lat, lon, country }, { signal } = {}) {
  if (country === "CA") {
    const body = await json(`https://api.avalanche.ca/forecasts/en/products/point?lat=${lat.toFixed(4)}&long=${lon.toFixed(4)}`, { signal }, "Avalanche Canada isn't responding right now.");
    const r = body?.report;
    if (!r) return null;
    const today = r.dangerRatings?.[0];
    const bands = today
      ? ["alp", "tln", "btl"].map(k => ({ name: today.ratings?.[k]?.display ?? k, level: canadaLevel(today.ratings?.[k]?.rating?.value), label: today.ratings?.[k]?.rating?.display ?? "No rating" }))
      : [];
    const level = bands.length ? Math.max(...bands.map(b => b.level)) : -1;
    return {
      center: "Avalanche Canada",
      zone: r.title?.length > 60 ? "Your area" : r.title,
      level,
      advice: stripHtml(r.highlights) || stripHtml(r.summaries?.[0]?.content),
      link: body.url ?? "https://avalanche.ca/",
      offSeason: bands.every(b => b.level < 1),
      bands,
    };
  }
  const zones = await fetchAvalancheZones();
  const hit = zones.find(f => inGeometry(lat, lon, f.geometry));
  if (!hit) return null;
  const p = hit.properties ?? {};
  return {
    center: p.center,
    centerId: p.center_id,
    zone: p.name && !/zone$/i.test(p.name) ? p.name : null,
    level: Number.isFinite(p.danger_level) ? p.danger_level : -1,
    advice: stripHtml(p.travel_advice),
    link: p.link || p.center_link,
    offSeason: p.off_season === true,
    warning: p.warning?.product ? stripHtml(p.warning.product) : null,
  };
}

// ---- NWS alerts ----

/** Active NWS watches and warnings at a point (US only). */
export async function fetchAlerts({ lat, lon }, { signal } = {}) {
  const body = await json(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { signal }, "Weather alerts aren't responding.");
  return (body.features ?? []).map(f => {
    const p = f.properties ?? {};
    return { id: p.id ?? f.id, event: p.event, headline: p.headline, severity: p.severity, description: p.description, instruction: p.instruction, ends: p.ends ?? p.expires };
  });
}

// ---- Driving ----

/** The usual driving route (no live traffic): { km, minutes, coords: [[lon, lat]...] }. */
export async function fetchDrive(from, to, { signal } = {}) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}?overview=simplified&geometries=geojson`;
  const body = await json(url, { signal }, "The route service isn't responding. Try again in a moment.");
  const r = body.routes?.[0];
  if (!r) throw new Error("No driving route found between those places.");
  return { km: r.distance / 1000, minutes: r.duration / 60, coords: r.geometry?.coordinates ?? [] };
}

/** Hourly snow, rain and temperature at points along a drive (ground level). */
export async function fetchRoadPoints(points, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(3)).join(","),
    longitude: points.map(p => p.lon.toFixed(3)).join(","),
    hourly: "temperature_2m,snowfall,rain,weather_code",
    timeformat: "unixtime",
    forecast_days: "3",
  });
  const body = await json(`${FORECAST}?${params}`, { signal }, "Road weather isn't responding.");
  const list = Array.isArray(body) ? body : [body];
  return list.map(item => {
    const h = item.hourly ?? {};
    return (h.time ?? []).map((s, i) => ({ time: new Date(s * 1000), temp: h.temperature_2m?.[i], snow: h.snowfall?.[i] ?? 0, rain: h.rain?.[i] ?? 0, code: h.weather_code?.[i] ?? 0, elev: item.elevation }));
  });
}

// ---- Trail map from OpenStreetMap ----

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const mapCache = new Map();

/** Runs and lifts mapped in OpenStreetMap around a ski area. */
export async function fetchTrailMap({ lat, lon, id }, { signal } = {}) {
  if (mapCache.has(id)) return mapCache.get(id);
  const dLat = 0.045;
  const dLon = 0.06;
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => v.toFixed(4)).join(",");
  const query = `[out:json][timeout:25];(way["piste:type"="downhill"](${bbox});way["aerialway"](${bbox}););out geom tags;`;
  let body = null;
  for (const url of OVERPASS) {
    try {
      const response = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal });
      if (response.ok) {
        body = await response.json();
        break;
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
    }
  }
  if (!body) throw new Error("The OpenStreetMap trail data is busy. Try again in a minute.");
  const map = parseTrailMap(body);
  mapCache.set(id, map);
  return map;
}

const LIFT_TYPES = new Set(["chair_lift", "gondola", "cable_car", "mixed_lift", "drag_lift", "t-bar", "j-bar", "platter", "rope_tow", "magic_carpet", "zip_line"]);

export function parseTrailMap(body) {
  const runs = [];
  const lifts = [];
  for (const e of body.elements ?? []) {
    const t = e.tags ?? {};
    const coords = (e.geometry ?? []).map(g => [g.lon, g.lat]);
    if (coords.length < 2) continue;
    if (t.aerialway && LIFT_TYPES.has(t.aerialway)) {
      if (t.aerialway === "zip_line") continue;
      lifts.push({ id: e.id, name: t.name ?? null, type: t.aerialway, coords, seats: Number(t["aerialway:occupancy"]) || null });
    } else if (t["piste:type"] === "downhill") {
      runs.push({ id: e.id, name: t["piste:name"] ?? t.name ?? null, diff: t["piste:difficulty"] ?? "unknown", coords, area: coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1], groomed: t["piste:grooming"] ?? null });
    }
  }
  return { runs, lifts };
}

// ---- SnowFox's server helpers ----

async function server(params, { signal } = {}) {
  return json(`/api/plan/snow?${new URLSearchParams(params)}`, { signal }, "SnowFox's data service isn't responding.");
}

// Liftie sometimes turns away server requests, so if ours fails, ask it
// straight from the browser before giving up.
export async function fetchLifts(liftieId, opts = {}) {
  try {
    return await server({ kind: "lifts", id: liftieId }, opts);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    const body = await json(`https://liftie.info/api/resort/${encodeURIComponent(liftieId)}`, { signal: opts.signal }, error.message).catch(e => {
      if (e.name === "AbortError") throw e;
      throw error;
    });
    const lifts = parseLiftie(body);
    if (!lifts) throw error;
    return { ...lifts, source: "Liftie" };
  }
}
export const fetchSnotel = ({ lat, lon }, opts) => server({ kind: "snotel", lat: lat.toFixed(4), lon: lon.toFixed(4) }, opts).then(b => b.sites ?? []);

export { searchPlaces };
