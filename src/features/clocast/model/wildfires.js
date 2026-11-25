// Active wildfires in the US, from the National Interagency Fire Center's
// WFIGS "current incidents" feed (public, keyless, open to browsers). Each one
// is a named fire with its size and containment, which is what most people
// mean by a fire map. Satellite heat spots on the map fill in the rest of the
// world but can't tell a wildfire from a farm burn.

const WFIGS =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query";
const STALE_DAYS = 30;

let cache = null; // { at, promise }

/** WFIGS JSON -> [{ id, name, lat, lon, acres, contained, discovered, updated }], biggest first. */
export function parseWildfires(body, now = Date.now()) {
  const out = [];
  for (const f of body?.features ?? []) {
    const a = f?.attributes ?? {};
    const lat = f?.geometry?.y;
    const lon = f?.geometry?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const contained = Number.isFinite(a.PercentContained) ? a.PercentContained : null;
    if (contained !== null && contained >= 100) continue;
    const updated = Number.isFinite(a.ModifiedOnDateTime_dt) ? a.ModifiedOnDateTime_dt : null;
    if (updated !== null && now - updated > STALE_DAYS * 86400000) continue;
    // Small fires with no containment report that started weeks ago are
    // usually records nobody closed, not fires still burning.
    const discovered = Number.isFinite(a.FireDiscoveryDateTime) ? a.FireDiscoveryDateTime : null;
    const acres = Number.isFinite(a.IncidentSize) ? a.IncidentSize : null;
    if (contained === null && (acres ?? 0) < 10 && discovered !== null && now - discovered > STALE_DAYS * 86400000) continue;
    const name = String(a.IncidentName ?? "").trim();
    out.push({
      id: String(a.OBJECTID ?? `${lat},${lon}`),
      name: name ? name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "Unnamed fire",
      lat,
      lon,
      acres,
      contained,
      discovered,
      updated,
    });
  }
  return out.sort((x, y) => (y.acres ?? 0) - (x.acres ?? 0));
}

/** Every active US wildfire, shared for ten minutes. */
export function fetchWildfires() {
  if (cache && Date.now() - cache.at < 600000) return cache.promise;
  const params = new URLSearchParams({
    where: "IncidentTypeCategory='WF' AND (PercentContained IS NULL OR PercentContained < 100)",
    outFields: "OBJECTID,IncidentName,IncidentSize,PercentContained,FireDiscoveryDateTime,ModifiedOnDateTime_dt",
    outSR: "4326",
    orderByFields: "IncidentSize DESC",
    resultRecordCount: "2000",
    f: "json",
  });
  const promise = fetch(`${WFIGS}?${params}`)
    .then(response => (response.ok ? response.json() : Promise.reject(new Error("wildfires"))))
    .then(body => {
      if (body?.error) throw new Error("wildfires");
      return parseWildfires(body);
    })
    .catch(error => {
      cache = null;
      throw error;
    });
  cache = { at: Date.now(), promise };
  return promise;
}

/** "12,400 acres", "Under an acre". */
export function acresText(acres) {
  if (!Number.isFinite(acres)) return "Size not reported";
  if (acres < 1) return "Under an acre";
  return `${Math.round(acres).toLocaleString("en-US")} acres`;
}
