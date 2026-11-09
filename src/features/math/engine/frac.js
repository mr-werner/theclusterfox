// Exact rational numbers. Numerator and denominator stay safe integers;
// anything that would overflow throws, and callers fall back to decimals.

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

export const lcm = (a, b) => (a && b ? Math.abs((a / gcd(a, b)) * b) : 0);

export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error("Division by zero");
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new RangeError("Number too large for exact work");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g || 0; // avoid -0
    this.d = d / g;
  }

  static from(v) {
    if (v instanceof Frac) return v;
    if (typeof v === "string") return Frac.parse(v);
    if (Number.isInteger(v)) return new Frac(v);
    return Frac.parse(String(v));
  }

  // "0.125" -> 1/8, "1e3" -> 1000
  static parse(s) {
    const m = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s.trim());
    if (!m) throw new Error(`Not a number: ${s}`);
    const [, sign, int = "", dec = "", exp = "0"] = m;
    let n = Number((int || "0") + dec);
    let d = 10 ** dec.length;
    const e = Number(exp);
    if (e > 0) n *= 10 ** e;
    else if (e < 0) d *= 10 ** -e;
    return new Frac(sign ? -n : n, d);
  }

  add(o) {
    o = Frac.from(o);
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o) {
    o = Frac.from(o);
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o) {
    o = Frac.from(o);
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o) {
    o = Frac.from(o);
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Frac(-this.n, this.d);
  }
  inv() {
    return new Frac(this.d, this.n);
  }
  abs() {
    return new Frac(Math.abs(this.n), this.d);
  }
  pow(k) {
    if (!Number.isInteger(k)) throw new Error("Fraction powers need whole exponents");
    if (Math.abs(k) > 200) throw new RangeError("Exponent too large");
    let r = new Frac(1);
    const base = k < 0 ? this.inv() : this;
    for (let i = 0; i < Math.abs(k); i++) r = r.mul(base);
    return r;
  }
  cmp(o) {
    o = Frac.from(o);
    return Math.sign(this.n * o.d - o.n * this.d);
  }
  eq(o) {
    o = Frac.from(o);
    return this.n === o.n && this.d === o.d;
  }
  get sign() {
    return Math.sign(this.n);
  }
  isZero() {
    return this.n === 0;
  }
  isOne() {
    return this.n === 1 && this.d === 1;
  }
  isInt() {
    return this.d === 1;
  }
  valueOf() {
    return this.n / this.d;
  }
  toString() {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
}

export const ZERO = new Frac(0);
export const ONE = new Frac(1);

// Integer k-th root if exact, else null.
export function exactRoot(n, k) {
  if (n < 0) return k % 2 ? (exactRoot(-n, k) === null ? null : -exactRoot(-n, k)) : null;
  const r = Math.round(n ** (1 / k));
  for (const c of [r - 1, r, r + 1]) if (c >= 0 && c ** k === n) return c;
  return null;
}

// sqrt-style simplification: n = outside^k * inside, with inside k-th-power free.
export function extractRoot(n, k) {
  let outside = 1;
  let inside = n;
  if (n > 1e12) return { outside, inside };
  for (let f = 2; f ** k <= inside; f++) {
    const p = f ** k;
    while (inside % p === 0) {
      inside /= p;
      outside *= f;
    }
  }
  return { outside, inside };
}

// Short readable decimal.
export function fmtNum(v, digits = 10) {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "-∞" : "undefined";
  if (Math.abs(v) < 1e-12) return "0";
  const a = Math.abs(v);
  if (a >= 1e12 || a < 1e-6) return v.toExponential(4).replace(/\.?0+e/, "e");
  return String(Number(v.toPrecision(digits)));
}
