// Drop zones and wind tunnels mapped in OpenStreetMap near a point, to fill
// in places JumpFox doesn't list yet. Coverage depends on local mappers.
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** [{ id, name, lat, lon, website }] within radiusKm. kind: "dz" or "tunnel". */
export async function fetchMappedPlaces({ lat, lon }, kind = "dz", radiusKm = 160) {
  const around = `(around:${Math.round(radiusKm * 1000)},${lat.toFixed(4)},${lon.toFixed(4)})`;
  const query =
    kind === "tunnel"
      ? `[out:json][timeout:25];(nwr["name"~"iFLY|indoor skydiv|wind tunnel|skyventure",i]${around};nwr["sport"="indoor_skydiving"]${around};);out center tags 60;`
      : `[out:json][timeout:25];(nwr["sport"="skydiving"]${around};nwr["sport"="parachuting"]${around};nwr["name"~"skydiv|parachut|drop ?zone",i]["name"!~"iFLY|indoor",i]${around};);out center tags 60;`;
  let response;
  try {
    response = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: query }) });
  } catch {
    throw new Error("Couldn't reach OpenStreetMap right now.");
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
      website: /^https?:\/\//.test(e.tags?.website ?? e.tags?.["contact:website"] ?? "") ? (e.tags.website ?? e.tags["contact:website"]) : null,
    }))
    .filter(p => p.name && Number.isFinite(p.lat) && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()));
}
