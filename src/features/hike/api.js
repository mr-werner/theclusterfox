// TrailFox's data, all free and keyless, straight from the browser:
//  - Trails, trailheads, peaks, water and viewpoints from OpenStreetMap
//    through the Overpass API (data © OpenStreetMap contributors, ODbL).
//  - Elevation from Open-Meteo's elevation API (Copernicus 90 m DEM).
//  - Forecasts from Open-Meteo, at the trailhead and at the high point.
//  - Place search from Open-Meteo (shared with SkyFox).

import { searchPlaces } from "../../services/weather/openMeteo";
import { bounds, dist, distanceToLine, isLoop, lineLength, locateOnLine, resample, simplifyTo, stitchToOne } from "./model/geo.js";

export { searchPlaces };

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/**
 * Run an Overpass query. Starts with the main server and only asks a
 * mirror if it hasn't answered in a few seconds, so we stay polite.
 */
export async function overpass(query, { signal } = {}) {
  const body = new URLSearchParams({ data: query }).toString();
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop);
  try {
    return await Promise.any(
      OVERPASS.map(async (url, i) => {
        if (i) await new Promise(r => setTimeout(r, i * 5000));
        if (controller.signal.aborted) throw new Error("done");
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status}`);
        return await response.json();
      })
    );
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    throw new Error("The OpenStreetMap trail database is busy. Try again in a minute.", { cause: error });
  } finally {
    signal?.removeEventListener("abort", stop);
    controller.abort();
  }
}

const TRAIL_WAYS = "^(path|footway|track|bridleway)$";
const trailish = /trail|path|loop|walk|ridge|canyon|creek|lake|peak|mountain|falls|summit|pass|route/i;

/**
 * Trails near a point. Hiking routes (OSM relations) come with their
 * mapped length; named paths are grouped by name and joined into lines.
 * Returns [{ ref, name, kind, lat, lon, lengthM, sac, network, line?, away }].
 */
export async function findTrails({ lat, lon }, radiusKm = 12, { signal } = {}) {
  const r = Math.round(radiusKm * 1000);
  const around = `(around:${r},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const query = `[out:json][timeout:25];
(relation["route"~"^(hiking|foot)$"]${around};);
out tags center 80;
(way["highway"~"${TRAIL_WAYS}"]["name"]${around};);
out tags geom 600;`;
  const body = await overpass(query, { signal });
  return parseTrails(body, { lat, lon });
}

export function parseTrails(body, here) {
  const els = Array.isArray(body?.elements) ? body.elements : [];
  const routes = [];
  const groups = new Map();
  for (const e of els) {
    const t = e.tags ?? {};
    if (e.type === "relation" && t.name) {
      const c = e.center;
      if (!c) continue;
      const km = parseFloat(String(t.distance ?? "").replace(",", "."));
      routes.push({
        ref: `relation/${e.id}`,
        name: t.name,
        kind: "route",
        lat: c.lat,
        lon: c.lon,
        lengthM: Number.isFinite(km) ? km * 1000 : null,
        sac: t.sac_scale ?? null,
        network: { iwn: "International", nwn: "National", rwn: "Regional", lwn: "Local" }[t.network] ?? null,
        description: t.description ?? null,
      });
    } else if (e.type === "way" && t.name && Array.isArray(e.geometry)) {
      if (t.highway === "footway" && !trailish.test(t.name) && !t.sac_scale) continue;
      if (t.access === "private" || t.foot === "no") continue;
      const key = t.name.trim().toLowerCase();
      const g = groups.get(key) ?? { name: t.name.trim(), pieces: [], ids: [], sac: null, surface: null };
      g.pieces.push(e.geometry.map(p => [p.lat, p.lon]));
      g.ids.push(e.id);
      g.sac = g.sac ?? t.sac_scale ?? null;
      g.surface = g.surface ?? t.surface ?? null;
      groups.set(key, g);
    }
  }
  const routeNames = new Set(routes.map(r => r.name.trim().toLowerCase()));
  const paths = [];
  for (const [key, g] of groups) {
    if (routeNames.has(key)) continue;
    const line = stitchToOne(g.pieces);
    const lengthM = lineLength(line);
    if (lengthM < 400) continue; // short connectors and sidewalks
    const mid = line[Math.floor(line.length / 2)];
    paths.push({ ref: `way/${g.ids.slice(0, 40).join(",")}`, name: g.name, kind: "path", lat: mid[0], lon: mid[1], lengthM, sac: g.sac, surface: g.surface, line });
  }
  const all = [...routes, ...paths].map(t => {
    const away = t.line ? Math.min(...[t.line[0], t.line[t.line.length - 1], [t.lat, t.lon]].map(p => dist(p, [here.lat, here.lon]))) : dist([t.lat, t.lon], [here.lat, here.lon]);
    return { ...t, away };
  });
  // Routes first (they're the trails people name), then the longer paths.
  return all.sort((a, b) => (a.kind === b.kind ? (a.kind === "route" ? a.away - b.away : (b.lengthM ?? 0) - (a.lengthM ?? 0)) : a.kind === "route" ? -1 : 1)).slice(0, 60);
}

/** A hiking route relation's line and tags. */
async function routeLine(relationId, { signal }) {
  const body = await overpass(`[out:json][timeout:25];relation(${relationId});out tags;way(r);out geom;`, { signal });
  const els = body.elements ?? [];
  const rel = els.find(e => e.type === "relation");
  const pieces = els.filter(e => e.type === "way" && Array.isArray(e.geometry)).map(e => e.geometry.map(p => [p.lat, p.lon]));
  return { line: stitchToOne(pieces), tags: rel?.tags ?? {} };
}

/** Elevations (m) for points, 100 per request. */
export async function fetchElevations(points, { signal } = {}) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const params = new URLSearchParams({ latitude: chunk.map(p => p[0].toFixed(5)).join(","), longitude: chunk.map(p => p[1].toFixed(5)).join(",") });
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, { signal });
    if (!response.ok) throw new Error("Elevation data isn't responding. Try again in a moment.");
    const body = await response.json();
    out.push(...(body.elevation ?? []).map(Number));
  }
  return out;
}

