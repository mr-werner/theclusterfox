// One function for every /api/fly/* endpoint (FlyFox), so the site stays
// within the Vercel plan's function limit. These sources don't allow
// cross-origin requests from a browser, so FlyFox asks through here.
//
//   /api/fly/metar?ids=KDEN,KAPA | ?bbox=minLat,minLon,maxLat,maxLon
//   /api/fly/taf?ids=KDEN
//   /api/fly/airport?ids=KAPA
//   /api/fly/stations?bbox=...            weather-reporting airports in a box
//   /api/fly/hazards                      G-AIRMETs and SIGMETs (US)
//   /api/fly/traffic?lat=&lon=&dist=nm | ?callsign= | ?reg= | ?hex=
//
// Weather is from the NOAA Aviation Weather Center (aviationweather.gov),
// public and keyless. Live aircraft are from adsb.lol, a free, open
// community ADS-B network.

import { parseAirports, parseHazards, parseMetars, parseStations, parseTafs, parseTraffic } from "./_parse.js";

const AWC = "https://aviationweather.gov/api/data";
const ADSB = "https://api.adsb.lol/v2";
const HEADERS = { accept: "application/json", "user-agent": "TheClusterFox-FlyFox/1.0" };

const cleanIds = raw =>
  String(raw ?? "")
    .toUpperCase()
    .split(/[\s,]+/)
    .filter(id => /^[A-Z0-9]{3,4}$/.test(id))
    .slice(0, 60);

function cleanBbox(raw) {
  const parts = String(raw ?? "").split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [a, b, c, d] = parts;
  if (Math.abs(a) > 90 || Math.abs(c) > 90 || Math.abs(b) > 180 || Math.abs(d) > 180) return null;
  // Keep a box to about the size of a few states.
  if (Math.abs(c - a) > 12 || Math.abs(d - b) > 16) return null;
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)].map(v => v.toFixed(3)).join(",");
}

async function awc(path, params) {
  const response = await fetch(`${AWC}/${path}?${new URLSearchParams({ ...params, format: "json" })}`, { headers: HEADERS });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`aviationweather.gov ${path} failed with status ${response.status}`);
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : [];
}

function send(res, maxAge, body) {
  res.setHeader("Cache-Control", `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);
  return res.status(200).json(body);
}

const ROUTES = {
  async metar(req, res) {
    const ids = cleanIds(req.query.ids);
    const bbox = cleanBbox(req.query.bbox);
    if (!ids.length && !bbox) return res.status(400).json({ error: "Airport ids or a bbox are required." });
    const list = await awc("metar", ids.length ? { ids: ids.join(","), hours: "2" } : { bbox, hours: "2" });
    // Newest report per airport.
    const seen = new Set();
    const latest = parseMetars(list)
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
      .filter(m => (seen.has(m.id) ? false : seen.add(m.id)));
    return send(res, 300, { metars: latest });
  },
  async taf(req, res) {
    const ids = cleanIds(req.query.ids);
    if (!ids.length) return res.status(400).json({ error: "Airport ids are required." });
    return send(res, 900, { tafs: parseTafs(await awc("taf", { ids: ids.join(",") })) });
  },
  async airport(req, res) {
    const ids = cleanIds(req.query.ids);
    if (!ids.length) return res.status(400).json({ error: "Airport ids are required." });
    return send(res, 86400, { airports: parseAirports(await awc("airport", { ids: ids.join(",") })) });
  },
  async stations(req, res) {
    const bbox = cleanBbox(req.query.bbox);
    if (!bbox) return res.status(400).json({ error: "A bbox of minLat,minLon,maxLat,maxLon is required." });
    return send(res, 86400, { stations: parseStations(await awc("stationinfo", { bbox })) });
  },
  async hazards(req, res) {
    const [g, s] = await Promise.all([awc("gairmet", {}).catch(() => []), awc("airsigmet", {}).catch(() => [])]);
    return send(res, 600, { hazards: parseHazards(g, s) });
  },
  async traffic(req, res) {
    const { lat, lon, dist, callsign, reg, hex } = req.query;
    let path;
    if (callsign && /^[A-Z0-9]{2,8}$/i.test(callsign)) path = `callsign/${callsign.toUpperCase()}`;
    else if (reg && /^[A-Z0-9-]{2,10}$/i.test(reg)) path = `reg/${reg.toUpperCase()}`;
    else if (hex && /^[0-9a-f]{6}$/i.test(hex)) path = `hex/${hex.toLowerCase()}`;
    else {
      const la = Number(lat);
      const lo = Number(lon);
      const d = Math.max(5, Math.min(100, Number(dist) || 40));
      if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
        return res.status(400).json({ error: "A place (lat, lon) or a callsign, registration or hex code is required." });
      }
      path = `lat/${la.toFixed(3)}/lon/${lo.toFixed(3)}/dist/${Math.round(d)}`;
    }
    const response = await fetch(`${ADSB}/${path}`, { headers: HEADERS });
    if (!response.ok) throw new Error(`adsb.lol failed with status ${response.status}`);
    const body = await response.json();
    return send(res, 5, { now: body.now ?? Date.now(), aircraft: parseTraffic(body).slice(0, 250) });
  },
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  try {
    return await route(req, res);
  } catch (error) {
    console.error(`FlyFox ${req.query.route} error:`, error);
    const live = req.query.route === "traffic";
    return res.status(502).json({ error: live ? "Live flight data isn't responding. Try again in a moment." : "Aviation weather isn't responding. Try again in a moment." });
  }
}
