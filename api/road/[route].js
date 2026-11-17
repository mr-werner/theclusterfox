// One function for every /api/road/* endpoint (RoadFox), so the site stays
// within the Vercel plan's function limit.
//
//   /api/road/gas                 latest weekly average gas and diesel prices
//                                 by state/region (U.S. EIA)
//   /api/road/ev   (POST)         DC fast chargers along a route (NREL AFDC)
//                  body: { line: [[lat, lon], ...], miles: 2, plug: "ccs" }
//
// Both are free U.S. government data. They work with the shared DEMO_KEY,
// which allows only a few dozen requests an hour; set EIA_API_KEY and
// NREL_API_KEY (free sign-ups at eia.gov/opendata and developer.nrel.gov)
// for real traffic. Gas answers are cached at the edge for hours, so EIA
// sees very few requests either way.

import { parseNrelStation } from "../../src/features/road/model/fuel.js";

const EIA = "https://api.eia.gov/v2/petroleum/pri/gnd/data/";
const NREL = "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearby-route.json";
const PLUG = { ccs: "J1772COMBO", nacs: "TESLA", chademo: "CHADEMO" };

function send(res, maxAge, body) {
  res.setHeader("Cache-Control", `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);
  return res.status(200).json(body);
}

/** EIA rows -> { week, gas: { area: price }, diesel: { area: price } } using each area's newest week. */
export function parseEia(rows) {
  const out = { week: null, gas: {}, diesel: {} };
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const kind = r.product === "EPMR" ? "gas" : r.product === "EPD2D" ? "diesel" : null;
    const price = Number(r.value);
    if (!kind || !Number.isFinite(price) || !r.duoarea) continue;
    const key = `${kind}|${r.duoarea}`;
    if (seen.has(key)) continue; // rows come newest first
    seen.add(key);
    out[kind][r.duoarea] = price;
    if (!out.week || r.period > out.week) out.week = r.period;
  }
  return out;
}

const ROUTES = {
  async gas(req, res) {
    const qs = new URLSearchParams({ api_key: process.env.EIA_API_KEY || "DEMO_KEY", frequency: "weekly", "data[0]": "value", "sort[0][column]": "period", "sort[0][direction]": "desc", length: "200" });
    qs.append("facets[product][]", "EPMR");
    qs.append("facets[product][]", "EPD2D");
    qs.set("start", new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10));
    const response = await fetch(`${EIA}?${qs}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`EIA failed with status ${response.status}`);
    const body = await response.json();
    return send(res, 6 * 3600, parseEia(body?.response?.data));
  },
  async ev(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    const line = (Array.isArray(body.line) ? body.line : []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180).slice(0, 400);
    if (line.length < 2) return res.status(400).json({ error: "A route of at least two points is required." });
    const form = new URLSearchParams({
      api_key: process.env.NREL_API_KEY || "DEMO_KEY",
      route: `LINESTRING(${line.map(([la, lo]) => `${lo.toFixed(4)} ${la.toFixed(4)}`).join(", ")})`,
      distance: String(Math.max(0.5, Math.min(5, Number(body.miles) || 2))),
      fuel_type: "ELEC",
      ev_charging_level: "dc_fast",
      status: "E",
      access: "public",
      limit: "all",
    });
    if (PLUG[body.plug]) form.set("ev_connector_type", PLUG[body.plug]);
    const response = await fetch(NREL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" }, body: form });
    if (!response.ok) throw new Error(`NREL failed with status ${response.status}`);
    const data = await response.json();
    const stations = (data.fuel_stations ?? []).map(parseNrelStation).filter(Boolean).slice(0, 600);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ stations });
  },
};

export default async function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    return await route(req, res);
  } catch (error) {
    console.error(`RoadFox ${req.query.route} error:`, error);
    return res.status(502).json({ error: req.query.route === "gas" ? "Gas prices aren't responding right now." : "The charger map isn't responding right now." });
  }
}
