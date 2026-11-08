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

/** Section properties. Dimensions in metres. */
export function section(shape, d) {
  const out = (A, Ix, Iy, cx, cy, J) => ({ A, Ix, Iy, Sx: Ix / cy, Sy: Iy / cx, rx: Math.sqrt(Ix / A), ry: Math.sqrt(Iy / A), J });
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
      const di = d.D - 2 * d.t;
      const I = (Math.PI * (d.D ** 4 - di ** 4)) / 64;
      return out((Math.PI * (d.D ** 2 - di ** 2)) / 4, I, I, d.D / 2, d.D / 2, 2 * I);
    }
    case "rhs": {
      const { B, H, t } = d;
      const bi = B - 2 * t, hi = H - 2 * t;
      const Am = (B - t) * (H - t);
      const J = (4 * Am * Am * t) / (2 * (B - t + H - t));
      return out(B * H - bi * hi, (B * H ** 3 - bi * hi ** 3) / 12, (H * B ** 3 - hi * bi ** 3) / 12, B / 2, H / 2, J);
    }
    case "ibeam": {
      const { b, h, tf, tw } = d;
      const hw = h - 2 * tf;
      const A = 2 * b * tf + hw * tw;
      const Ix = (b * h ** 3 - (b - tw) * hw ** 3) / 12;
      const Iy = (2 * tf * b ** 3) / 12 + (hw * tw ** 3) / 12;
      const J = (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3;
      return out(A, Ix, Iy, b / 2, h / 2, J);
    }
    default:
      return null;
  }
}
