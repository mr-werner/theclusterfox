// SnowFox's server helpers, under /api/plan/snow so the site keeps its
// function count. Neither source allows browser requests directly.
//
//   /api/plan/snow?kind=lifts&id=vail        live lift status from Liftie
//   /api/plan/snow?kind=snotel&lat=&lon=     the nearest SNOTEL snow sensors
//
// Liftie (https://liftie.info) is an open-source lift-status tracker that
// reads each resort's own status page. SNOTEL is the USDA NRCS network of
// automated snow sites in the western US and Alaska, read through its public
// AWDB REST service.

const LIFTIE = "https://liftie.info/api/resort";
const AWDB = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1";
const HEADERS = { accept: "application/json", "user-agent": "TheClusterFox-SnowFox/1.0" };

let stationCache = null; // { at, list }

export function parseLiftie(body) {
  const status = body?.lifts?.status;
  if (!status || typeof status !== "object") return null;
  const lifts = Object.entries(status)
    .filter(([name, s]) => typeof name === "string" && typeof s === "string")
    .map(([name, s]) => ({ name: name.slice(0, 80), status: ["open", "closed", "hold", "scheduled"].includes(s) ? s : "closed" }));
  const count = k => lifts.filter(l => l.status === k).length;
  return { lifts, open: count("open"), hold: count("hold"), scheduled: count("scheduled"), closed: count("closed") };
}

export function parseStations(list) {
  return (Array.isArray(list) ? list : [])
    .filter(s => s && typeof s.stationTriplet === "string" && Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map(s => ({ id: s.stationTriplet, name: String(s.name ?? s.stationTriplet), lat: s.latitude, lon: s.longitude, elev: Number.isFinite(s.elevation) ? s.elevation : null, endDate: s.endDate ?? null }))
    .filter(s => !s.endDate || s.endDate.startsWith("2100"));
}

/** AWDB daily data -> { [triplet]: { SNWD: [{date, value}], WTEQ: [...], TOBS: [...] } } */
export function parseSnotelData(list) {
  const out = {};
  for (const station of Array.isArray(list) ? list : []) {
    const series = {};
    for (const d of station?.data ?? []) {
      const code = d?.stationElement?.elementCode;
      if (!code) continue;
      series[code] = (d.values ?? []).filter(v => v && typeof v.date === "string" && Number.isFinite(v.value)).map(v => ({ date: v.date.slice(0, 10), value: v.value }));
    }
    if (station?.stationTriplet) out[station.stationTriplet] = series;
  }
  return out;
}

/** What a SNOTEL site says now: depth, water, changes and a week of depths. */
export function summarizeSnotel(series) {
  const depth = series?.SNWD ?? [];
  const swe = series?.WTEQ ?? [];
  const temp = series?.TOBS ?? [];
  const last = a => (a.length ? a[a.length - 1] : null);
  const back = (a, n) => (a.length > n ? a[a.length - 1 - n] : null);
  const change = (a, n) => (last(a) && back(a, n) ? Math.round((last(a).value - back(a, n).value) * 10) / 10 : null);
  return {
    date: last(depth)?.date ?? last(swe)?.date ?? null,
    depthIn: last(depth)?.value ?? null,
    sweIn: last(swe)?.value ?? null,
    tempF: last(temp)?.value ?? null,
    depth24: change(depth, 1),
    depth72: change(depth, 3),
    swe24: change(swe, 1),
    swe72: change(swe, 3),
    week: depth.slice(-8),
  };
}

const km = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = (d - b) * r * Math.cos(((a + c) / 2) * r);
  const y = (c - a) * r;
  return Math.hypot(x, y) * 6371;
};

async function stations() {
  if (stationCache && Date.now() - stationCache.at < 86400000) return stationCache.list;
  const params = new URLSearchParams({ stationTriplets: "*:*:SNTL", returnForecastPointMetadata: "false", returnReservoirMetadata: "false", returnStationElements: "false", activeOnly: "true" });
  const response = await fetch(`${AWDB}/stations?${params}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`AWDB stations ${response.status}`);
  const list = parseStations(await response.json());
  stationCache = { at: Date.now(), list };
  return list;
}

const ymd = d => d.toISOString().slice(0, 10);

export default async function snow(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { kind } = req.query;
  try {
    if (kind === "lifts") {
      const id = String(req.query.id ?? "");
      if (!/^[a-z0-9-]{2,40}$/.test(id)) return res.status(400).json({ error: "A resort id is required." });
      const response = await fetch(`${LIFTIE}/${id}`, { headers: HEADERS });
      if (!response.ok) throw new Error(`Liftie ${response.status}`);
      const lifts = parseLiftie(await response.json());
      if (!lifts) throw new Error("Liftie sent no lift list");
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      return res.status(200).json({ ...lifts, source: "Liftie", checkedAt: new Date().toISOString() });
    }
    if (kind === "snotel") {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).json({ error: "lat and lon are required." });
      const near = (await stations())
        .map(s => ({ ...s, km: km(lat, lon, s.lat, s.lon) }))
        .filter(s => s.km <= 45)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      if (!near.length) {
        res.setHeader("Cache-Control", "s-maxage=86400");
        return res.status(200).json({ sites: [] });
      }
      const end = new Date();
      const begin = new Date(end.getTime() - 9 * 86400000);
      const params = new URLSearchParams({ stationTriplets: near.map(s => s.id).join(","), elements: "SNWD,WTEQ,TOBS", duration: "DAILY", beginDate: ymd(begin), endDate: ymd(end) });
      const response = await fetch(`${AWDB}/data?${params}`, { headers: HEADERS });
      if (!response.ok) throw new Error(`AWDB data ${response.status}`);
      const data = parseSnotelData(await response.json());
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");
      return res.status(200).json({ sites: near.map(s => ({ id: s.id, name: s.name, elev: s.elev, km: Math.round(s.km * 10) / 10, ...summarizeSnotel(data[s.id]) })) });
    }
    return res.status(400).json({ error: "Unknown kind." });
  } catch (error) {
    console.error(`SnowFox ${kind} error:`, error);
    return res.status(502).json({ error: kind === "lifts" ? "Live lift status isn't responding. Check the resort's own page." : "Snow sensor data isn't responding right now." });
  }
}
