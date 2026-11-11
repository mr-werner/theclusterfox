// A sun map of your yard: how many hours of direct sun each patch of ground
// gets, with your house, trees, fences and sheds casting real shadows for
// your exact latitude and the time of year. Plain functions, testable in Node.
//
// Coordinates are meters with x to the east and y to the north, the house
// centered at (0, 0). For every patch and every 15 minutes of the day, a ray
// runs from the ground toward the sun; it is blocked if it passes under the
// top of something in the way. Sun position comes from model/sun.js.
// Leafy trees let some light through (dappled shade), so a deciduous canopy
// blocks 85% of the sun in the growing season and evergreens block all of it.

import { sunPosition, declination, lightFor } from "./sun.js";

const RAD = Math.PI / 180;
export const EXTENT = 16; // meters from the house center to the map edge
export const CELL = 0.8; // meters per map patch
const STEP = 0.25; // hours between sun samples
const MIN_ALT = 10; // degrees: lower sun is weak and usually blocked by neighbors and trees beyond the map

export const OBJECT_KINDS = {
  tree: { name: "Leafy tree", leaf: "deciduous", h: 9, r: 3.5 },
  evergreen: { name: "Evergreen", leaf: "evergreen", h: 10, r: 2.5 },
  fence: { name: "Fence or wall", h: 1.8, len: 10, angle: 0 },
  shed: { name: "Shed or garage", h: 2.8, w: 3, d: 3, angle: 0 },
  // Extra blocks that make the house an L, T or U: an attached garage, an addition, a porch.
  wing: { name: "House wing", h: 4, w: 6, d: 6, angle: 0 },
};

export function defaultYard() {
  return { facing: 180, width: 12, depth: 9, height: 6, objects: [] };
}

// Representative days for each season, by hemisphere.
export const SEASONS = {
  season: { name: "Growing season", days: n => (n ? [110, 141, 172, 203, 234] : [293, 324, 355, 20, 51]) },
  summer: { name: "Midsummer", days: n => (n ? [172] : [355]) },
  equinox: { name: "Spring & fall", days: n => (n ? [79, 265] : [265, 79]) },
  winter: { name: "Midwinter", days: n => (n ? [355] : [172]) },
};

/** Day length in hours for a latitude and day of year (sun center at the horizon). */
export function dayLength(latitude, doy) {
  const phi = latitude * RAD;
  const dec = declination(doy) * RAD;
  const cos = -Math.tan(phi) * Math.tan(dec);
  if (cos <= -1) return 24;
  if (cos >= 1) return 0;
  return (2 * Math.acos(cos)) / (15 * RAD);
}

// The house turns so its front faces `facing` (compass degrees). A box is
// { cx, cy, w (along the front), d (front to back), angle (deg, the front's
// compass direction), h }.
function boxes(yard) {
  const list = [{ cx: 0, cy: 0, w: yard.width, d: yard.depth, angle: yard.facing, h: yard.height, house: true }];
  for (const o of yard.objects) if (o.kind === "shed" || o.kind === "wing") list.push({ cx: o.x, cy: o.y, w: o.w, d: o.d, angle: o.angle, h: o.h });
  return list;
}

// Local axes of a box: u points out of the front, v to the front's right.
function axes(angle) {
  const a = angle * RAD;
  return { ux: Math.sin(a), uy: Math.cos(a), vx: Math.cos(a), vy: -Math.sin(a) };
}

export function boxCorners(b) {
  const { ux, uy, vx, vy } = axes(b.angle);
  const hd = b.d / 2;
  const hw = b.w / 2;
  return [
    [hd, -hw],
    [hd, hw],
    [-hd, hw],
    [-hd, -hw],
  ].map(([u, v]) => [b.cx + u * ux + v * vx, b.cy + u * uy + v * vy]);
}

export function fenceEnds(o) {
  const a = o.angle * RAD;
  const dx = (Math.sin(a) * o.len) / 2;
  const dy = (Math.cos(a) * o.len) / 2;
  return [
    [o.x - dx, o.y - dy],
    [o.x + dx, o.y + dy],
  ];
}

function insideBox(b, px, py) {
  const { ux, uy, vx, vy } = axes(b.angle);
  const rx = px - b.cx;
  const ry = py - b.cy;
  return Math.abs(rx * ux + ry * uy) <= b.d / 2 && Math.abs(rx * vx + ry * vy) <= b.w / 2;
}

