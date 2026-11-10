// Materials and standard member sizes for the frame builder.
//
// Rolled shapes (W, C, IPE, HEA) carry their published area, strong-axis moment
// of inertia and section modulus, because the root fillets add a few percent that
// the plain plate model leaves out. Tubes, pipes, angles and lumber are worked out
// from their dimensions. US tubes use the AISC design wall (0.93 × nominal).
// Values are from the AISC Steel Construction Manual, EN 10365 / Arcelor sales
// tables, ASME B36.10 and the NDS supplement; check a current table before design.

import { section } from "../model/structures.js";

const IN = 0.0254;
const MM = 1e-3;

// Strength is the yield stress for metals. For wood it is the reference
// bending design value Fb, which already includes a safety margin.
export const FRAME_MATERIALS = [
  { id: "a992", name: "Steel, ASTM A992 (W shapes)", E: 200e9, Fy: 345e6, rho: 7850, kind: "steel" },
  { id: "a36", name: "Steel, ASTM A36", E: 200e9, Fy: 250e6, rho: 7850, kind: "steel" },
  { id: "a500", name: "Steel, ASTM A500 Gr C (HSS)", E: 200e9, Fy: 345e6, rho: 7850, kind: "steel" },
  { id: "a53", name: "Steel pipe, ASTM A53 Gr B", E: 200e9, Fy: 240e6, rho: 7850, kind: "steel" },
  { id: "s275", name: "Steel, S275", E: 210e9, Fy: 275e6, rho: 7850, kind: "steel" },
  { id: "s355", name: "Steel, S355", E: 210e9, Fy: 355e6, rho: 7850, kind: "steel" },
  { id: "ss304", name: "Stainless 304", E: 193e9, Fy: 215e6, rho: 8000, kind: "steel" },
  { id: "al6061", name: "Aluminum 6061-T6", E: 68.9e9, Fy: 276e6, rho: 2700, kind: "aluminum" },
  { id: "al6063", name: "Aluminum 6063-T5", E: 68.9e9, Fy: 145e6, rho: 2690, kind: "aluminum" },
  { id: "dfl2", name: "Douglas fir-larch No. 2 (Fb)", E: 11.0e9, Fy: 6.2e6, rho: 530, kind: "wood" },
  { id: "spf2", name: "Spruce-pine-fir No. 2 (Fb)", E: 9.65e9, Fy: 6.0e6, rho: 420, kind: "wood" },
  { id: "glulam", name: "Glulam 24F-V4 (Fb)", E: 12.4e9, Fy: 16.5e6, rho: 560, kind: "wood" },
  { id: "c24", name: "Timber C24 (fm,k)", E: 11.0e9, Fy: 24e6, rho: 420, kind: "wood" },
];
export const frameMaterial = (id) => FRAME_MATERIALS.find((m) => m.id === id) || FRAME_MATERIALS[0];

