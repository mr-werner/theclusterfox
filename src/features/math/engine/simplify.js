// Simplification and expansion of expression trees.

import { Frac, exactRoot, extractRoot } from "./frac.js";
import { add, fn, freeVars, isNum, isSym, key, mul, num, pow, PI, sym } from "./expr.js";

const HALF = new Frac(1, 2);

export function splitCoef(t) {
  if (t.t === "num") return [t.v, null];
  if (t.t === "mul" && t.a[0]?.t === "num") {
    const rest = t.a.slice(1);
    return [t.a[0].v, rest.length === 1 ? rest[0] : mul(rest)];
  }
  return [new Frac(1), t];
}

export function withCoef(c, rest) {
  if (!rest) return num(c);
  if (c.isZero()) return num(0);
  if (c.isOne()) return rest;
  if (rest.t === "mul") return mul(num(c), ...rest.a);
  return mul(num(c), rest);
}

// ---- term ordering: highest power of the main variable first ----

export function degreeIn(e, v) {
  switch (e.t) {
    case "sym":
      return e.n === v ? 1 : 0;
    case "num":
      return 0;
    case "mul":
      return e.a.reduce((s, f) => s + degreeIn(f, v), 0);
    case "pow":
      if (isSym(e.b, v) && e.e.t === "num") return e.e.v.valueOf();
      return freeVars(e).has(v) ? 0.5 : 0;
    default:
      return freeVars(e).has(v) ? 0.5 : 0;
  }
}

function totalDegree(e) {
  return [...freeVars(e)].reduce((s, v) => s + degreeIn(e, v), 0);
}

export function mainVar(e) {
  const vs = [...freeVars(e)].sort();
  return vs.includes("x") ? "x" : vs[0];
}

