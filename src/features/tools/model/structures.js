// Beams and cross-sections.

/**
 * Single-span beam with one load case. Sagging moment positive, deflection downward positive.
 * support: "ss" simply supported, "cant" cantilever fixed at x = 0, "fixed" both ends fixed.
 * load: "point" (P at a) or "udl" (w over the whole span).
 */
export function solveBeam({ support, load, L, a = L / 2, P = 0, w = 0, E, I, n = 200 }) {
  const isPoint = load === "point";
  a = Math.min(Math.max(a, 0), L);
  const b = L - a;
  const total = isPoint ? P : w * L;
  let RA;
  let M0 = 0;
  if (support === "ss") RA = isPoint ? (P * b) / L : (w * L) / 2;
  else if (support === "cant") {
    RA = total;
    M0 = isPoint ? -P * a : (-w * L * L) / 2;
  } else {
    RA = isPoint ? (P * b * b * (3 * a + b)) / L ** 3 : (w * L) / 2;
    M0 = isPoint ? (-P * a * b * b) / (L * L) : (-w * L * L) / 12;
  }
  const EI = E * I;
  const defl = (x) => {
    if (support === "ss") {
      if (!isPoint) return (w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI);
      if (x <= a) return (P * b * x * (L * L - b * b - x * x)) / (6 * EI * L);
      const xr = L - x;
      return (P * a * xr * (L * L - a * a - xr * xr)) / (6 * EI * L);
    }
    if (support === "cant") {
      if (!isPoint) return (w * x * x * (6 * L * L - 4 * L * x + x * x)) / (24 * EI);
      return x <= a ? (P * x * x * (3 * a - x)) / (6 * EI) : (P * a * a * (3 * x - a)) / (6 * EI);
    }
    if (!isPoint) return (w * x * x * (L - x) ** 2) / (24 * EI);
    if (x <= a) return (P * b * b * x * x * (3 * a * L - 3 * a * x - b * x)) / (6 * EI * L ** 3);
    const xr = L - x;
    return (P * a * a * xr * xr * (3 * b * L - 3 * b * xr - a * xr)) / (6 * EI * L ** 3);
  };
  const xs = [];
  for (let i = 0; i <= n; i++) xs.push((L * i) / n);
  if (isPoint && !xs.includes(a)) xs.push(a), xs.sort((p, q) => p - q);
  const shear = (x, side = 1) => RA - (isPoint ? (x > a || (x === a && side > 0) ? P : 0) : w * x);
  const moment = (x) => M0 + RA * x - (isPoint ? P * Math.max(0, x - a) : (w * x * x) / 2);
  const pts = xs.map((x) => ({ x, V: shear(x), M: moment(x), y: defl(x) }));
  let maxM = 0, maxV = 0, maxY = 0, xMaxY = 0;
  for (const p of pts) {
    if (Math.abs(p.M) > Math.abs(maxM)) maxM = p.M;
    if (Math.abs(p.y) > Math.abs(maxY)) (maxY = p.y), (xMaxY = p.x);
  }
  for (const x of xs) {
    for (const s of [-1, 1]) if (Math.abs(shear(x, s)) > Math.abs(maxV)) maxV = shear(x, s);
  }
  return { pts, RA, RB: total - RA, MA: M0, maxM, maxV, maxY, xMaxY };
}

/** Properties of shapes built from rectangles [x, y, w, h] (bottom-left origin). */
function composite(rects, bw, bh) {
  let A = 0, Sx = 0, Sy = 0;
  for (const [x, y, w, h] of rects) (A += w * h), (Sx += w * h * (x + w / 2)), (Sy += w * h * (y + h / 2));
  const xc = Sx / A, yc = Sy / A;
  let Ix = 0, Iy = 0, Ixy = 0;
  for (const [x, y, w, h] of rects) {
    const dx = x + w / 2 - xc, dy = y + h / 2 - yc;
    Ix += (w * h ** 3) / 12 + w * h * dy * dy;
    Iy += (h * w ** 3) / 12 + w * h * dx * dx;
    Ixy += w * h * dx * dy;
  }
  return { A, Ix, Iy, Ixy, xc, yc, cx: Math.max(xc, bw - xc), cy: Math.max(yc, bh - yc) };
}