// [name, d, bf, tf, tw, A in², Ix in⁴, Sx in³, Iy in⁴]
const W = [
  ["W8x10", 7.89, 3.94, 0.205, 0.17, 2.96, 30.8, 7.81, 2.09],
  ["W8x18", 8.14, 5.25, 0.33, 0.23, 5.26, 61.9, 15.2, 7.97],
  ["W8x31", 8.0, 8.0, 0.435, 0.285, 9.13, 110, 27.5, 37.1],
  ["W10x12", 9.87, 3.96, 0.21, 0.19, 3.54, 53.8, 10.9, 2.18],
  ["W10x22", 10.2, 5.75, 0.36, 0.24, 6.49, 118, 23.2, 11.4],
  ["W10x33", 9.73, 7.96, 0.435, 0.29, 9.71, 171, 35.0, 36.6],
  ["W10x49", 10.0, 10.0, 0.56, 0.34, 14.4, 272, 54.6, 93.4],
  ["W12x14", 11.9, 3.97, 0.225, 0.2, 4.16, 88.6, 14.9, 2.36],
  ["W12x26", 12.2, 6.49, 0.38, 0.23, 7.65, 204, 33.4, 17.3],
  ["W12x40", 11.9, 8.01, 0.515, 0.295, 11.7, 307, 51.5, 44.1],
  ["W12x65", 12.1, 12.0, 0.605, 0.39, 19.1, 533, 87.9, 174],
  ["W14x22", 13.7, 5.0, 0.335, 0.23, 6.49, 199, 29.0, 7.0],
  ["W14x30", 13.8, 6.73, 0.385, 0.27, 8.85, 291, 42.0, 19.6],
  ["W14x48", 13.8, 8.03, 0.595, 0.34, 14.1, 484, 70.2, 51.4],
  ["W14x90", 14.0, 14.5, 0.71, 0.44, 26.5, 999, 143, 362],
  ["W16x26", 15.7, 5.5, 0.345, 0.25, 7.68, 301, 38.4, 9.59],
  ["W16x40", 16.0, 7.0, 0.505, 0.305, 11.8, 518, 64.7, 28.9],
  ["W18x35", 17.7, 6.0, 0.425, 0.3, 10.3, 510, 57.6, 15.3],
  ["W18x50", 18.0, 7.5, 0.57, 0.355, 14.7, 800, 88.9, 40.1],
  ["W21x44", 20.7, 6.5, 0.45, 0.35, 13.0, 843, 81.6, 20.7],
  ["W21x62", 21.0, 8.24, 0.615, 0.4, 18.3, 1330, 127, 57.5],
  ["W24x55", 23.6, 7.01, 0.505, 0.395, 16.2, 1350, 114, 29.1],
  ["W24x76", 23.9, 8.99, 0.68, 0.44, 22.4, 2100, 176, 82.5],
];

// [name, d, bf, tf, tw, A in², Ix in⁴, Sx in³]
const C = [
  ["C6x8.2", 6, 1.92, 0.343, 0.2, 2.39, 13.1, 4.35],
  ["C8x11.5", 8, 2.26, 0.39, 0.22, 3.37, 32.5, 8.14],
  ["C10x15.3", 10, 2.6, 0.436, 0.24, 4.48, 67.3, 13.5],
  ["C12x20.7", 12, 2.94, 0.501, 0.282, 6.08, 129, 21.5],
];

// [name, h, b, tw, tf (mm), A cm², Iy cm⁴, Wel cm³, Iz cm⁴]
const IPE = [
  ["IPE 100", 100, 55, 4.1, 5.7, 10.3, 171, 34.2, 15.9],
  ["IPE 120", 120, 64, 4.4, 6.3, 13.2, 318, 53.0, 27.7],
  ["IPE 140", 140, 73, 4.7, 6.9, 16.4, 541, 77.3, 44.9],
  ["IPE 160", 160, 82, 5.0, 7.4, 20.1, 869, 109, 68.3],
  ["IPE 180", 180, 91, 5.3, 8.0, 23.9, 1317, 146, 101],
  ["IPE 200", 200, 100, 5.6, 8.5, 28.5, 1943, 194, 142],
  ["IPE 240", 240, 120, 6.2, 9.8, 39.1, 3892, 324, 284],
  ["IPE 270", 270, 135, 6.6, 10.2, 45.9, 5790, 429, 420],
  ["IPE 300", 300, 150, 7.1, 10.7, 53.8, 8356, 557, 604],
  ["IPE 360", 360, 170, 8.0, 12.7, 72.7, 16270, 904, 1043],
  ["IPE 400", 400, 180, 8.6, 13.5, 84.5, 23130, 1160, 1318],
];
const HEA = [
  ["HEA 100", 96, 100, 5.0, 8.0, 21.2, 349, 72.8, 134],
  ["HEA 160", 152, 160, 6.0, 9.0, 38.8, 1673, 220, 616],
  ["HEA 200", 190, 200, 6.5, 10.0, 53.8, 3692, 389, 1336],
  ["HEA 240", 230, 240, 7.5, 12.0, 76.8, 7763, 675, 2769],
  ["HEA 300", 290, 300, 8.5, 14.0, 112.5, 18260, 1260, 6310],
];