/** An elevation profile [[distanceM, elevationM]] for a line: 100 samples, or 200 for long trails. */
export async function profileFor(line, { signal } = {}) {
  const samples = resample(line, lineLength(line) > 12000 ? 200 : 100);
  const ele = await fetchElevations(samples.map(s => s.p), { signal });
  return samples.map((s, i) => [Math.round(s.d), Math.round(ele[i])]).filter(p => Number.isFinite(p[1]));
}

const POI_KINDS = [
  ["natural", "peak", "peak", 300],
  ["natural", "saddle", "saddle", 150],
  ["tourism", "viewpoint", "viewpoint", 150],
  ["waterway", "waterfall", "waterfall", 200],
  ["natural", "spring", "water", 150],
  ["amenity", "drinking_water", "water", 150],
  ["tourism", "alpine_hut", "hut", 200],
  ["tourism", "wilderness_hut", "hut", 200],
  ["amenity", "shelter", "hut", 150],
  ["tourism", "camp_site", "camp", 200],
  ["amenity", "toilets", "toilets", 150],
  ["highway", "trailhead", "trailhead", 500],
  ["amenity", "parking", "parking", 500],
];

/** Peaks, water, viewpoints and the like along a line, plus the trailhead. */
export async function featuresAlong(line, { signal } = {}) {
  const [s, w, n, e] = bounds(line, 500);
  const bbox = `(${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)})`;
  const parts = POI_KINDS.map(([k, v]) => `nwr["${k}"="${v}"]${bbox};`).join("");
  const body = await overpass(`[out:json][timeout:25];(${parts});out tags center 300;`, { signal });
  return parseFeatures(body, line);
}