/** Section properties. Dimensions in metres. Centroid (xc, yc) is measured from the bottom-left of the bounding box. */
export function section(shape, d) {
  const out = (A, Ix, Iy, cx, cy, J, extra = {}) => {
    const Ixy = extra.Ixy || 0;
    const mid = (Ix + Iy) / 2, rad = Math.sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2);
    return { A, Ix, Iy, Sx: Ix / cy, Sy: Iy / cx, rx: Math.sqrt(Ix / A), ry: Math.sqrt(Iy / A), J, Imin: mid - rad, Imax: mid + rad, ...extra };
  };
  const thinOK = (...ok) => ok.every(Boolean);
  switch (shape) {
    case "rect": {
      const { b, h } = d;
      const long = Math.max(b, h), short = Math.min(b, h);
      const J = long * short ** 3 * (1 / 3 - 0.21 * (short / long) * (1 - short ** 4 / (12 * long ** 4)));
      return out(b * h, (b * h ** 3) / 12, (h * b ** 3) / 12, b / 2, h / 2, J);
    }
    case "round": {
      const I = (Math.PI * d.D ** 4) / 64;
      return out((Math.PI * d.D ** 2) / 4, I, I, d.D / 2, d.D / 2, 2 * I);
    }
    case "tube": {
      if (!thinOK(2 * d.t < d.D)) return null;
      const di = d.D - 2 * d.t;
      const I = (Math.PI * (d.D ** 4 - di ** 4)) / 64;
      return out((Math.PI * (d.D ** 2 - di ** 2)) / 4, I, I, d.D / 2, d.D / 2, 2 * I);
    }
    case "rhs": {
      const { B, H, t } = d;
      if (!thinOK(2 * t < B, 2 * t < H)) return null;
      const bi = B - 2 * t, hi = H - 2 * t;
      const Am = (B - t) * (H - t);
      const J = (4 * Am * Am * t) / (2 * (B - t + H - t));
      return out(B * H - bi * hi, (B * H ** 3 - bi * hi ** 3) / 12, (H * B ** 3 - hi * bi ** 3) / 12, B / 2, H / 2, J);
    }
    case "ibeam": {
      const { b, h, tf, tw } = d;
      if (!thinOK(2 * tf < h, tw <= b)) return null;
      const hw = h - 2 * tf;
      const A = 2 * b * tf + hw * tw;
      const Ix = (b * h ** 3 - (b - tw) * hw ** 3) / 12;
      const Iy = (2 * tf * b ** 3) / 12 + (hw * tw ** 3) / 12;
      const J = (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3;
      return out(A, Ix, Iy, b / 2, h / 2, J);
    }
    case "tee": {
      // Flange on top, web hanging down the middle.
      const { b, h, tf, tw } = d;
      if (!thinOK(tf < h, tw <= b)) return null;
      const c = composite([[(b - tw) / 2, 0, tw, h - tf], [0, h - tf, b, tf]], b, h);
      return out(c.A, c.Ix, c.Iy, c.cx, c.cy, (b * tf ** 3 + (h - tf / 2) * tw ** 3) / 3, { xc: c.xc, yc: c.yc });
    }
    case "channel": {
      // Web on the left, flanges pointing right.
      const { b, h, tf, tw } = d;
      if (!thinOK(2 * tf < h, tw < b)) return null;
      const c = composite([[0, 0, tw, h], [tw, 0, b - tw, tf], [tw, h - tf, b - tw, tf]], b, h);
      return out(c.A, c.Ix, c.Iy, c.cx, c.cy, (2 * (b - tw / 2) * tf ** 3 + (h - tf) * tw ** 3) / 3, { xc: c.xc, yc: c.yc });
    }
    case "angle": {
      // Vertical leg h on the left, horizontal leg b along the bottom, both thickness t.
      const { b, h, t } = d;
      if (!thinOK(t < b, t < h)) return null;
      const c = composite([[0, 0, t, h], [t, 0, b - t, t]], b, h);
      return out(c.A, c.Ix, c.Iy, c.cx, c.cy, ((b - t / 2 + h - t / 2) * t ** 3) / 3, { xc: c.xc, yc: c.yc, Ixy: c.Ixy });
    }
    case "triangle": {
      // Isosceles, base b at the bottom, apex on top.
      const { b, h } = d;
      // Torsion constant from Saint-Venant's estimate J ≈ A⁴ / (45 Ip): exact for an equilateral triangle.
      const A = (b * h) / 2, Ip = (b * h ** 3) / 36 + (h * b ** 3) / 48;
      const J = A ** 4 / (45 * Ip);
      return out((b * h) / 2, (b * h ** 3) / 36, (h * b ** 3) / 48, b / 2, (2 * h) / 3, J, { xc: b / 2, yc: h / 3 });
    }
    case "hex": {
      // Hex bar, flats top and bottom; s = width across flats.
      const a = d.s / Math.sqrt(3);
      const I = ((5 * Math.sqrt(3)) / 16) * a ** 4;
      return out(((3 * Math.sqrt(3)) / 2) * a * a, I, I, a, d.s / 2, 0.1154 * d.s ** 4);
    }
    default:
      return null;
  }
}

