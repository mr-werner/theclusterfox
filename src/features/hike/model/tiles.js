// Map layers and the tiles to save for offline use.
//
// USGS topo is U.S. public domain and may be saved freely. OpenTopoMap and
// OpenStreetMap are run by volunteers: their policies allow a small area
// for personal offline use, so outside the U.S. the download stays under
// 250 tiles at zoom 13 and above (the OpenStreetMap tile policy's limit).

import { project } from "../../clocast/model/mapTiles.js";

export const LAYERS = {
  usgs: {
    id: "usgs",
    name: "Topo",
    maxNative: 16,
    url: (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`,
    credit: { text: "USGS The National Map", href: "https://www.usgs.gov/programs/national-geospatial-program/national-map" },
    usOnly: true,
    offlineCap: 2400,
  },
  otm: {
    id: "otm",
    name: "Trails",
    maxNative: 17,
    url: (z, x, y) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
    credit: { text: "© OpenStreetMap, SRTM · OpenTopoMap (CC-BY-SA)", href: "https://opentopomap.org/about" },
    offlineCap: 600,
    highZoomCap: 250,
  },
  osm: {
    id: "osm",
    name: "Streets",
    maxNative: 19,
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    credit: { text: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
    offlineCap: 600,
    highZoomCap: 250,
  },
};

export const TILE_HOSTS = ["basemap.nationalmap.gov", "tile.opentopomap.org", "tile.openstreetmap.org"];

/** Roughly the lower 48, Alaska and Hawaii: where USGS topo has coverage. */
export function inUS(lat, lon) {
  if (lat >= 24.3 && lat <= 49.5 && lon >= -125 && lon <= -66.8) return true;
  if (lat >= 51 && lat <= 71.6 && lon >= -170 && lon <= -129.9) return true;
  if (lat >= 18.8 && lat <= 22.4 && lon >= -160.4 && lon <= -154.6) return true;
  return false;
}

export const defaultLayer = (lat, lon) => (inUS(lat, lon) ? "usgs" : "otm");

/** Tile coordinates covering [south, west, north, east] at zoom z. */
export function tilesInBox([s, w, n, e], z) {
  const a = project(n, w, z);
  const b = project(s, e, z);
  const out = [];
  const max = 2 ** z - 1;
  for (let x = Math.max(0, Math.floor(a.x / 256)); x <= Math.min(max, Math.floor(b.x / 256)); x++) {
    for (let y = Math.max(0, Math.floor(a.y / 256)); y <= Math.min(max, Math.floor(b.y / 256)); y++) out.push({ z, x, y });
  }
  return out;
}

/**
 * The tiles to save for a box: zoom 10 up to the layer's detail, stopping
 * at the zoom that would go over the layer's limits. Returns
 * { tiles: [{ z, x, y, url }], maxZoom }.
 */
export function offlinePlan(box, layerId, { minZoom = 10, maxZoom = 16 } = {}) {
  const layer = LAYERS[layerId] ?? LAYERS.otm;
  const tiles = [];
  let high = 0;
  let reached = minZoom - 1;
  for (let z = minZoom; z <= Math.min(maxZoom, layer.maxNative); z++) {
    const level = tilesInBox(box, z);
    if (tiles.length + level.length > layer.offlineCap) break;
    if (layer.highZoomCap && z >= 13 && high + level.length > layer.highZoomCap) break;
    if (z >= 13) high += level.length;
    tiles.push(...level);
    reached = z;
  }
  return { tiles: tiles.map(t => ({ ...t, url: layer.url(t.z, t.x, t.y) })), maxZoom: reached };
}
