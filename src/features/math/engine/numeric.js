// Numeric helpers: root finding, extrema, and recognizing tidy values.

import { fmtNum } from "./frac.js";

function bisect(f, a, b, fa) {
  for (let i = 0; i < 100; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) return null;
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
    if (Math.abs(b - a) < 1e-13 * Math.max(1, Math.abs(m))) break;
  }
  return (a + b) / 2;
}

function golden(g, a, b) {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  for (let i = 0; i < 80; i++) {
    if (g(c) < g(d)) b = d;
    else a = c;
    c = b - r * (b - a);
    d = a + r * (b - a);
  }
  return (a + b) / 2;
}

// Real roots of f on [a, b]. Catches sign changes and touching roots, skips asymptotes.
export function findRoots(f, a = -50, b = 50, n = 4000) {
  const xs = [];
  const h = (b - a) / n;
  let px = a;
  let py = f(a);
  const out = [];
  const push = x => {
    if (!out.some(r => Math.abs(r - x) < 1e-6 * Math.max(1, Math.abs(x)))) out.push(x);
  };
  if (py === 0) push(a);
  let ppy = NaN;
  for (let i = 1; i <= n; i++) {
    const x = a + i * h;
    const y = f(x);
    if (Number.isFinite(y) && Number.isFinite(py)) {
      if (y === 0) push(x);
      else if (Math.sign(y) !== Math.sign(py) && py !== 0) {
        const r = bisect(f, px, x, py);
        // reject sign changes across a pole
        if (r !== null && Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(py), Math.abs(y))) push(r);
      } else if (Number.isFinite(ppy) && Math.abs(py) < Math.abs(ppy) && Math.abs(py) < Math.abs(y)) {
        // local minimum of |f|: maybe a touching root
        const m = golden(t => Math.abs(f(t)), px - h, x);
        const fm = f(m);
        if (Number.isFinite(fm) && Math.abs(fm) < 1e-9) push(m);
      }
    }
    ppy = py;
    px = x;
    py = y;
    xs.push(x);
  }
  return out.sort((p, q) => p - q).map(x => (Math.abs(x) < 1e-11 ? 0 : x));
}

// Local maxima and minima of f on [a, b].
export function findExtrema(f, a, b, n = 1200) {
  const h = (b - a) / n;
  const out = [];
  let y0 = f(a);
  let y1 = f(a + h);
  for (let i = 2; i <= n; i++) {
    const x2 = a + i * h;
    const y2 = f(x2);
    if ([y0, y1, y2].every(Number.isFinite)) {
      const isMax = y1 > y0 && y1 >= y2;
      const isMin = y1 < y0 && y1 <= y2;
      if (isMax || isMin) {
        const g = isMax ? t => -f(t) : f;
        const x = golden(g, x2 - 2 * h, x2);
        const y = f(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e12) out.push({ x, y, kind: isMax ? "max" : "min" });
      }
    }
    y0 = y1;
    y1 = y2;
  }
  return out;
}

// Adaptive Simpson for definite integrals.
export function integrateNumeric(f, a, b) {
  const simpson = (a, b, fa, fm, fb) => ((b - a) / 6) * (fa + 4 * fm + fb);
  const rec = (a, b, fa, fm, fb, whole, eps, depth) => {
    const m = (a + b) / 2;
    const lm = (a + m) / 2;
    const rm = (m + b) / 2;
    const flm = f(lm);
    const frm = f(rm);
    const left = simpson(a, m, fa, flm, fm);
    const right = simpson(m, b, fm, frm, fb);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps) return left + right + (left + right - whole) / 15;
    return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
  };
  const fa = f(a);
  const fb = f(b);
  const fm = f((a + b) / 2);
  return rec(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), 1e-10, 40);
}

// Try to name a decimal exactly: 0.5 -> "1/2", 1.4142.. -> "√2", 3.14159 -> "π".
export function recognize(v, tol = 1e-9) {
  if (!Number.isFinite(v)) return null;
  const close = (a, b) => Math.abs(a - b) < tol * Math.max(1, Math.abs(b));
  for (let d = 1; d <= 64; d++) {
    const n = Math.round(v * d);
    if (close(v, n / d)) return { tex: d === 1 ? String(n) : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`, value: n / d };
  }
  const named = [
    [Math.PI, "\\pi"],
    [Math.E, "e"],
    [Math.SQRT2, "\\sqrt{2}"],
    [Math.sqrt(3), "\\sqrt{3}"],
    [Math.LN2, "\\ln 2"],
  ];
  for (const [c, t] of named)
    for (const d of [1, 2, 3, 4, 6]) {
      for (const k of [1, -1, 2, -2, 3, -3]) {
        if (close(v, (k * c) / d)) {
          const sign = k < 0 ? "-" : "";
          const kk = Math.abs(k) === 1 ? "" : String(Math.abs(k));
          return { tex: d === 1 ? `${sign}${kk}${t}` : `${sign}\\frac{${kk}${t}}{${d}}`, value: (k * c) / d };
        }
      }
    }
  return null;
}

export const approx = v => fmtNum(v, 8);