/**
 * Outline of a section for drawing, in metres with the origin at the bottom-left of its box.
 * Returns { w, h, polys: [[[x, y], ...]], circles: [{ cx, cy, r, hole }], xc, yc }.
 */
export function sectionOutline(shape, d) {
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  switch (shape) {
    case "rect":
      return { w: d.b, h: d.h, polys: [box(0, 0, d.b, d.h)] };
    case "round":
      return { w: d.D, h: d.D, circles: [{ cx: d.D / 2, cy: d.D / 2, r: d.D / 2 }] };
    case "tube":
      return { w: d.D, h: d.D, circles: [{ cx: d.D / 2, cy: d.D / 2, r: d.D / 2 }, { cx: d.D / 2, cy: d.D / 2, r: Math.max(0, d.D / 2 - d.t), hole: true }] };
    case "rhs":
      return { w: d.B, h: d.H, polys: [box(0, 0, d.B, d.H), box(d.t, d.t, Math.max(0, d.B - 2 * d.t), Math.max(0, d.H - 2 * d.t)).reverse()] };
    case "ibeam": {
      const { b, h, tf, tw } = d, l = (b - tw) / 2;
      return { w: b, h, polys: [[[0, 0], [b, 0], [b, tf], [l + tw, tf], [l + tw, h - tf], [b, h - tf], [b, h], [0, h], [0, h - tf], [l, h - tf], [l, tf], [0, tf]]] };
    }
    case "tee": {
      const { b, h, tf, tw } = d, l = (b - tw) / 2;
      return { w: b, h, polys: [[[l, 0], [l + tw, 0], [l + tw, h - tf], [b, h - tf], [b, h], [0, h], [0, h - tf], [l, h - tf]]] };
    }
    case "channel": {
      const { b, h, tf, tw } = d;
      return { w: b, h, polys: [[[0, 0], [b, 0], [b, tf], [tw, tf], [tw, h - tf], [b, h - tf], [b, h], [0, h]]] };
    }
    case "angle": {
      const { b, h, t } = d;
      return { w: b, h, polys: [[[0, 0], [b, 0], [b, t], [t, t], [t, h], [0, h]]] };
    }
    case "triangle":
      return { w: d.b, h: d.h, polys: [[[0, 0], [d.b, 0], [d.b / 2, d.h]]] };
    case "hex": {
      const a = d.s / Math.sqrt(3);
      return { w: 2 * a, h: d.s, polys: [[[a / 2, 0], [1.5 * a, 0], [2 * a, d.s / 2], [1.5 * a, d.s], [a / 2, d.s], [0, d.s / 2]]] };
    }
    default:
      return { w: 1, h: 1, polys: [] };
  }
}

// ---------------------------------------------------------------------------
// Free-form beams: any number of supports, point loads, moments and
// (linearly varying) distributed loads, solved with the stiffness method.
// ---------------------------------------------------------------------------

/**
 * Beam model as a compact string, so it fits in a URL. Items are separated by ";":
 *   pin@0  roller@6  fixed@0     supports at x (m)
 *   P10000@2                     point load (N, + is down) at x
 *   M5000@3                      moment (N·m, + is clockwise) at x
 *   w4000@0-6  w2000:6000@0-6    distributed load (N/m, + is down), uniform or linear, from x1 to x2
 */
