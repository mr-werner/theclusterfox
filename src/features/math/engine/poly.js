// Polynomials in one variable with exact rational coefficients.
// A polynomial is an array of Frac, index = power: [c0, c1, c2, ...].

import { Frac, gcd, lcm } from "./frac.js";
import { add, freeVars, isSym, mul, num, pow, sym } from "./expr.js";
import { expand, simplify } from "./simplify.js";

const F = v => Frac.from(v);

export function trim(p) {
  const q = [...p];
  while (q.length > 1 && q[q.length - 1].isZero()) q.pop();
  return q.length ? q : [F(0)];
}

export const degree = p => trim(p).length - 1;
export const lead = p => trim(p)[degree(p)];
export const isZeroPoly = p => trim(p).every(c => c.isZero());

// Read an expression as a polynomial in v. Returns null if it is not one.
export function polyFrom(e, v, { expandFirst = true } = {}) {
  let ex;
  try {
    ex = expandFirst ? expand(e) : simplify(e);
  } catch {
    return null;
  }
  const out = [];
  const put = (k, c) => {
    if (k > 60) throw new Error("degree");
    while (out.length <= k) out.push(F(0));
    out[k] = out[k].add(c);
  };
  const termOf = t => {
    if (t.t === "num") return [0, t.v];
    if (isSym(t, v)) return [1, F(1)];
    if (t.t === "pow" && isSym(t.b, v) && t.e.t === "num" && t.e.v.isInt() && t.e.v.n >= 0) return [t.e.v.n, F(1)];
    if (t.t === "mul") {
      let k = 0;
      let c = F(1);
      for (const f of t.a) {
        const r = termOf(f);
        if (!r) return null;
        k += r[0];
        c = c.mul(r[1]);
      }
      return [k, c];
    }
    return null;
  };
  try {
    const terms = ex.t === "add" ? ex.a : [ex];
    for (const t of terms) {
      const r = termOf(t);
      if (!r) return null;
      put(r[0], r[1]);
    }
  } catch {
    return null;
  }
  return trim(out.length ? out : [F(0)]);
}

export function polyToExpr(p, v) {
  const terms = [];
  const x = sym(v);
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k];
    if (c.isZero()) continue;
    const xp = k === 0 ? null : k === 1 ? x : pow(x, num(k));
    if (!xp) terms.push(num(c));
    else if (c.isOne()) terms.push(xp);
    else terms.push(mul(num(c), xp));
  }
  if (!terms.length) return num(0);
  return terms.length === 1 ? terms[0] : add(terms);
}

export function polyEval(p, x) {
  let r = F(0);
  for (let k = p.length - 1; k >= 0; k--) r = r.mul(x).add(p[k]);
  return r;
}

export function polyEvalNum(p, x) {
  let r = 0;
  for (let k = p.length - 1; k >= 0; k--) r = r * x + p[k].valueOf();
  return r;
}

export function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  return trim(Array.from({ length: n }, (_, i) => (a[i] ?? F(0)).add(b[i] ?? F(0))));
}
export const polyScale = (a, c) => trim(a.map(x => x.mul(c)));
export const polySub = (a, b) => polyAdd(a, polyScale(b, F(-1)));
export function polyMul(a, b) {
  const out = Array.from({ length: a.length + b.length - 1 }, () => F(0));
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = out[i + j].add(x.mul(y)))));
  return trim(out);
}

export function polyDiv(a, b) {
  a = trim(a);
  b = trim(b);
  if (isZeroPoly(b)) throw new Error("Division by zero polynomial");
  let r = [...a];
  const db = degree(b);
  const q = Array.from({ length: Math.max(1, degree(a) - db + 1) }, () => F(0));
  while (!isZeroPoly(r) && degree(r) >= db) {
    const k = degree(r) - db;
    const c = lead(r).div(lead(b));
    q[k] = c;
    r = polySub(r, polyMul(Array.from({ length: k + 1 }, (_, i) => (i === k ? c : F(0))), b));
  }
  return { q: trim(q), r: trim(r) };
}

export function polyDeriv(p) {
  if (p.length <= 1) return [F(0)];
  return trim(p.slice(1).map((c, i) => c.mul(i + 1)));
}

export function polyGcd(a, b) {
  a = trim(a);
  b = trim(b);
  while (!isZeroPoly(b)) {
    const { r } = polyDiv(a, b);
    a = b;
    b = r;
  }
  return polyScale(a, lead(a).inv());
}

// Multiply through so every coefficient is an integer with no common factor.
export function integerize(p) {
  const L = p.reduce((m, c) => lcm(m, c.d), 1);
  let ints = p.map(c => c.mul(L).valueOf());
  const g = ints.reduce((m, c) => gcd(m, c), 0) || 1;
  ints = ints.map(c => c / g);
  return { ints, scale: new Frac(L, g) };
}