export function parseFeatures(body, line) {
  const pois = [];
  for (const el of body?.elements ?? []) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const match = POI_KINDS.find(([k, v]) => t[k] === v);
    if (!match) continue;
    const [, , kind, reach] = match;
    if (kind === "parking" && (t.access === "private" || t.access === "customers")) continue;
    const at = locateOnLine(line, [lat, lon]);
    if (at.off > reach) continue;
    const ele = parseFloat(t.ele);
    pois.push({ id: `${el.type}/${el.id}`, kind, name: t.name ?? "", lat, lon, ele: Number.isFinite(ele) ? ele : null, d: Math.round(at.along), off: Math.round(at.off) });
  }
  return pois.sort((a, b) => a.d - b.d);
}

/** The best trailhead for a line: a mapped trailhead near an end, else parking near an end. */
export function pickTrailhead(line, pois) {
  const ends = [line[0], line[line.length - 1]];
  const near = (p, max) => {
    const d = Math.min(...ends.map(e => dist(e, [p.lat, p.lon])));
    return d <= max ? d : null;
  };
  const score = (p, max) => near(p, max);
  const options = [
    ...pois.filter(p => p.kind === "trailhead").map(p => ({ p, d: score(p, 800) })),
    ...pois.filter(p => p.kind === "parking").map(p => ({ p, d: score(p, 600), extra: 400 })),
  ].filter(o => o.d !== null).sort((a, b) => a.d + (a.extra ?? 0) - (b.d + (b.extra ?? 0)));
  const best = options[0]?.p;
  if (!best) return null;
  return { name: best.name || (best.kind === "parking" ? "Trailhead parking" : "Trailhead"), lat: best.lat, lon: best.lon };
}

/**
 * Everything the trail page needs for a search result: its line (oriented
 * to start at the trailhead), elevation profile, features and trailhead.
 */
export async function loadTrail(item, { signal } = {}) {
  let line = item.line;
  let tags = {};
  if (item.kind === "route") {
    const r = await routeLine(item.ref.split("/")[1], { signal });
    line = r.line;
    tags = r.tags;
  }
  if (!line || line.length < 2) throw new Error("OpenStreetMap doesn't have this trail's line yet.");
  line = simplifyTo(line, 800);
  const [pois, profile] = await Promise.all([featuresAlong(line, { signal }).catch(() => []), profileFor(line, { signal })]);
  const trailhead = pickTrailhead(line, pois);
  return finishTrail({
    id: `osm-${item.kind === "route" ? "r" : "w"}${item.ref.split("/")[1].split(",")[0]}`,
    name: item.name,
    source: "osm",
    ref: item.ref.slice(0, 40),
    line,
    profile,
    sac: tags.sac_scale ?? item.sac ?? null,
    info: {
      description: tags.description ?? item.description ?? "",
      operator: tags.operator ?? "",
      website: /^https?:\/\//.test(tags.website ?? "") ? tags.website : "",
      surface: item.surface ?? "",
      network: item.network ?? "",
      osm: `https://www.openstreetmap.org/${item.kind === "route" ? `relation/${item.ref.split("/")[1]}` : `way/${item.ref.split("/")[1].split(",")[0]}`}`,
    },
    trailhead,
    pois: pois.filter(p => p.kind !== "parking" && p.kind !== "trailhead").slice(0, 60),
  });
}

/**
 * Orient a trail to start from its trailhead, decide its shape and set
 * each feature's distance along it.
 */
export function finishTrail(trail) {
  let { line, profile, pois } = trail;
  const th = trail.trailhead;
  if (th && dist(line[line.length - 1], [th.lat, th.lon]) < dist(line[0], [th.lat, th.lon]) - 50) {
    const total = lineLength(line);
    line = line.slice().reverse();
    profile = profile.slice().reverse().map(([d, e]) => [Math.round(total - d), e]);
    pois = pois.map(p => ({ ...p, d: Math.round(locateOnLine(line, [p.lat, p.lon]).along) })).sort((a, b) => a.d - b.d);
  }
  return { ...trail, line, profile, pois, shape: isLoop(line) ? "loop" : "out-back" };
}

