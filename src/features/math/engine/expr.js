// Expression trees.
//   { t: "num", v: Frac }          exact rational
//   { t: "sym", n: "x" }           variable or constant (pi, e, i, inf)
//   { t: "add", a: [..] }          sum
//   { t: "mul", a: [..] }          product (division is a power of -1)
//   { t: "pow", b, e }             power (roots are fractional powers)
//   { t: "fn", n: "sin", a }       function of one argument
// Display-only nodes, never simplified:
//   { t: "d", a, v, k }            k-th derivative operator applied to a
//   { t: "int", a, v, lo, hi }     integral
//   { t: "eval", a, lo, hi }       [F]_lo^hi
//   { t: "pm", a, b }              a ± b
//   { t: "raw", tex }              literal TeX

import { Frac } from "./frac.js";

export const num = v => ({ t: "num", v: Frac.from(v) });
export const sym = n => ({ t: "sym", n });
export const add = (...a) => ({ t: "add", a: a.flat() });
export const mul = (...a) => ({ t: "mul", a: a.flat() });
export const pow = (b, e) => ({ t: "pow", b, e: typeof e === "number" ? num(e) : e });
export const fn = (n, a) => ({ t: "fn", n, a });
export const raw = tex => ({ t: "raw", tex });

export const ZERO_E = num(0);
export const ONE_E = num(1);
export const E = sym("e");
export const PI = sym("pi");

export const isNum = (e, v) => e?.t === "num" && (v === undefined || e.v.eq(v));
export const isSym = (e, n) => e?.t === "sym" && (n === undefined || e.n === n);

export function neg(e) {
  if (e.t === "num") return num(e.v.neg());
  if (e.t === "mul" && e.a[0]?.t === "num") {
    const c = e.a[0].v.neg();
    return c.isOne() && e.a.length === 2 ? e.a[1] : mul(num(c), ...e.a.slice(1));
  }
  return mul(num(-1), e);
}
export const sub = (a, b) => add(a, neg(b));
export function div(a, b) {
  if (a.t === "num" && b.t === "num" && !b.v.isZero()) return num(a.v.div(b.v));
  return mul(a, pow(b, num(-1)));
}
export const sqrt = a => pow(a, num(new Frac(1, 2)));

export const CONSTANTS = new Set(["pi", "e", "i", "inf"]);

// Canonical string, used for equality and grouping like terms.
export function key(e) {
  switch (e.t) {
    case "num":
      return e.v.toString();
    case "sym":
      return e.n;
    case "add":
      return `+(${e.a.map(key).sort().join(",")})`;
    case "mul":
      return `*(${e.a.map(key).sort().join(",")})`;
    case "pow":
      return `^(${key(e.b)},${key(e.e)})`;
    case "fn":
      return `${e.n}(${key(e.a)})`;
    default:
      return `${e.t}?`;
  }
}

export const same = (a, b) => key(a) === key(b);

export function freeVars(e, out = new Set()) {
  switch (e.t) {
    case "sym":
      if (!CONSTANTS.has(e.n)) out.add(e.n);
      break;
    case "add":
    case "mul":
      e.a.forEach(c => freeVars(c, out));
      break;
    case "pow":
      freeVars(e.b, out);
      freeVars(e.e, out);
      break;
    case "fn":
      freeVars(e.a, out);
      break;
  }
  return out;
}

export function depends(e, v) {
  switch (e.t) {
    case "sym":
      return e.n === v;
    case "add":
    case "mul":
      return e.a.some(c => depends(c, v));
    case "pow":
      return depends(e.b, v) || depends(e.e, v);
    case "fn":
      return depends(e.a, v);
    default:
      return false;
  }
}

export const hasFn = e =>
  e.t === "fn" || (e.a && Array.isArray(e.a) && e.a.some(hasFn)) || (e.t === "pow" && (hasFn(e.b) || hasFn(e.e)));

// Replace every occurrence of `target` (an expression, or a variable name) with `by`.
export function substitute(e, target, by) {
  const tk = typeof target === "string" ? target : key(target);
  const walk = n => {
    if (typeof target === "string" ? n.t === "sym" && n.n === target : key(n) === tk) return by;
    switch (n.t) {
      case "add":
        return add(n.a.map(walk));
      case "mul":
        return mul(n.a.map(walk));
      case "pow":
        return pow(walk(n.b), walk(n.e));
      case "fn":
        return fn(n.n, walk(n.a));
      default:
        return n;
    }
  };
  return walk(e);
}

export function size(e) {
  switch (e.t) {
    case "add":
    case "mul":
      return 1 + e.a.reduce((s, c) => s + size(c), 0);
    case "pow":
      return 1 + size(e.b) + size(e.e);
    case "fn":
      return 1 + size(e.a);
    default:
      return 1;
  }
}

// ---------- numeric evaluation ----------

const FN = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: x => 1 / Math.cos(x),
  csc: x => 1 / Math.sin(x),
  cot: x => 1 / Math.tan(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  abs: Math.abs,
  fact: x => (Number.isInteger(x) && x >= 0 && x <= 170 ? Array.from({ length: x }, (_, i) => i + 1).reduce((p, k) => p * k, 1) : NaN),
};
export const FUNCTIONS = Object.keys(FN);

function npow(b, e) {
  if (b < 0 && !Number.isInteger(e)) {
    // Real odd roots of negatives: (-8)^(1/3) = -2
    const inv = 1 / e;
    const r = Math.round(inv);
    if (Math.abs(inv - r) < 1e-9 && r % 2) return -((-b) ** e);
    return NaN;
  }
  return b ** e;
}

// Compile to a fast JS function of an environment object.
export function compile(e) {
  switch (e.t) {
    case "num": {
      const v = e.v.valueOf();
      return () => v;
    }
    case "sym": {
      const n = e.n;
      if (n === "pi") return () => Math.PI;
      if (n === "e") return () => Math.E;
      if (n === "inf") return () => Infinity;
      if (n === "i") return () => NaN;
      return env => (n in env ? env[n] : NaN);
    }
    case "add": {
      const fs = e.a.map(compile);
      return env => {
        let s = 0;
        for (const f of fs) s += f(env);
        return s;
      };
    }
    case "mul": {
      const fs = e.a.map(compile);
      return env => {
        let s = 1;
        for (const f of fs) s *= f(env);
        return s;
      };
    }
    case "pow": {
      const b = compile(e.b);
      const x = compile(e.e);
      return env => npow(b(env), x(env));
    }
    case "fn": {
      const f = FN[e.n];
      const a = compile(e.a);
      if (!f) return () => NaN;
      return env => f(a(env));
    }
    default:
      return () => NaN;
  }
}

export const evaluate = (e, env = {}) => compile(e)(env);

// f(x) for one variable.
export function fn1(e, v) {
  const f = compile(e);
  return x => f({ [v]: x });
}