export function parseBeamModel(text = "") {
  const items = [];
  for (const raw of String(text).split(";")) {
    const s = raw.trim();
    if (!s) continue;
    let m;
    if ((m = s.match(/^(pin|roller|fixed)@(-?[\d.e+-]+)$/i))) items.push({ kind: m[1].toLowerCase(), x: Number(m[2]) });
    else if ((m = s.match(/^P(-?[\d.e+]+(?:e-?\d+)?)@(-?[\d.e+-]+)$/))) items.push({ kind: "point", P: Number(m[1]), x: Number(m[2]) });
    else if ((m = s.match(/^M(-?[\d.e+]+(?:e-?\d+)?)@(-?[\d.e+-]+)$/))) items.push({ kind: "moment", M: Number(m[1]), x: Number(m[2]) });
    else if ((m = s.match(/^w(-?[\d.e+]+(?:e-?\d+)?)(?::(-?[\d.e+]+(?:e-?\d+)?))?@(-?[\d.e+]+(?:e-?\d+)?)-(-?[\d.e+]+(?:e-?\d+)?)$/))) {
      const w1 = Number(m[1]);
      const w2 = m[2] === undefined ? w1 : Number(m[2]);
      items.push({ kind: "udl", w1, w2, x1: Number(m[3]), x2: Number(m[4]) });
    }
  }
  return items.filter((it) => Object.values(it).every((v) => typeof v === "string" || Number.isFinite(v)));
}

const n6 = (v) => String(Number(Number(v).toPrecision(6)));

export function stringifyBeamModel(items) {
  return items
    .map((it) => {
      if (it.kind === "point") return `P${n6(it.P)}@${n6(it.x)}`;
      if (it.kind === "moment") return `M${n6(it.M)}@${n6(it.x)}`;
      if (it.kind === "udl") return `w${n6(it.w1)}${it.w2 !== it.w1 ? `:${n6(it.w2)}` : ""}@${n6(it.x1)}-${n6(it.x2)}`;
      return `${it.kind}@${n6(it.x)}`;
    })
    .join(";");
}

export const isSupport = (it) => it.kind === "pin" || it.kind === "roller" || it.kind === "fixed";

/** Load intensity (N/m, down) at x from all distributed loads; side picks the value just left or right of a step. */
function wAt(udls, x, side) {
  let w = 0;
  for (const u of udls) {
    const inside = side < 0 ? x > u.x1 && x <= u.x2 : x >= u.x1 && x < u.x2;
    if (inside) w += u.w1 + ((u.w2 - u.w1) * (x - u.x1)) / (u.x2 - u.x1);
  }
  return w;
}

/**
 * Solve a free-form beam. Returns null-free results or { error } when the beam can move as a mechanism.
 * Sign conventions match solveBeam: sagging moment +, deflection down +, reactions up +.
 */