// Distance along a horizontal ray to where it enters a box, or null.
function rayBox(b, px, py, dx, dy) {
  const { ux, uy, vx, vy } = axes(b.angle);
  const rx = px - b.cx;
  const ry = py - b.cy;
  const o = [rx * ux + ry * uy, rx * vx + ry * vy];
  const d = [dx * ux + dy * uy, dx * vx + dy * vy];
  const half = [b.d / 2, b.w / 2];
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (Math.abs(o[i]) > half[i]) return null;
    } else {
      let a = (-half[i] - o[i]) / d[i];
      let c = (half[i] - o[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

function raySegment(px, py, dx, dy, [ax, ay], [bx, by]) {
  const ex = bx - ax;
  const ey = by - ay;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((ax - px) * ey - (ay - py) * ex) / den;
  const s = ((ax - px) * dy - (ay - py) * dx) / den;
  return t >= 0 && s >= 0 && s <= 1 ? t : null;
}

// How much of the sun a tree's canopy blocks along a ray (0..1).
function rayTree(o, px, py, dx, dy, tanAlt) {
  const ox = o.x - px;
  const oy = o.y - py;
  const along = ox * dx + oy * dy;
  const miss2 = ox * ox + oy * oy - along * along;
  if (miss2 > o.r * o.r) return 0;
  const half = Math.sqrt(o.r * o.r - miss2);
  const far = along + half;
  if (far <= 0) return 0; // the crown is behind us
  const near = Math.max(0, along - half); // 0 when standing under it
  const bottom = o.h * (o.kind === "evergreen" ? 0.1 : 0.25);
  // The ray climbs; it hits the canopy if it is inside the canopy band
  // anywhere between entering and leaving the crown.
  if (near * tanAlt > o.h || far * tanAlt < bottom) return 0;
  return o.kind === "evergreen" ? 1 : 0.85;
}

function sunlitFraction(yard, solids, px, py, alt, az) {
  const dx = Math.sin(az * RAD);
  const dy = Math.cos(az * RAD);
  const tanAlt = Math.tan(alt * RAD);
  for (const b of solids.boxes) {
    const t = rayBox(b, px, py, dx, dy);
    if (t != null && t * tanAlt < b.h) return 0;
  }
  for (const f of solids.fences) {
    const t = raySegment(px, py, dx, dy, f.ends, f.ends2);
    if (t != null && t * tanAlt < f.h) return 0;
  }
  let lit = 1;
  for (const o of solids.trees) lit *= 1 - rayTree(o, px, py, dx, dy, tanAlt);
  return lit;
}

function solidsOf(yard) {
  return {
    boxes: boxes(yard),
    fences: yard.objects.filter(o => o.kind === "fence").map(o => {
      const [a, b] = fenceEnds(o);
      return { ends: a, ends2: b, h: o.h };
    }),
    trees: yard.objects.filter(o => o.kind === "tree" || o.kind === "evergreen"),
  };
}

// Sun samples for a set of days: [{ alt, az, w }] with w the hours each represents.
function samples(latitude, days) {
  const out = [];
  for (const doy of days) {
    for (let t = STEP / 2; t < 24; t += STEP) {
      const { alt, az } = sunPosition(latitude, doy, t);
      if (alt >= MIN_ALT) out.push({ alt, az, w: STEP / days.length });
    }
  }
  return out;
}

/** Direct-sun hours at one point, averaged over the season's days. */
export function pointHours(yard, latitude, x, y, season = "season") {
  const solids = solidsOf(yard);
  if (solids.boxes.some(b => insideBox(b, x, y))) return null;
  const days = SEASONS[season].days(latitude >= 0);
  let hours = 0;
  for (const s of samples(latitude, days)) hours += s.w * sunlitFraction(yard, solids, x, y, s.alt, s.az);
  return Math.round(hours * 10) / 10;
}

/**
 * The whole map: { n, cell, extent, hours: Float32Array (NaN under buildings) }
 * Row 0 is the north edge.
 */
export function sunGrid(yard, latitude, season = "season") {
  const n = Math.round((EXTENT * 2) / CELL);
  const hours = new Float32Array(n * n);
  const solids = solidsOf(yard);
  const sun = samples(latitude, SEASONS[season].days(latitude >= 0));
  for (let row = 0; row < n; row++) {
    const y = EXTENT - (row + 0.5) * CELL;
    for (let col = 0; col < n; col++) {
      const x = -EXTENT + (col + 0.5) * CELL;
      if (solids.boxes.some(b => insideBox(b, x, y))) {
        hours[row * n + col] = NaN;
        continue;
      }
      let h = 0;
      for (const s of sun) h += s.w * sunlitFraction(yard, solids, x, y, s.alt, s.az);
      hours[row * n + col] = h;
    }
  }
  return { n, cell: CELL, extent: EXTENT, hours };
}

/** Light class at a map point from a grid. */
export function lightAt(grid, x, y) {
  const col = Math.floor((x + grid.extent) / grid.cell);
  const row = Math.floor((grid.extent - y) / grid.cell);
  if (col < 0 || row < 0 || col >= grid.n || row >= grid.n) return null;
  const h = grid.hours[row * grid.n + col];
  return Number.isNaN(h) ? null : { hours: Math.round(h * 10) / 10, light: lightFor(h) };
}

/** How much of the yard falls in each light class. */
export function lightShares(grid) {
  const count = { full: 0, part: 0, shade: 0 };
  let total = 0;
  for (const h of grid.hours) {
    if (Number.isNaN(h)) continue;
    count[lightFor(h)]++;
    total++;
  }
  return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, total ? v / total : 0]));
}

