// The town for a spot on the map, so "use my location" shows a real name
// ("Golden, Colorado") instead of "My location". BigDataCloud's free
// client-side reverse geocoder needs no key and is meant to be called
// straight from the browser.

const URL_BASE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/** { name, region } for a latitude and longitude, or null when unknown. */
export async function placeName(latitude, longitude, { signal } = {}) {
  const qs = new URLSearchParams({ latitude: latitude.toFixed(4), longitude: longitude.toFixed(4), localityLanguage: "en" });
  try {
    const response = await fetch(`${URL_BASE}?${qs}`, { signal });
    if (!response.ok) return null;
    return parsePlaceName(await response.json());
  } catch {
    return null;
  }
}

export function parsePlaceName(body) {
  if (!body || typeof body !== "object") return null;
  const name = [body.city, body.locality, body.principalSubdivision].find(v => typeof v === "string" && v.trim());
  if (!name) return null;
  const state = typeof body.principalSubdivision === "string" ? body.principalSubdivision : "";
  const region = [state !== name ? state : "", body.countryCode && body.countryCode !== "US" ? body.countryName : ""].filter(Boolean).join(", ");
  return { name: name.trim().slice(0, 80), region: region.slice(0, 80) };
}