export function sortTerms(terms, v) {
  return [...terms].sort((a, b) => {
    const ca = a.t === "num" ? 1 : 0;
    const cb = b.t === "num" ? 1 : 0;
    if (v) {
      const d = degreeIn(b, v) - degreeIn(a, v);
      if (d) return d;
    }
    if (ca !== cb) return ca - cb;
    const td = totalDegree(b) - totalDegree(a);
    if (td) return td;
    const ka = key(splitCoef(a)[1] ?? a);
    const kb = key(splitCoef(b)[1] ?? b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function factorRank(f) {
  if (f.t === "pow" && f.b.t === "num") return 0;
  if (f.t === "pow" && f.e.t !== "num") return 2;
  if (f.t === "sym" || (f.t === "pow" && f.b.t === "sym")) return 1;
  if (f.t === "fn" || (f.t === "pow" && f.b.t === "fn")) return 2;
  if (f.t === "pow" && f.e.t !== "num") return 2;
  return 3;
}

function sortFactors(fs) {
  return [...fs].sort((a, b) => {
    const r = factorRank(a) - factorRank(b);
    if (r) return r;
    // negative powers (denominators) last within their rank
    const na = a.t === "pow" && a.e.t === "num" && a.e.v.sign < 0 ? 1 : 0;
    const nb = b.t === "pow" && b.e.t === "num" && b.e.v.sign < 0 ? 1 : 0;
    if (na !== nb) return na - nb;
    const ka = key(a.t === "pow" ? a.b : a);
    const kb = key(b.t === "pow" ? b.b : b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// ---- the simplifier ----

export function simplify(e) {
  switch (e.t) {
    case "add":
      return simpAdd(e.a.map(simplify));
    case "mul":
      return simpMul(e.a.map(simplify));
    case "pow":
      return simpPow(simplify(e.b), simplify(e.e));
    case "fn":
      return simpFn(e.n, simplify(e.a));
    default:
      return e;
  }
}

function simpAdd(terms) {
  const flat = [];
  for (const t of terms) (t.t === "add" ? flat.push(...t.a) : flat.push(t));
  let constant = new Frac(0);
  const groups = new Map();
  for (const t of flat) {
    const [c, rest] = splitCoef(t);
    if (!rest) {
      constant = constant.add(c);
      continue;
    }
    const k = key(rest);
    const g = groups.get(k);
    if (g) g.c = g.c.add(c);
    else groups.set(k, { c, rest });
  }
  const out = [];
  for (const { c, rest } of groups.values()) if (!c.isZero()) out.push(withCoef(c, rest));
  if (!constant.isZero()) out.push(num(constant));
  if (!out.length) return num(0);
  if (out.length === 1) return out[0];
  return add(sortTerms(out, mainVar(add(out))));
}

function simpMul(factors) {
  const flat = [];
  for (const f of factors) (f.t === "mul" ? flat.push(...f.a) : flat.push(f));
  let coef = new Frac(1);
  const groups = new Map();
  const order = [];
  for (const f of flat) {
    if (f.t === "num") {
      coef = coef.mul(f.v);
      continue;
    }
    const base = f.t === "pow" ? f.b : f;
    const ex = f.t === "pow" ? f.e : num(1);
    const k = key(base);
    if (groups.has(k)) groups.get(k).exps.push(ex);
    else {
      groups.set(k, { base, exps: [ex] });
      order.push(k);
    }
  }
  if (coef.isZero()) return num(0);
  const out = [];
  for (const k of order) {
    const { base, exps } = groups.get(k);
    const ex = exps.length === 1 ? exps[0] : simplify(add(exps));
    const f = exps.length === 1 && !(base.t === "num") ? (isNum(ex, 1) ? base : pow(base, ex)) : simpPow(base, ex);
    if (f.t === "num") coef = coef.mul(f.v);
    else if (f.t === "mul") {
      for (const g of f.a) (g.t === "num" ? (coef = coef.mul(g.v)) : out.push(g));
    } else out.push(f);
  }
  if (coef.isZero()) return num(0);
  if (!out.length) return num(coef);
  const sorted = sortFactors(out);
  if (coef.isOne()) return sorted.length === 1 ? sorted[0] : mul(sorted);
  return mul(num(coef), ...sorted);
}

function numPow(b, x) {
  // b, x are Fracs
  if (x.isInt()) return num(b.pow(x.n));
  const { n: p, d: q } = x;
  if (b.sign < 0) {
    if (q % 2 === 0) return null;
    const r = numPow(b.neg(), x);
    if (!r) return null;
    return p % 2 ? simplify(mul(num(-1), r)) : r;
  }
  if (b.d !== 1) {
    const top = numPow(new Frac(b.n), x) ?? pow(num(b.n), num(x));
    const bottom = numPow(new Frac(b.d), x.neg()) ?? pow(num(b.d), num(x.neg()));
    return simpMul([top, bottom]);
  }
  const n = b.n;
  if (n === 0) return x.sign > 0 ? num(0) : null;
  const root = exactRoot(n, q);
  if (root !== null) return num(new Frac(root).pow(p));
  if (Math.abs(p) >= q) {
    const k = Math.trunc(p / q);
    const r = p - k * q;
    return simpMul([num(new Frac(n).pow(k)), numPow(new Frac(n), new Frac(r, q)) ?? pow(num(n), num(new Frac(r, q)))]);
  }
  const { outside, inside } = extractRoot(n, q);
  if (outside > 1) {
    const rad = pow(num(inside), num(new Frac(p > 0 ? 1 : -1, q)));
    return mul(num(p > 0 ? new Frac(outside) : new Frac(1, outside)), rad);
  }
  return pow(num(n), num(x));
}

export function simpPow(b, x) {
  if (isNum(x, 0)) return num(1);
  if (isNum(x, 1)) return b;
  if (isNum(b, 1)) return num(1);
  if (isNum(b, 0) && x.t === "num" && x.v.sign > 0) return num(0);
  if (b.t === "num" && x.t === "num") {
    try {
      return numPow(b.v, x.v) ?? pow(b, x);
    } catch {
      return pow(b, x);
    }
  }
  if (b.t === "pow") {
    if (x.t === "num" && x.v.isInt()) return simpPow(b.b, simplify(mul(b.e, x)));
    if (b.e.t === "num" && x.t === "num") {
      const prod = b.e.v.mul(x.v);
      const evenInt = b.e.v.isInt() && b.e.v.n % 2 === 0;
      if (evenInt && !(prod.isInt() && prod.n % 2 === 0) && !(b.b.t === "num" && b.b.v.sign > 0))
        return simpPow(fn("abs", b.b), num(prod));
      return simpPow(b.b, num(prod));
    }
  }
  if (b.t === "mul") {
    if (x.t === "num" && x.v.isInt()) return simpMul(b.a.map(f => simpPow(f, x)));
    if (b.a[0].t === "num" && b.a[0].v.sign > 0) {
      const rest = b.a.length === 2 ? b.a[1] : mul(b.a.slice(1));
      return simpMul([simpPow(b.a[0], x), pow(rest, x)]);
    }
  }
  if (isSym(b, "e")) {
    if (x.t === "fn" && x.n === "ln") return x.a;
    if (x.t === "mul" && x.a.length === 2 && x.a[0].t === "num" && x.a[1].t === "fn" && x.a[1].n === "ln")
      return simpPow(x.a[1].a, x.a[0]);
  }
  if (b.t === "fn" && b.n === "abs" && x.t === "num" && x.v.isInt() && x.v.n % 2 === 0) return simpPow(b.a, x);
  return pow(b, x);
}

// q·π for a rational q, if the argument has that shape.
function piMultiple(a) {
  if (isNum(a, 0)) return new Frac(0);
  if (isSym(a, "pi")) return new Frac(1);
  if (a.t === "mul" && a.a.length === 2 && a.a[0].t === "num" && isSym(a.a[1], "pi")) return a.a[0].v;
  return null;
}

const SQRT2_2 = () => mul(num(HALF), pow(num(2), num(HALF)));
const SQRT3_2 = () => mul(num(HALF), pow(num(3), num(HALF)));

function exactSin(q) {
  // q in units of π
  let r = new Frac(((q.n % (2 * q.d)) + 2 * q.d) % (2 * q.d), q.d); // [0, 2)
  let sign = 1;
  if (r.cmp(1) > 0) {
    r = r.sub(1);
    sign = -1;
  }
  if (r.cmp(HALF) > 0) r = new Frac(1).sub(r);
  const table = { "0": () => num(0), "1/6": () => num(HALF), "1/4": SQRT2_2, "1/3": SQRT3_2, "1/2": () => num(1) };
  const f = table[r.toString()];
  if (!f) return null;
  return sign < 0 ? simplify(mul(num(-1), f())) : f();
}

const INVERSE = {
  asin: { "0": [0, 1], "1/2": [1, 6], "1": [1, 2], "-1/2": [-1, 6], "-1": [-1, 2] },
  acos: { "1": [0, 1], "1/2": [1, 3], "0": [1, 2], "-1/2": [2, 3], "-1": [1, 1] },
  atan: { "0": [0, 1], "1": [1, 4], "-1": [-1, 4] },
};

export function simpFn(n, a) {
  switch (n) {
    case "ln":
      if (isNum(a, 1)) return num(0);
      if (isSym(a, "e")) return num(1);
      if (a.t === "pow" && isSym(a.b, "e")) return a.e;
      break;
    case "log":
      if (a.t === "num" && a.v.isInt() && a.v.n > 0) {
        const k = Math.log10(a.v.n);
        if (Number.isInteger(k) && 10 ** k === a.v.n) return num(k);
      }
      if (a.t === "num" && a.v.n === 1 && a.v.d > 1) {
        const k = Math.log10(a.v.d);
        if (Number.isInteger(k) && 10 ** k === a.v.d) return num(-k);
      }
      break;
    case "sin":
    case "cos":
    case "tan": {
      const q = piMultiple(a);
      if (q) {
        const s = exactSin(q);
        const c = exactSin(q.add(HALF));
        if (n === "sin" && s) return s;
        if (n === "cos" && c) return c;
        if (n === "tan" && s && c && !isNum(c, 0)) return simplify(mul(s, pow(c, num(-1))));
      }
      break;
    }
    case "asin":
    case "acos":
    case "atan":
      if (a.t === "num") {
        const hit = INVERSE[n][a.v.toString()];
        if (hit) return hit[0] === 0 ? num(0) : simplify(mul(num(new Frac(hit[0], hit[1])), PI));
      }
      break;
    case "sinh":
    case "tanh":
      if (isNum(a, 0)) return num(0);
      break;
    case "cosh":
      if (isNum(a, 0)) return num(1);
      break;
    case "abs":
      if (a.t === "num") return num(a.v.abs());
      if (a.t === "fn" && a.n === "abs") return a;
      if (a.t === "pow" && a.e.t === "num" && a.e.v.isInt() && a.e.v.n % 2 === 0) return a;
      break;
    case "fact":
      if (a.t === "num" && a.v.isInt() && a.v.n >= 0 && a.v.n <= 18) {
        let r = 1;
        for (let i = 2; i <= a.v.n; i++) r *= i;
        return num(r);
      }
      break;
  }
  return fn(n, a);
}

// ---- expansion ----

const MAX_TERMS = 1500;

function distribute(factors) {
  let terms = [[]];
  for (const f of factors) {
    const parts = f.t === "add" ? f.a : [f];
    const next = [];
    for (const t of terms) for (const p of parts) next.push([...t, p]);
    if (next.length > MAX_TERMS) throw new RangeError("That expands into too many terms");
    terms = next;
  }
  return simpAdd(terms.map(fs => simpMul(fs)));
}

export function expand(e) {
  switch (e.t) {
    case "add":
      return simpAdd(e.a.map(expand));
    case "mul": {
      const fs = e.a.map(expand);
      return fs.some(f => f.t === "add") ? distribute(fs) : simpMul(fs);
    }
    case "pow": {
      const b = expand(e.b);
      const x = simplify(e.e);
      if (b.t === "add" && x.t === "num" && x.v.isInt() && x.v.n >= 2 && x.v.n <= 12) {
        let acc = b;
        for (let i = 1; i < x.v.n; i++) acc = distribute([acc, b]);
        return acc;
      }
      return simpPow(b, x);
    }
    case "fn":
      return simpFn(e.n, simplify(e.a));
    default:
      return e;
  }
}

// Is the expression a polynomial-looking thing that expand would change?
export const fullySimplify = e => {
  const s = simplify(e);
  return s;
};

export { sym };