// HSS: [name, H, B, t nominal] in inches.
const HSS = [
  ["HSS3x3x1/4", 3, 3, 0.25],
  ["HSS4x4x1/4", 4, 4, 0.25],
  ["HSS4x4x3/8", 4, 4, 0.375],
  ["HSS6x6x1/4", 6, 6, 0.25],
  ["HSS6x6x3/8", 6, 6, 0.375],
  ["HSS8x8x3/8", 8, 8, 0.375],
  ["HSS6x4x1/4", 6, 4, 0.25],
  ["HSS8x4x1/4", 8, 4, 0.25],
  ["HSS10x6x3/8", 10, 6, 0.375],
];
// Standard-weight pipe: [name, OD, wall] in inches.
const PIPE = [
  ["Pipe 2 Std", 2.375, 0.154],
  ["Pipe 3 Std", 3.5, 0.216],
  ["Pipe 4 Std", 4.5, 0.237],
  ["Pipe 6 Std", 6.625, 0.28],
  ["Pipe 8 Std", 8.625, 0.322],
];
// Equal angles: [name, leg, t] in inches.
const ANGLE = [
  ["L2x2x1/4", 2, 0.25],
  ["L3x3x1/4", 3, 0.25],
  ["L4x4x3/8", 4, 0.375],
];
// Lumber, actual dressed sizes: [name, b, d] in inches.
const LUMBER = [
  ["2x4", 1.5, 3.5],
  ["2x6", 1.5, 5.5],
  ["2x8", 1.5, 7.25],
  ["2x10", 1.5, 9.25],
  ["2x12", 1.5, 11.25],
  ["4x4", 3.5, 3.5],
  ["4x6", 3.5, 5.5],
  ["6x6", 5.5, 5.5],
];
// Metric: SHS [name, size, t] mm, CHS [name, D, t] mm, timber [name, b, h] mm.
const SHS = [
  ["SHS 50x50x4", 50, 4],
  ["SHS 100x100x5", 100, 5],
  ["SHS 150x150x8", 150, 8],
  ["SHS 200x200x10", 200, 10],
];
const CHS = [
  ["CHS 60.3x4", 60.3, 4],
  ["CHS 114.3x5", 114.3, 5],
  ["CHS 168.3x6.3", 168.3, 6.3],
];
const TIMBER = [
  ["45x95", 45, 95],
  ["45x145", 45, 145],
  ["45x195", 45, 195],
  ["45x245", 45, 245],
  ["95x95", 95, 95],
  ["140x140", 140, 140],
];

const in2 = IN * IN, in3 = in2 * IN, in4 = in3 * IN;
const cm2 = 1e-4, cm3 = 1e-6, cm4 = 1e-8;

/** Every standard size: { id, name, family, shape, dims (m), mat (suggested), props? }. */
export const FRAME_SECTIONS = [
  ...W.map(([name, d, bf, tf, tw, A, Ix, Sx, Iy]) => ({
    id: name, name, family: "W shapes (US)", shape: "ibeam", mat: "a992",
    dims: { h: d * IN, b: bf * IN, tf: tf * IN, tw: tw * IN },
    props: { A: A * in2, Ix: Ix * in4, Sx: Sx * in3, Iy: Iy * in4, Sy: (Iy * in4) / ((bf * IN) / 2) },
  })),
  ...C.map(([name, d, bf, tf, tw, A, Ix, Sx]) => ({
    id: name, name, family: "Channels (US)", shape: "channel", mat: "a36",
    dims: { h: d * IN, b: bf * IN, tf: tf * IN, tw: tw * IN },
    props: { A: A * in2, Ix: Ix * in4, Sx: Sx * in3 },
  })),
  ...HSS.map(([name, H, B, t]) => ({ id: name, name, family: "HSS tubes (US)", shape: "rhs", mat: "a500", dims: { H: H * IN, B: B * IN, t: 0.93 * t * IN } })),
  ...PIPE.map(([name, D, t]) => ({ id: name, name, family: "Pipe (US)", shape: "tube", mat: "a53", dims: { D: D * IN, t: 0.93 * t * IN } })),
  ...ANGLE.map(([name, leg, t]) => ({ id: name, name, family: "Angles (US)", shape: "angle", mat: "a36", dims: { b: leg * IN, h: leg * IN, t: t * IN } })),
  ...LUMBER.map(([name, b, d]) => ({ id: `lumber ${name}`, name: `${name} lumber`, family: "Lumber (US)", shape: "rect", mat: "dfl2", dims: { b: b * IN, h: d * IN } })),
  ...IPE.map(([name, h, b, tw, tf, A, Iy, W, Iz]) => ({
    id: name, name, family: "IPE (EU)", shape: "ibeam", mat: "s355",
    dims: { h: h * MM, b: b * MM, tf: tf * MM, tw: tw * MM },
    props: { A: A * cm2, Ix: Iy * cm4, Sx: W * cm3, Iy: Iz * cm4, Sy: (Iz * cm4) / ((b * MM) / 2) },
  })),
  ...HEA.map(([name, h, b, tw, tf, A, Iy, W, Iz]) => ({
    id: name, name, family: "HEA (EU)", shape: "ibeam", mat: "s355",
    dims: { h: h * MM, b: b * MM, tf: tf * MM, tw: tw * MM },
    props: { A: A * cm2, Ix: Iy * cm4, Sx: W * cm3, Iy: Iz * cm4, Sy: (Iz * cm4) / ((b * MM) / 2) },
  })),
  ...SHS.map(([name, s, t]) => ({ id: name, name, family: "SHS tubes (metric)", shape: "rhs", mat: "s355", dims: { H: s * MM, B: s * MM, t: t * MM } })),
  ...CHS.map(([name, D, t]) => ({ id: name, name, family: "CHS tubes (metric)", shape: "tube", mat: "s355", dims: { D: D * MM, t: t * MM } })),
  ...TIMBER.map(([name, b, h]) => ({ id: `timber ${name}`, name: `${name} timber`, family: "Timber (metric)", shape: "rect", mat: "c24", dims: { b: b * MM, h: h * MM } })),
];
export const FRAME_SECTION_FAMILIES = [...new Set(FRAME_SECTIONS.map((s) => s.family))];
export const frameSectionById = Object.fromEntries(FRAME_SECTIONS.map((s) => [s.id, s]));