export function solveFreeBeam({ L, E, I, items, elements = 240 }) {
  if (!(L > 0) || !(E > 0) || !(I > 0)) return { error: "Span, E and I must be greater than zero." };
  const clampX = (x) => Math.min(L, Math.max(0, x));
  const supports = items.filter(isSupport).map((s) => ({ ...s, x: clampX(s.x) }));
  const points = items.filter((i) => i.kind === "point").map((p) => ({ ...p, x: clampX(p.x) }));
  const moments = items.filter((i) => i.kind === "moment").map((p) => ({ ...p, x: clampX(p.x) }));
  const udls = items
    .filter((i) => i.kind === "udl")
    .map((u) => {
      const a = clampX(Math.min(u.x1, u.x2)), b = clampX(Math.max(u.x1, u.x2));
      const flip = u.x1 > u.x2;
      return { w1: flip ? u.w2 : u.w1, w2: flip ? u.w1 : u.w2, x1: a, x2: b };
    })
    .filter((u) => u.x2 > u.x1);
  if (!supports.length) return { error: "Add at least one support." };

  // Mesh: key points, then fill each gap with evenly sized elements.
  const keys = new Set([0, L]);
  for (const it of [...supports, ...points, ...moments]) keys.add(it.x);
  for (const u of udls) keys.add(u.x1), keys.add(u.x2);
  const sorted = [...keys].sort((p, q) => p - q).filter((x, i, arr) => i === 0 || x - arr[i - 1] > L * 1e-9);
  const xs = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    const n = Math.max(1, Math.round(((b - a) / L) * elements));
    for (let k = 1; k <= n; k++) xs.push(k === n ? b : a + ((b - a) * k) / n);
  }
  const nodeAt = (x) => {
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    return best;
  };

  // Banded stiffness (half bandwidth 3), DOFs per node: v (up), θ (counter-clockwise).
  const N = xs.length * 2, BW = 4;
  const K = Array.from({ length: N }, () => new Float64Array(2 * BW + 1));
  const kAdd = (i, j, v) => (K[i][j - i + BW] += v);
  const F = new Float64Array(N);
  const EI = E * I;
  for (let e = 0; e < xs.length - 1; e++) {
    const l = xs[e + 1] - xs[e];
    const c = EI / l ** 3;
    const k = [
      [12, 6 * l, -12, 6 * l],
      [6 * l, 4 * l * l, -6 * l, 2 * l * l],
      [-12, -6 * l, 12, -6 * l],
      [6 * l, 2 * l * l, -6 * l, 4 * l * l],
    ];
    const dofs = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let r = 0; r < 4; r++) for (let s = 0; s < 4; s++) kAdd(dofs[r], dofs[s], c * k[r][s]);
    // Consistent loads for a linearly varying load q1 → q2 (down) on this element.
    const q1 = wAt(udls, xs[e], 1), q2 = wAt(udls, xs[e + 1], -1);
    if (q1 || q2) {
      F[dofs[0]] -= (l * (7 * q1 + 3 * q2)) / 20;
      F[dofs[1]] -= (l * l * (3 * q1 + 2 * q2)) / 60;
      F[dofs[2]] -= (l * (3 * q1 + 7 * q2)) / 20;
      F[dofs[3]] += (l * l * (2 * q1 + 3 * q2)) / 60;
    }
  }
  for (const p of points) F[2 * nodeAt(p.x)] -= p.P;
  for (const m of moments) F[2 * nodeAt(m.x) + 1] -= m.M;

  const fixed = new Set();
  for (const s of supports) {
    const n = nodeAt(s.x);
    fixed.add(2 * n);
    if (s.kind === "fixed") fixed.add(2 * n + 1);
  }
  const Kfull = K.map((row) => Float64Array.from(row));

  // Constrained DOFs: unit diagonal, zero row and column.
  for (const d of fixed) {
    for (let j = Math.max(0, d - BW); j <= Math.min(N - 1, d + BW); j++) {
      K[d][j - d + BW] = 0;
      K[j][d - j + BW] = 0;
    }
    K[d][BW] = Kfull[d][BW];
    F[d] = 0;
  }
  // Banded Gaussian elimination (symmetric positive definite, no pivoting).
  const u = Float64Array.from(F);
  for (let i = 0; i < N; i++) {
    const piv = K[i][BW];
    // A pivot that collapses to nothing means a free rigid-body motion (a mechanism).
    if (!(piv > Kfull[i][BW] * 1e-9)) return { error: "The beam isn't held still: add a support, or make one of them fixed." };
    for (let r = i + 1; r <= Math.min(N - 1, i + BW); r++) {
      const f = K[r][i - r + BW] / piv;
      if (!f) continue;
      for (let c = i; c <= Math.min(N - 1, i + BW); c++) K[r][c - r + BW] -= f * K[i][c - i + BW];
      u[r] -= f * u[i];
    }
  }
  for (let i = N - 1; i >= 0; i--) {
    let s = u[i];
    for (let c = i + 1; c <= Math.min(N - 1, i + BW); c++) s -= K[i][c - i + BW] * u[c];
    u[i] = s / K[i][BW];
  }

  // Reactions from the unconstrained stiffness: R = K u − F (original loads).
  const F0 = new Float64Array(N);
  for (let e = 0; e < xs.length - 1; e++) {
    const l = xs[e + 1] - xs[e];
    const q1 = wAt(udls, xs[e], 1), q2 = wAt(udls, xs[e + 1], -1);
    F0[2 * e] -= (l * (7 * q1 + 3 * q2)) / 20;
    F0[2 * e + 1] -= (l * l * (3 * q1 + 2 * q2)) / 60;
    F0[2 * e + 2] -= (l * (3 * q1 + 7 * q2)) / 20;
    F0[2 * e + 3] += (l * l * (2 * q1 + 3 * q2)) / 60;
  }
  for (const p of points) F0[2 * nodeAt(p.x)] -= p.P;
  for (const m of moments) F0[2 * nodeAt(m.x) + 1] -= m.M;
  const reactionAt = (d) => {
    let s = -F0[d];
    for (let j = Math.max(0, d - BW); j <= Math.min(N - 1, d + BW); j++) s += Kfull[d][j - d + BW] * u[j];
    return s;
  };
  // Several supports on one node share it; report the reaction once, on the first.
  const seen = new Set();
  const reactions = supports.map((s) => {
    const n = nodeAt(s.x);
    if (seen.has(n)) return { ...s, R: 0, M: 0 };
    seen.add(n);
    return { ...s, R: reactionAt(2 * n), M: s.kind === "fixed" ? -reactionAt(2 * n + 1) : 0 };
  });

  // Shear and moment by statics from the left, exact between mesh points.
  const forces = [...reactions.map((r) => ({ x: r.x, F: r.R, C: r.M })), ...points.map((p) => ({ x: p.x, F: -p.P, C: 0 })), ...moments.map((m) => ({ x: m.x, F: 0, C: m.M }))];
  const VM = (x, side) => {
    const left = (px) => (side < 0 ? px < x : px <= x);
    let V = 0, M = 0;
    for (const f of forces) if (left(f.x)) (V += f.F), (M += f.F * (x - f.x) + f.C);
    for (const w of udls) {
      if (x <= w.x1) continue;
      const c = Math.min(x, w.x2), d = c - w.x1, X = x - w.x1, k = (w.w2 - w.w1) / (w.x2 - w.x1);
      V -= w.w1 * d + (k * d * d) / 2;
      M -= w.w1 * (X * d - (d * d) / 2) + k * ((X * d * d) / 2 - (d * d * d) / 3);
    }
    return { V, M };
  };
  const jumps = new Set([...forces.map((f) => f.x)]);
  const pts = [];
  xs.forEach((x, i) => {
    const y = -u[2 * i];
    if (jumps.has(x) && x > 0 && x < L) {
      const a = VM(x, -1), b = VM(x, 1);
      pts.push({ x, V: a.V, M: a.M, y }, { x, V: b.V, M: b.M, y });
    } else {
      const s = VM(x, x === L ? -1 : 1);
      pts.push({ x, V: x === 0 ? VM(0, 1).V : s.V, M: s.M, y });
    }
  });
  // Ends: shear and moment close to zero unless held there.
  let maxM = 0, minM = 0, maxV = 0, maxY = 0, xMaxY = 0, xMaxM = 0, xMinM = 0;
  for (const p of pts) {
    if (p.M > maxM) (maxM = p.M), (xMaxM = p.x);
    if (p.M < minM) (minM = p.M), (xMinM = p.x);
    if (Math.abs(p.V) > Math.abs(maxV)) maxV = p.V;
    if (Math.abs(p.y) > Math.abs(maxY)) (maxY = p.y), (xMaxY = p.x);
  }
  const totalLoad = points.reduce((s, p) => s + p.P, 0) + udls.reduce((s, w) => s + ((w.w1 + w.w2) / 2) * (w.x2 - w.x1), 0);
  return { pts, reactions, maxM, minM, xMaxM, xMinM, maxV, maxY, xMaxY, totalLoad, slope: (i) => u[2 * i + 1] };
}

/** Supports and loads of the simple beam calculator, in the builder's item format. */
export function simpleBeamItems({ support, load, L, a, P, w }) {
  const items = [];
  if (support === "ss") items.push({ kind: "pin", x: 0 }, { kind: "roller", x: L });
  if (support === "cant") items.push({ kind: "fixed", x: 0 });
  if (support === "fixed") items.push({ kind: "fixed", x: 0 }, { kind: "fixed", x: L });
  if (load === "point") items.push({ kind: "point", x: a, P: P ?? 1 });
  else items.push({ kind: "udl", x1: 0, x2: L, w1: w ?? 1, w2: w ?? 1 });
  return items;
}