/** A GPX import as a trail (its own elevations if it has them, else looked up). */
export async function trailFromGpx(gpx, { signal } = {}) {
  const raw = gpx.line;
  const line = simplifyTo(raw.map(p => [p[0], p[1]]), 800);
  let profile;
  const withEle = raw.filter(p => Number.isFinite(p[2]));
  if (withEle.length > raw.length * 0.9) {
    const step = Math.max(1, Math.floor(raw.length / 200));
    let d = 0;
    profile = [];
    for (let i = 0; i < raw.length; i++) {
      if (i) d += dist(raw[i - 1], raw[i]);
      if (i % step === 0 || i === raw.length - 1) if (Number.isFinite(raw[i][2])) profile.push([Math.round(d), Math.round(raw[i][2])]);
    }
  } else {
    profile = await profileFor(line, { signal });
  }
  const pois = gpx.waypoints.map((w, i) => ({ id: `wpt/${i}`, kind: "waypoint", name: w.name, lat: w.lat, lon: w.lon, ele: null, d: Math.round(locateOnLine(line, [w.lat, w.lon]).along), off: distanceToLine(line, [w.lat, w.lon]) })).filter(p => p.off < 500);
  return finishTrail({ id: `gpx-${Date.now().toString(36)}`, name: gpx.name, source: "gpx", ref: "", line, profile, sac: null, info: {}, trailhead: null, pois });
}

// ---- Forecast ----

const HOURLY = ["temperature_2m", "apparent_temperature", "precipitation_probability", "precipitation", "weather_code", "wind_speed_10m", "wind_gusts_10m", "uv_index", "cape", "snowfall", "snow_depth", "freezing_level_height"];

/**
 * Forecasts at several points at once (trailhead and high point), each
 * corrected to that point's elevation. Returns [{ hours, days, fetchedAt }].
 */
export async function fetchHikeForecast(points, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(4)).join(","),
    longitude: points.map(p => p.lon.toFixed(4)).join(","),
    elevation: points.map(p => (Number.isFinite(p.ele) ? Math.round(p.ele) : "nan")).join(","),
    hourly: HOURLY.join(","),
    daily: "sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "14",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error("The weather service isn't responding. Try again in a moment.");
  const body = await response.json();
  return (Array.isArray(body) ? body : [body]).map(parseHikeForecast);
}

export function parseHikeForecast(body) {
  const h = body.hourly ?? {};
  const offset = body.utc_offset_seconds ?? 0;
  const hours = (h.time ?? [])
    .map((s, i) => ({
      t: s * 1000,
      local: (s + offset) * 1000,
      temp: h.temperature_2m?.[i],
      apparent: h.apparent_temperature?.[i] ?? h.temperature_2m?.[i],
      precipProb: h.precipitation_probability?.[i] ?? 0,
      precip: h.precipitation?.[i] ?? 0,
      code: h.weather_code?.[i] ?? 0,
      wind: h.wind_speed_10m?.[i] ?? 0,
      gust: h.wind_gusts_10m?.[i] ?? 0,
      uv: h.uv_index?.[i] ?? 0,
      cape: h.cape?.[i] ?? 0,
      snowfall: h.snowfall?.[i] ?? 0,
      snowDepth: h.snow_depth?.[i] ?? 0,
      freezing: h.freezing_level_height?.[i] ?? null,
    }))
    .filter(x => Number.isFinite(x.temp));
  const d = body.daily ?? {};
  const mins = s => {
    if (!Number.isFinite(s)) return null;
    const l = new Date((s + offset) * 1000);
    return l.getUTCHours() * 60 + l.getUTCMinutes();
  };
  const days = (d.time ?? []).map((s, i) => ({
    day: new Date((s + offset) * 1000).toISOString().slice(0, 10),
    sunrise: mins(d.sunrise?.[i]),
    sunset: mins(d.sunset?.[i]),
    high: d.temperature_2m_max?.[i],
    low: d.temperature_2m_min?.[i],
    code: d.weather_code?.[i] ?? 0,
    precipProb: d.precipitation_probability_max?.[i] ?? 0,
  }));
  return { hours, days, timezone: body.timezone ?? null, utcOffset: offset, fetchedAt: new Date().toISOString() };
}
