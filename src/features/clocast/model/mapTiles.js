// Web Mercator tile math for the weather map. Plain functions so they can
// be tested in Node.

export const TILE = 256;
const EARTH = 20037508.342789244; // half the Web Mercator world, metres

// Degrees to world pixels at a zoom level.
export function project(latitude, longitude, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

// World pixels back to degrees.
export function unproject(x, y, zoom) {
  const scale = TILE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude: ((((longitude + 180) % 360) + 360) % 360) - 180 };
}

/**
 * The tiles that cover a view. center is in world pixels at `zoom`; tiles
 * are fetched at `tileZoom` (at most `zoom`) and stretched to fit, which
 * lets a source that stops at a lower zoom still fill the map.
 */
export function tilesFor(center, zoom, width, height, tileZoom = zoom) {
  const tz = Math.min(zoom, tileZoom);
  const size = TILE * 2 ** (zoom - tz);
  const count = 2 ** tz;
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const tiles = [];
  for (let ty = Math.floor(top / size); ty <= Math.floor((top + height) / size); ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(left / size); tx <= Math.floor((left + width) / size); tx++) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({ key: `${tz}/${tx}/${ty}`, z: tz, x: wrapped, y: ty, left: tx * size - left, top: ty * size - top, size });
    }
  }
  return tiles;
}

// A tile's bounds in Web Mercator metres, as a WMS BBOX (minx,miny,maxx,maxy).
export function tileBbox(z, x, y) {
  const span = (2 * EARTH) / 2 ** z;
  const minx = -EARTH + x * span;
  const maxy = EARTH - y * span;
  return [minx, maxy - span, minx + span, maxy].map(v => v.toFixed(1)).join(",");
}

// Which geostationary satellite sees a longitude best (GOES-West, GOES-East,
// Himawari). Europe, Africa and western Asia have none in NASA GIBS.
export function satelliteFor(longitude) {
  if (longitude >= -165 && longitude < -105) return "GOES-West_ABI_Band13_Clean_Infrared";
  if (longitude >= -105 && longitude <= -20) return "GOES-East_ABI_Band13_Clean_Infrared";
  if (longitude >= 80 || longitude < -165) return "Himawari_AHI_Band13_Clean_Infrared";
  return null;
}

/**
 * Evenly spaced points across a view for wind arrows, snapped to a fixed
 * grid in world pixels so small drags reuse the same points.
 */
export function windGrid(center, zoom, width, height, spacing = 96) {
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const points = [];
  for (let gy = Math.ceil(top / spacing); gy * spacing < top + height; gy++) {
    for (let gx = Math.ceil(left / spacing); gx * spacing < left + width; gx++) {
      const wx = gx * spacing + spacing / 2;
      const wy = gy * spacing + spacing / 2;
      if (wx > left + width || wy > top + height) continue;
      points.push({ key: `${zoom}/${gx}/${gy}`, left: wx - left, top: wy - top, ...unproject(wx, wy, zoom) });
    }
  }
  return points;
}