/** Depth of a shape (m), for drawing and for the extreme-fibre distance. */
export function shapeDepth(shape, dims) {
  if (shape === "rhs") return dims.H;
  if (shape === "tube" || shape === "round") return dims.D;
  return dims.h;
}

/**
 * Properties a member needs, for its section and bending axis:
 * { A, I (in-plane), S (in-plane), Imin, depth, name, shape, dims } in SI.
 * `sec` is a library id, or "custom" with member.custom = { shape, dims } or { A, I, S }.
 */
export function memberSection(member) {
  const weak = member.axis === "weak";
  if (member.sec === "custom") {
    const c = member.custom || {};
    if (c.shape === "props") {
      const A = c.A, I = c.I, S = c.S;
      return { A, I, S, Imin: c.Imin > 0 ? Math.min(c.Imin, I) : I, depth: I > 0 && S > 0 ? (2 * I) / S : 0.1, name: "Custom properties", shape: null, dims: null };
    }
    const p = c.shape ? section(c.shape, c.dims || {}) : null;
    if (!p) return null;
    return {
      A: p.A, I: weak ? p.Iy : p.Ix, S: weak ? p.Sy : p.Sx, Imin: Math.min(p.Ix, p.Iy, p.Imin || Infinity),
      depth: weak ? p.cx * 2 : shapeDepth(c.shape, c.dims), name: "Custom", shape: c.shape, dims: c.dims,
    };
  }
  const s = frameSectionById[member.sec];
  if (!s) return null;
  const g = section(s.shape, s.dims);
  const pr = { A: g.A, Ix: g.Ix, Sx: g.Sx, Iy: g.Iy, Sy: g.Sy, ...(s.props || {}) };
  // Published Ix differs from the plate model by the fillets; scale Iy the same way when it isn't published.
  if (s.props && !s.props.Iy) {
    pr.Iy = g.Iy * (s.props.A / g.A);
    pr.Sy = g.Sy * (s.props.A / g.A);
  }
  return {
    A: pr.A, I: weak ? pr.Iy : pr.Ix, S: weak ? pr.Sy : pr.Sx, Imin: Math.min(pr.Ix, pr.Iy, s.shape === "angle" ? g.Imin : Infinity),
    depth: weak ? (s.dims.b ?? s.dims.B ?? s.dims.D) : shapeDepth(s.shape, s.dims), name: s.name, shape: s.shape, dims: s.dims,
  };
}
