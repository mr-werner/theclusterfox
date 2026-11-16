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
export const EXTENT = 20; // meters from the map center to its edge (a lot about 130 ft across)
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
  // Ground cover: drawn on the map, casts no shade.
  lawn: { name: "Lawn", ground: true, w: 10, d: 8, angle: 0 },
  bed: { name: "Garden bed", ground: true, w: 4, d: 1.5, angle: 0 },
  raised: { name: "Raised bed", ground: true, w: 2.4, d: 1.2, angle: 0 },
  mulch: { name: "Mulch", ground: true, w: 3, d: 2, angle: 0, round: true },
  rocks: { name: "Rocks", ground: true, w: 2, d: 1.5, angle: 0, round: true },
  patio: { name: "Patio or path", ground: true, w: 4, d: 3, angle: 0 },
  // A plant you already have, tied to a garden entry for its care schedule.
  plant: { name: "Plant", ground: true, r: 0.5 },
};
export const isBoxKind = k => k === "shed" || k === "wing" || (OBJECT_KINDS[k]?.ground && k !== "plant");
export const isTreeKind = k => k === "tree" || k === "evergreen";

export function defaultYard() {
  // cx, cy: where the house sits on the map. turn: the compass direction at the top of the map.
  return { facing: 180, width: 12, depth: 9, height: 6, cx: 0, cy: 0, turn: 0, objects: [] };
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
  const list = [{ cx: yard.cx ?? 0, cy: yard.cy ?? 0, w: yard.width, d: yard.depth, angle: yard.facing, h: yard.height, house: true }];
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
  return o.block;
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

// Leafy trees drop their leaves for winter: bare branches still block a third.
function solidsOf(yard, season = "season") {
  const leafOff = season === "winter";
  return {
    boxes: boxes(yard),
    fences: yard.objects.filter(o => o.kind === "fence").map(o => {
      const [a, b] = fenceEnds(o);
      return { ends: a, ends2: b, h: o.h };
    }),
    trees: yard.objects.filter(o => isTreeKind(o.kind)).map(o => ({ ...o, block: o.kind === "evergreen" ? 1 : leafOff ? 0.35 : 0.85 })),
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
  const solids = solidsOf(yard, season);
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
  const solids = solidsOf(yard, season);
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

/** The season's middle day, for showing shadows at one moment. */
export const seasonDay = (season, latitude) => {
  const days = SEASONS[season].days(latitude >= 0);
  return days[Math.floor(days.length / 2)];
};

/**
 * Shadows at one moment, like a photo from above: { n, cell, extent, lit
 * (0 shade … 1 full sun, NaN under buildings), alt, az } or null at night.
 */
export function shadowGrid(yard, latitude, season, hour) {
  const { alt, az } = sunPosition(latitude, seasonDay(season, latitude), hour);
  if (alt <= 0.5) return null;
  const n = Math.round((EXTENT * 2) / CELL);
  const lit = new Float32Array(n * n);
  const solids = solidsOf(yard, season);
  for (let row = 0; row < n; row++) {
    const y = EXTENT - (row + 0.5) * CELL;
    for (let col = 0; col < n; col++) {
      const x = -EXTENT + (col + 0.5) * CELL;
      lit[row * n + col] = solids.boxes.some(b => insideBox(b, x, y)) ? NaN : sunlitFraction(yard, solids, x, y, alt, az);
    }
  }
  return { n, cell: CELL, extent: EXTENT, lit, alt, az };
}

/** Sunrise and sunset in solar hours (sun above 0.5°), for the time slider. */
export function daylightHours(latitude, season) {
  const doy = seasonDay(season, latitude);
  let rise = null;
  let set = null;
  for (let t = 0; t <= 24; t += 0.25) {
    if (sunPosition(latitude, doy, t).alt > 0.5) {
      if (rise == null) rise = t;
      set = t;
    }
  }
  return rise == null ? null : { rise, set };
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
  const solids = solidsOf(yard, season);
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
    const x = house.cx + s.u * ux + s.v * vx;
    const y = house.cy + s.u * uy + s.v * vy;
    const hours = pointHours(yard, latitude, x, y, season);
    return { ...s, x, y, hours, light: lightFor(hours ?? 0), compass: compassName(s.deg) };
  });
}

const NAMES = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export const compassName = deg => NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export const MAX_OBJECTS = 80;

export function cleanYard(y) {
  const base = defaultYard();
  if (!y || typeof y !== "object") return base;
  const num = (v, min, max, d) => (Number.isFinite(v) && v >= min && v <= max ? v : d);
  const str = v => (typeof v === "string" ? v.slice(0, 40) : null);
  const objects = (Array.isArray(y.objects) ? y.objects : [])
    .filter(o => o && typeof o === "object" && OBJECT_KINDS[o.kind] && typeof o.id === "string")
    .filter(o => o.kind !== "plant" || typeof o.plantId === "string")
    .slice(0, MAX_OBJECTS)
    .map(o => {
      const d = OBJECT_KINDS[o.kind];
      const out = {
        id: o.id.slice(0, 40),
        kind: o.kind,
        x: num(o.x, -EXTENT, EXTENT, 0),
        y: num(o.y, -EXTENT, EXTENT, 0),
        h: num(o.h, 0.3, 40, d.h ?? 0.3),
        r: num(o.r, 0.1, 15, d.r ?? 0),
        len: num(o.len, 0.5, 60, d.len ?? 0),
        w: num(o.w, 0.3, 40, d.w ?? 0),
        d: num(o.d, 0.3, 40, d.d ?? 0),
        angle: num(o.angle, -360, 360, 0),
      };
      if (d.ground && o.kind !== "plant") out.round = typeof o.round === "boolean" ? o.round : Boolean(d.round);
      if (o.kind === "plant" || o.kind === "lawn" || isTreeKind(o.kind)) {
        out.plantId = str(o.plantId);
        out.entryId = str(o.entryId);
      }
      return out;
    });
  return {
    facing: num(y.facing, 0, 359, base.facing),
    width: num(y.width, 3, 40, base.width),
    depth: num(y.depth, 3, 40, base.depth),
    height: num(y.height, 2, 20, base.height),
    cx: num(y.cx, -EXTENT, EXTENT, 0),
    cy: num(y.cy, -EXTENT, EXTENT, 0),
    turn: num(y.turn, 0, 359, 0),
    objects,
  };
}

// ── Editing helpers (pure: they return a new yard) ─────────────

const round1 = n => Math.round(n * 100) / 100;
const clampMap = n => Math.max(-EXTENT, Math.min(EXTENT, round1(n)));
const turnPoint = (x, y, cx, cy, deg) => {
  const a = deg * RAD;
  const dx = x - cx;
  const dy = y - cy;
  // Compass turn is clockwise on the map (x east, y north).
  return [cx + dx * Math.cos(a) + dy * Math.sin(a), cy - dx * Math.sin(a) + dy * Math.cos(a)];
};

/** Move the house; its wings come along. */
export function moveHouse(yard, cx, cy) {
  const dx = cx - (yard.cx ?? 0);
  const dy = cy - (yard.cy ?? 0);
  return {
    ...yard,
    cx: clampMap(cx),
    cy: clampMap(cy),
    objects: yard.objects.map(o => (o.kind === "wing" ? { ...o, x: clampMap(o.x + dx), y: clampMap(o.y + dy) } : o)),
  };
}

/** Turn the house to face a new way; its wings swing around with it. */
export function turnHouse(yard, facing) {
  const f = ((Math.round(facing) % 360) + 360) % 360;
  const delta = f - yard.facing;
  const cx = yard.cx ?? 0;
  const cy = yard.cy ?? 0;
  return {
    ...yard,
    facing: f,
    objects: yard.objects.map(o => {
      if (o.kind !== "wing") return o;
      const [x, y] = turnPoint(o.x, o.y, cx, cy, delta);
      return { ...o, x: clampMap(x), y: clampMap(y), angle: (((o.angle + delta) % 360) + 360) % 360 };
    }),
  };
}

// Common footprints, as wings placed against the main block (in its own axes:
// u out of the front, v to the front's right).
export const HOUSE_SHAPES = [
  { id: "box", name: "Rectangle" },
  { id: "L", name: "L shape" },
  { id: "T", name: "T shape" },
  { id: "U", name: "U shape" },
  { id: "garage", name: "Attached garage" },
];

export function shapeHouse(yard, shape, newId) {
  const W = yard.width;
  const D = yard.depth;
  const h = Math.max(2.5, yard.height - 1.5);
  const parts = {
    box: [],
    L: [{ u: -(D / 2 + 3), v: W / 4, w: W / 2, d: 6 }],
    T: [{ u: -(D / 2 + 3), v: 0, w: W / 3, d: 6 }],
    U: [
      { u: -(D / 2 + 3), v: W / 2 - W / 6, w: W / 3, d: 6 },
      { u: -(D / 2 + 3), v: -(W / 2 - W / 6), w: W / 3, d: 6 },
    ],
    garage: [{ u: D / 2 - 3.5, v: W / 2 + 3.25, w: 6.5, d: 7, h: 3.2 }],
  }[shape] ?? [];
  const { ux, uy, vx, vy } = axes(yard.facing);
  const cx = yard.cx ?? 0;
  const cy = yard.cy ?? 0;
  const keep = shape === "garage" ? yard.objects : yard.objects.filter(o => o.kind !== "wing");
  const wings = parts.map(p => ({ id: newId(), kind: "wing", x: clampMap(cx + p.u * ux + p.v * vx), y: clampMap(cy + p.u * uy + p.v * vy), w: p.w, d: p.d, h: p.h ?? h, r: 0, len: 0, angle: yard.facing }));
  return { ...yard, objects: [...keep, ...wings] };
}

/** A fence rebuilt from its two ends. */
export function fenceFromEnds([ax, ay], [bx, by]) {
  const len = Math.max(0.5, Math.hypot(bx - ax, by - ay));
  const angle = ((Math.atan2(bx - ax, by - ay) / RAD) % 180 + 180) % 180;
  return { x: round1((ax + bx) / 2), y: round1((ay + by) / 2), len: round1(len), angle: round1(angle) };
}

/** Where a point sits in an object's own axes (u toward its angle, v to the right). */
export function localPoint(o, x, y) {
  const { ux, uy, vx, vy } = axes(o.angle ?? 0);
  const rx = x - o.x;
  const ry = y - o.y;
  return { u: rx * ux + ry * uy, v: rx * vx + ry * vy };
}

/** A map point from an object's own axes. */
export function worldPoint(o, u, v) {
  const { ux, uy, vx, vy } = axes(o.angle ?? 0);
  return [o.x + u * ux + v * vx, o.y + u * uy + v * vy];
}

/** Compass bearing from (x0, y0) to (x1, y1). */
export const bearing = (x0, y0, x1, y1) => ((Math.atan2(x1 - x0, y1 - y0) / RAD) % 360 + 360) % 360;

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
  return { x: clamp((yard.cx ?? 0) + u * ux + v * vx), y: clamp((yard.cy ?? 0) + u * uy + v * vy) };
}