/**
 * Where a plant should go: cells matching its first-choice light are "best",
 * any light it takes are "ok". For heat-shy plants, cells that get most of
 * their sun after 2 pm in summer count down from best to ok.
 */
export function plantFit(grid, plant) {
  const first = plant.sun[0];
  const fit = new Uint8Array(grid.hours.length); // 0 no, 1 ok, 2 best
  grid.hours.forEach((h, i) => {
    if (Number.isNaN(h)) return;
    const l = lightFor(h);
    if (l === first) fit[i] = 2;
    else if (plant.sun.includes(l)) fit[i] = 1;
  });
  return fit;
}

/** Plain-language spots on the map that fit: the sides of the house, measured. */
export function houseSides(yard, latitude, season = "season") {
  const solids = solidsOf(yard);
  const house = solids.boxes[0];
  const { ux, uy, vx, vy } = axes(house.angle);
  const off = 1.2; // a bed about 4 ft out from the wall
  const sides = [
    { id: "front", name: "Front", u: house.d / 2 + off, v: 0, deg: house.angle },
    { id: "back", name: "Back", u: -(house.d / 2 + off), v: 0, deg: (house.angle + 180) % 360 },
    { id: "right", name: "Right side", u: 0, v: house.w / 2 + off, deg: (house.angle + 90) % 360 },
    { id: "left", name: "Left side", u: 0, v: -(house.w / 2 + off), deg: (house.angle + 270) % 360 },
  ];
  return sides.map(s => {
    const x = s.u * ux + s.v * vx;
    const y = s.u * uy + s.v * vy;
    const hours = pointHours(yard, latitude, x, y, season);
    return { ...s, x, y, hours, light: lightFor(hours ?? 0), compass: compassName(s.deg) };
  });
}

const NAMES = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export const compassName = deg => NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export function cleanYard(y) {
  const base = defaultYard();
  if (!y || typeof y !== "object") return base;
  const num = (v, min, max, d) => (Number.isFinite(v) && v >= min && v <= max ? v : d);
  const objects = (Array.isArray(y.objects) ? y.objects : [])
    .filter(o => o && typeof o === "object" && OBJECT_KINDS[o.kind] && typeof o.id === "string")
    .slice(0, 40)
    .map(o => {
      const d = OBJECT_KINDS[o.kind];
      return {
        id: o.id.slice(0, 40),
        kind: o.kind,
        x: num(o.x, -EXTENT, EXTENT, 0),
        y: num(o.y, -EXTENT, EXTENT, 0),
        h: num(o.h, 0.3, 40, d.h),
        r: num(o.r, 0.3, 15, d.r ?? 0),
        len: num(o.len, 0.5, 40, d.len ?? 0),
        w: num(o.w, 0.5, 20, d.w ?? 0),
        d: num(o.d, 0.5, 20, d.d ?? 0),
        angle: num(o.angle, -360, 360, 0),
      };
    });
  return {
    facing: num(y.facing, 0, 359, base.facing),
    width: num(y.width, 3, 40, base.width),
    depth: num(y.depth, 3, 40, base.depth),
    height: num(y.height, 2, 20, base.height),
    objects,
  };
}

/** Spots placed on the map take their light from it unless set by hand. */
export function withMapLight(spots, grid) {
  if (!grid) return spots;
  return spots.map(s => {
    if (s.x == null || s.y == null) return s;
    const at = lightAt(grid, s.x, s.y);
    if (!at) return s;
    return { ...s, mapHours: at.hours, mapLight: at.light, light: s.auto ? at.light : s.light };
  });
}

/** Where a new spot goes for a side of the house (or open ground in front). */
export function sidePoint(yard, side) {
  const { ux, uy, vx, vy } = axes(yard.facing);
  const u = { front: yard.depth / 2 + 1.2, back: -(yard.depth / 2 + 1.2), right: 0, left: 0, open: yard.depth / 2 + 7 }[side] ?? 0;
  const v = { right: yard.width / 2 + 1.2, left: -(yard.width / 2 + 1.2) }[side] ?? 0;
  const clamp = n => Math.max(-EXTENT + 0.5, Math.min(EXTENT - 0.5, Math.round(n * 10) / 10));
  return { x: clamp(u * ux + v * vx), y: clamp(u * uy + v * vy) };
}
