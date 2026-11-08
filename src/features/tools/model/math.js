// Small numeric helpers shared by the calculators.

/** Linear interpolation in a table sorted by x; clamps at the ends. */
export function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1;
  while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
}

/** Root by bisection between lo and hi, where f(lo) and f(hi) have opposite signs. */
export function bisect(f, lo, hi, tol = 1e-10, max = 200) {
  let flo = f(lo);
  for (let i = 0; i < max; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < tol || (hi - lo) / 2 < tol) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Darcy friction factor. Laminar: 64/Re. Otherwise Colebrook–White, solved iteratively. */
export function frictionFactor(Re, relRough) {
  if (!(Re > 0)) return NaN;
  if (Re < 2300) return 64 / Re;
  // Start from Swamee–Jain and refine Colebrook.
  let f = 0.25 / Math.log10(relRough / 3.7 + 5.74 / Re ** 0.9) ** 2;
  for (let i = 0; i < 50; i++) {
    const next = 1 / (-2 * Math.log10(relRough / 3.7 + 2.51 / (Re * Math.sqrt(f)))) ** 2;
    if (Math.abs(next - f) < 1e-12) return next;
    f = next;
  }
  return f;
}

export const flowRegime = (Re) => (Re < 2300 ? "Laminar" : Re < 4000 ? "Transitional" : "Turbulent");

export const circleArea = (d) => (Math.PI * d * d) / 4;