function divisors(n) {
  n = Math.abs(n);
  if (n === 0) return [];
  if (n > 1e7) return [1];
  const out = [];
  for (let i = 1; i * i <= n; i++)
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  return out.sort((a, b) => a - b);
}

export function rationalCandidates(p) {
  const { ints } = integerize(trim(p));
  let lo = 0;
  while (ints[lo] === 0) lo++;
  const a0 = ints[lo];
  const an = ints[ints.length - 1];
  const out = new Map();
  for (const pp of divisors(a0))
    for (const qq of divisors(an))
      for (const s of [1, -1]) {
        const f = new Frac(s * pp, qq);
        out.set(f.toString(), f);
      }
  return [...out.values()].sort((a, b) => Math.abs(a.valueOf()) - Math.abs(b.valueOf()) || a.valueOf() - b.valueOf());
}

// Pull out every rational root. Returns { roots: [{r, mult}], rest } where rest has no rational roots.
export function rationalRoots(p) {
  let rest = trim(p);
  const roots = [];
  const push = r => {
    const hit = roots.find(x => x.r.eq(r));
    if (hit) hit.mult++;
    else roots.push({ r, mult: 1 });
  };
  while (degree(rest) > 0 && rest[0].isZero()) {
    push(F(0));
    rest = trim(rest.slice(1));
  }
  let found = true;
  while (found && degree(rest) > 0) {
    found = false;
    for (const c of rationalCandidates(rest)) {
      if (polyEval(rest, c).isZero()) {
        push(c);
        rest = polyDiv(rest, [c.neg(), F(1)]).q;
        found = true;
        break;
      }
    }
  }
  roots.sort((a, b) => a.r.cmp(b.r));
  return { roots, rest };
}

// Numeric roots of a polynomial (real ones), by Durand–Kerner, polished with Newton.
export function numericRoots(p) {
  const c = trim(p).map(x => x.valueOf());
  const n = c.length - 1;
  if (n < 1) return [];
  const a = c.map(x => x / c[n]);
  let zs = Array.from({ length: n }, (_, k) => {
    const ang = (2 * Math.PI * k) / n + 0.4;
    const r = 1 + Math.max(...a.slice(0, n).map(Math.abs));
    return [r * Math.cos(ang) * 0.5, r * Math.sin(ang) * 0.5];
  });
  const cmul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const cdiv = (x, y) => {
    const d = y[0] * y[0] + y[1] * y[1] || 1e-300;
    return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d];
  };
  const evalc = z => {
    let r = [1, 0];
    for (let k = n - 1; k >= 0; k--) r = [r[0] * z[0] - r[1] * z[1] + a[k], r[0] * z[1] + r[1] * z[0]];
    return r;
  };
  // evaluate monic polynomial: start with leading 1
  const evalMonic = z => {
    let r = [1, 0];
    for (let k = n - 1; k >= 0; k--) {
      r = cmul(r, z);
      r[0] += a[k];
    }
    return r;
  };
  void evalc;
  for (let it = 0; it < 500; it++) {
    let delta = 0;
    zs = zs.map((z, i) => {
      let den = [1, 0];
      zs.forEach((w, j) => {
        if (i !== j) den = cmul(den, [z[0] - w[0], z[1] - w[1]]);
      });
      const step = cdiv(evalMonic(z), den);
      delta = Math.max(delta, Math.hypot(step[0], step[1]));
      return [z[0] - step[0], z[1] - step[1]];
    });
    if (delta < 1e-14) break;
  }
  const dp = polyDeriv(trim(p)).map(x => x.valueOf());
  const f = x => c.reduceRight((s, k) => s * x + k, 0);
  const df = x => dp.reduceRight((s, k) => s * x + k, 0);
  const real = [];
  const complex = [];
  for (const z of zs) {
    const scale = Math.max(1, Math.hypot(z[0], z[1]));
    if (Math.abs(z[1]) < 1e-7 * scale) {
      let x = z[0];
      for (let i = 0; i < 30; i++) {
        const d = df(x);
        if (!d) break;
        const nx = x - f(x) / d;
        if (!Number.isFinite(nx)) break;
        if (Math.abs(nx - x) < 1e-15 * Math.max(1, Math.abs(x))) {
          x = nx;
          break;
        }
        x = nx;
      }
      real.push(x);
    } else complex.push(z);
  }
  real.sort((x, y) => x - y);
  const merged = [];
  for (const x of real) if (!merged.length || Math.abs(merged[merged.length - 1] - x) > 1e-7 * Math.max(1, Math.abs(x))) merged.push(x);
  return { real: merged, complex };
}

export const polyVars = e => [...freeVars(e)];
