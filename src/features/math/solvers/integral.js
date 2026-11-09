// Integrals with steps: basic rules, a table of standard forms, linear and
// general u-substitution, integration by parts, and rational functions
// (long division, partial fractions, arctangent). Every answer is checked by
// differentiating it numerically before it is shown.

import { Frac } from "../engine/frac.js";
import { add, compile, depends, div, fn, fn1, isNum, isSym, key, mul, neg, num, pow, size, substitute, sym, evaluate } from "../engine/expr.js";
import { expand, simplify } from "../engine/simplify.js";
import { tex } from "../engine/tex.js";
import { degree, polyDeriv, polyDiv, polyEval, polyFrom, polyToExpr, rationalRoots } from "../engine/poly.js";
import { integrateNumeric, recognize } from "../engine/numeric.js";
import { derivative } from "./derivative.js";
import { toRational } from "./equation.js";
import { S, dec, ft, result } from "./common.js";

const F = v => Frac.from(v);
const INT = (a, v, lo, hi) => ({ t: "int", a, v, lo, hi });
const HALF = new Frac(1, 2);

function tidy(e) {
  const s = simplify(e);
  try {
    const x = expand(s);
    if (tex(x).length < tex(s).length) return x;
  } catch {
    // keep s
  }
  return s;
}

export function integrate(e0, v, steps = [], depth = 0) {
  const X = sym(v);
  const linear = u => {
    const p = polyFrom(u, v);
    return p && degree(p) === 1 ? { a: p[1], b: p[0] } : null;
  };
  const I = (e, d) => {
    if (d > 7) return null;
    const e1 = simplify(e);
    const mark = steps.length;
    const fail = () => {
      steps.length = mark;
      return null;
    };
    const show = (text, res) => steps.push(S(text, `${tex(INT(e1, v))} = ${tex(res)}`));

    if (!depends(e1, v)) {
      const r = isNum(e1, 1) ? X : mul(e1, X);
      show("The integral of a constant $k$ is $k" + v + "$.", r);
      return r;
    }
    if (isSym(e1, v)) {
      const r = mul(num(HALF), pow(X, num(2)));
      show(`Power rule: $\\int ${v}^n\\,d${v} = \\frac{${v}^{n+1}}{n+1}$ with $n = 1$.`, r);
      return r;
    }
    if (e1.t === "add") {
      steps.push(S("Integrate term by term.", `${tex(INT(e1, v))} = ${tex(add(e1.a.map(t => INT(t, v))))}`));
      const parts = [];
      for (const t of e1.a) {
        const r = I(t, d + 1);
        if (!r) return fail();
        parts.push(r);
      }
      return simplify(add(parts));
    }
    if (e1.t === "mul") {
      const C = e1.a.filter(f => !depends(f, v));
      const G = e1.a.filter(f => depends(f, v));
      if (C.length) {
        const c = simplify(mul(C));
        const g = G.length === 1 ? G[0] : mul(G);
        steps.push(S("Pull the constant out of the integral.", `${tex(INT(e1, v))} = ${isNum(c, -1) ? "-" : tex(c)} ${tex(INT(g, v))}`));
        const r = I(g, d + 1);
        if (!r) return fail();
        return simplify(mul(c, r));
      }
    }
    if (e1.t === "pow" && isSym(e1.b, v) && !depends(e1.e, v)) {
      if (isNum(e1.e, -1)) {
        const r = fn("ln", fn("abs", X));
        show(`$\\int \\frac{1}{${v}}\\,d${v} = \\ln|${v}|$.`, r);
        return r;
      }
      const n1 = simplify(add(e1.e, num(1)));
      const r = simplify(mul(pow(n1, num(-1)), pow(X, n1)));
      const rootNote = isNum(e1.e) && !e1.e.v.isInt() ? ` Here $n = ${tex(e1.e)}$.` : "";
      show(`Power rule: $\\int ${v}^n\\,d${v} = \\frac{${v}^{n+1}}{n+1}$.${rootNote}`, r);
      return r;
    }

    const tab = table(e1);
    if (tab) {
      show(tab.text, tab.res);
      return tab.res;
    }

    const rat = rationalIntegral(e1, d);
    if (rat) return rat;
    steps.length = mark;

    // expand products and powers of polynomials
    if (e1.t === "mul" || (e1.t === "pow" && e1.b.t === "add")) {
      let ex;
      try {
        ex = expand(e1);
      } catch {
        ex = null;
      }
      if (ex && ex.t === "add" && tex(ex) !== tex(e1) && size(ex) < 120) {
        const inner = polyFrom(ex, v) || ex.a.every(t => !t.a || t.t !== "add");
        if (inner) {
          steps.push(S("Expand the integrand first.", `${tex(INT(e1, v))} = ${tex(INT(ex, v))}`));
          const r = I(ex, d + 1);
          if (r) return r;
          steps.length = mark;
        }
      }
    }

    const us = uSub(e1, d);
    if (us) return us;
    steps.length = mark;

    const bp = byParts(e1, d);
    if (bp) return bp;
    return fail();
  };

  // ---- standard forms, with a linear inner u = a·x + b ----
  const table = e => {
    const withLinear = (u, make, name) => {
      const l = linear(u);
      if (!l) return null;
      const res = simplify(mul(pow(num(l.a), num(-1)), make(u)));
      const plain = isSym(u, v);
      return {
        res,
        text: plain
          ? name
          : l.a.isOne()
            ? `${name.replace(/\.$/, "")}, with $u = ${tex(u)}$ (so $du = d${v}$).`
            : `${name.replace(/\.$/, "")}, with $u = ${tex(u)}$ and $du = ${ft(l.a)}\\,d${v}$, so divide by $${ft(l.a)}$.`,
      };
    };
    if (e.t === "pow" && !depends(e.e, v) && depends(e.b, v) && !isSym(e.b, v)) {
      if (isNum(e.e, -1)) return withLinear(e.b, u => fn("ln", fn("abs", u)), `$\\int \\frac{1}{u}\\,du = \\ln|u|$.`);
      const n1 = simplify(add(e.e, num(1)));
      const r = withLinear(e.b, u => mul(pow(n1, num(-1)), pow(u, n1)), `Power rule $\\int u^n\\,du = \\frac{u^{n+1}}{n+1}$.`);
      if (r) return r;
    }
    if (e.t === "pow" && !depends(e.b, v) && depends(e.e, v)) {
      const isE = isSym(e.b, "e");
      return withLinear(e.e, u => (isE ? pow(e.b, u) : mul(pow(e.b, u), pow(fn("ln", e.b), num(-1)))), isE ? `$\\int e^u\\,du = e^u$.` : `$\\int a^u\\,du = \\frac{a^u}{\\ln a}$.`);
    }
    if (e.t === "fn") {
      const T = {
        sin: [u => neg(fn("cos", u)), "$\\int \\sin u\\,du = -\\cos u$."],
        cos: [u => fn("sin", u), "$\\int \\cos u\\,du = \\sin u$."],
        tan: [u => neg(fn("ln", fn("abs", fn("cos", u)))), "$\\int \\tan u\\,du = -\\ln|\\cos u|$."],
        cot: [u => fn("ln", fn("abs", fn("sin", u))), "$\\int \\cot u\\,du = \\ln|\\sin u|$."],
        sec: [u => fn("ln", fn("abs", add(fn("sec", u), fn("tan", u)))), "$\\int \\sec u\\,du = \\ln|\\sec u + \\tan u|$."],
        csc: [u => neg(fn("ln", fn("abs", add(fn("csc", u), fn("cot", u))))), "$\\int \\csc u\\,du = -\\ln|\\csc u + \\cot u|$."],
        sinh: [u => fn("cosh", u), "$\\int \\sinh u\\,du = \\cosh u$."],
        cosh: [u => fn("sinh", u), "$\\int \\cosh u\\,du = \\sinh u$."],
        ln: [u => add(mul(u, fn("ln", u)), neg(u)), "$\\int \\ln u\\,du = u\\ln u - u$ (from integration by parts)."],
      }[e.n];
      if (T) return withLinear(e.a, T[0], T[1]);
    }
    if (e.t === "pow" && isNum(e.e, 2) && e.b.t === "fn" && (e.b.n === "sec" || e.b.n === "csc")) {
      return e.b.n === "sec"
        ? withLinear(e.b.a, u => fn("tan", u), "$\\int \\sec^2 u\\,du = \\tan u$.")
        : withLinear(e.b.a, u => neg(fn("cot", u)), "$\\int \\csc^2 u\\,du = -\\cot u$.");
    }
    if (e.t === "mul" && e.a.length === 2) {
      const [p, q] = e.a;
      const pair = (a, b) => [a, b].map(x => x.t === "fn" && x.n).sort().join(",");
      if (p.t === "fn" && q.t === "fn" && key(p.a) === key(q.a)) {
        if (pair(p, q) === "sec,tan") return withLinear(p.a, u => fn("sec", u), "$\\int \\sec u \\tan u\\,du = \\sec u$.");
        if (pair(p, q) === "cot,csc") return withLinear(p.a, u => neg(fn("csc", u)), "$\\int \\csc u \\cot u\\,du = -\\csc u$.");
        if (pair(p, q) === "cos,sin") return withLinear(p.a, u => mul(num(HALF), pow(fn("sin", u), num(2))), "Since $\\frac{d}{du}\\sin u = \\cos u$, $\\int \\sin u \\cos u\\,du = \\frac{1}{2}\\sin^2 u$.");
      }
    }
    // 1/(x^2 + k) and 1/sqrt(k - x^2)
    if (e.t === "pow" && e.b.t === "add" && isNum(e.e)) {
      const p = polyFrom(e.b, v);
      if (p && degree(p) === 2 && p[1].isZero()) {
        const a2 = p[2];
        const k = p[0];
        if (e.e.v.eq(-1) && a2.sign > 0 && k.sign > 0) {
          const s = simplify(pow(num(k.div(a2)), num(HALF)));
          const res = simplify(mul(pow(mul(num(a2), s), num(-1)), fn("atan", mul(X, pow(s, num(-1))))));
          return { res, text: `$\\int \\frac{du}{u^2 + a^2} = \\frac{1}{a}\\arctan\\frac{u}{a}$.` };
        }
        if (e.e.v.eq(new Frac(-1, 2)) && a2.sign < 0 && k.sign > 0) {
          const s = simplify(pow(num(k.div(a2.neg())), num(HALF)));
          const res = simplify(mul(pow(num(a2.neg()), num(new Frac(-1, 2))), fn("asin", mul(X, pow(s, num(-1))))));
          return { res, text: `$\\int \\frac{du}{\\sqrt{a^2 - u^2}} = \\arcsin\\frac{u}{a}$.` };
        }
      }
    }
    // asin, atan alone by parts formulas
    if (e.t === "fn" && e.n === "atan" && isSym(e.a, v)) {
      return { res: add(mul(X, fn("atan", X)), neg(mul(num(HALF), fn("ln", add(pow(X, num(2)), num(1)))))), text: "By parts: $\\int \\arctan x\\,dx = x\\arctan x - \\frac{1}{2}\\ln(1 + x^2)$." };
    }
    if (e.t === "fn" && e.n === "asin" && isSym(e.a, v)) {
      return { res: add(mul(X, fn("asin", X)), pow(add(num(1), neg(pow(X, num(2)))), num(HALF))), text: "By parts: $\\int \\arcsin x\\,dx = x\\arcsin x + \\sqrt{1 - x^2}$." };
    }
    return null;
  };

  // ---- rational functions ----
  const rationalIntegral = (e, d) => {
    const r = toRational(e, v);
    if (!r || degree(r.d) < 1) return null;
    let N = r.n;
    const Dn = r.d;
    // normalize so the denominator is monic-ish (keep as is) and check sizes
    if (degree(Dn) > 4) return null;
    const parts = [];
    if (degree(N) >= degree(Dn)) {
      const { q, r: rem } = polyDiv(N, Dn);
      const qE = polyToExpr(q, v);
      const remE = rem.every(c => c.isZero()) ? null : div(polyToExpr(rem, v), polyToExpr(Dn, v));
      steps.push(S("The top has degree at least the bottom's, so divide first (polynomial long division).", `\\frac{${tex(polyToExpr(N, v))}}{${tex(polyToExpr(Dn, v))}} = ${tex(remE ? add(qE, remE) : qE)}`));
      parts.push(qE);
      N = rem;
      if (!remE) {
        const res = I(qE, d + 1);
        return res;
      }
    }
    const Dd = degree(Dn);
    const lead = Dn[Dd];
    let pieces = null; // array of {expr integrand, res}
    if (Dd === 1) {
      const res = simplify(mul(num(N[0].div(lead)), fn("ln", fn("abs", polyToExpr(Dn, v)))));
      pieces = [{ text: `$\\int \\frac{k}{a${v} + b}\\,d${v} = \\frac{k}{a}\\ln|a${v} + b|$.`, integrand: div(polyToExpr(N, v), polyToExpr(Dn, v)), res }];
    } else {
      const { roots, rest } = rationalRoots(Dn);
      const simple = degree(rest) === 0 && roots.every(x => x.mult === 1);
      if (simple) {
        const dD = polyDeriv(Dn);
        const terms = roots.map(({ r }) => ({ r, A: polyEval(N, r).div(polyEval(dD, r)) }));
        const factored = roots.map(({ r }) => `\\left(${tex(polyToExpr([r.neg(), F(1)], v))}\\right)`).join("");
        const split = add(terms.map(({ r, A }) => div(num(A), polyToExpr([r.neg(), F(1)], v))));
        steps.push(
          S(
            `Factor the bottom${lead.isOne() ? "" : ` (pulling out $${ft(lead)}$)`} and split into partial fractions. Each numerator comes from covering up its factor and plugging in the root.`,
            `\\frac{${tex(polyToExpr(N, v))}}{${lead.isOne() ? "" : ft(lead)}${factored}} = ${tex(split)}`
          )
        );
        pieces = terms.map(({ r, A }) => {
          const den = polyToExpr([r.neg(), F(1)], v);
          return { text: `$\\int \\frac{A}{${v} - r}\\,d${v} = A\\ln|${v} - r|$.`, integrand: div(num(A), den), res: simplify(mul(num(A), fn("ln", fn("abs", den)))) };
        });
      } else if (Dd === 2) {
        const [c, b, a] = Dn;
        const disc = b.mul(b).sub(a.mul(c).mul(4));
        const p = N[1] ?? F(0);
        const q = N[0] ?? F(0);
        const DE = polyToExpr(Dn, v);
        if (disc.isZero()) {
          // a(x - h)^2
          const h = b.neg().div(a.mul(2));
          const u = polyToExpr([h.neg(), F(1)], v);
          const k = p.mul(h).add(q);
          steps.push(S(`The bottom is a perfect square, $${ft(a) === "1" ? "" : ft(a)}\\left(${tex(u)}\\right)^2$. Rewrite the top in terms of $${tex(u)}$.`, `\\frac{${tex(polyToExpr(N, v))}}{${tex(DE)}} = ${tex(add(div(num(p.div(a)), u), div(num(k.div(a)), pow(u, num(2)))))}`));
          const res = simplify(add(mul(num(p.div(a)), fn("ln", fn("abs", u))), neg(mul(num(k.div(a)), pow(u, num(-1))))));
          pieces = [{ text: "Integrate each piece: one gives a logarithm, the other a power.", integrand: div(polyToExpr(N, v), DE), res }];
        } else if (disc.sign < 0) {
          const k1 = p.div(a.mul(2));
          const q2 = q.sub(k1.mul(b));
          const h = b.div(a.mul(2));
          const K = a.mul(c).mul(4).sub(b.mul(b)).div(a.mul(a).mul(4));
          const sK = simplify(pow(num(K), num(HALF)));
          const shift = polyToExpr([h, F(1)], v);
          const lnPart = k1.isZero() ? null : mul(num(k1), fn("ln", DE));
          const atanPart = q2.isZero() ? null : mul(num(q2.div(a)), pow(sK, num(-1)), fn("atan", mul(shift, pow(sK, num(-1)))));
          if (!k1.isZero() && !q2.isZero())
            steps.push(S(`Write the top as a multiple of the bottom's derivative, $${tex(polyToExpr(polyDeriv(Dn), v))}$, plus a constant.`, `${tex(polyToExpr(N, v))} = ${k1.isOne() ? "" : ft(k1)}\\left(${tex(polyToExpr(polyDeriv(Dn), v))}\\right) ${q2.sign < 0 ? "-" : "+"} ${ft(q2.abs())}`));
          if (!q2.isZero() && !h.isZero()) steps.push(S("Complete the square in the bottom.", `${tex(DE)} = ${ft(a) === "1" ? "" : ft(a)}\\left[${tex(pow(shift, num(2)))} + ${ft(K)}\\right]`));
          const res = simplify(add([lnPart, atanPart].filter(Boolean)));
          const lnText = `The top is a multiple of the bottom's derivative, so it integrates to a logarithm: $\\int \\frac{f'}{f} = \\ln|f|$.`;
          const atanText = "Use $\\int \\frac{du}{u^2 + a^2} = \\frac{1}{a}\\arctan\\frac{u}{a}$.";
          pieces = [{ text: lnPart && atanPart ? `The derivative-of-the-bottom part gives a logarithm; the constant part uses $\\int \\frac{du}{u^2 + a^2} = \\frac{1}{a}\\arctan\\frac{u}{a}$.` : lnPart ? lnText : atanText, integrand: div(polyToExpr(N, v), DE), res }];
        }
      }
    }
    if (!pieces) return null;
    for (const pc of pieces) steps.push(S(pc.text, `${tex(INT(pc.integrand, v))} = ${tex(pc.res)}`));
    let total = add(pieces.map(p => p.res));
    if (parts.length) {
      const qr = I(parts[0], d + 1);
      if (!qr) return null;
      total = add(qr, total);
    }
    return simplify(total);
  };

  // ---- u-substitution ----
  const uSub = (e, d) => {
    const cands = [];
    const seen = new Set();
    const walk = n => {
      if (!depends(n, v)) return;
      const add_ = c => {
        if (!depends(c, v) || isSym(c, v)) return;
        const k = key(c);
        if (!seen.has(k)) {
          seen.add(k);
          cands.push(c);
        }
      };
      if (n.t === "fn") {
        add_(n.a);
        add_(n);
        walk(n.a);
      } else if (n.t === "pow") {
        add_(n.b);
        if (depends(n.e, v)) add_(n.e);
        walk(n.b);
        walk(n.e);
      } else if (n.t === "add" || n.t === "mul") n.a.forEach(walk);
    };
    walk(e);
    cands.sort((a, b) => size(b) - size(a));
    const U = sym("u");
    for (const u of cands) {
      if (key(u) === key(e)) continue;
      let du;
      try {
        du = derivative(u, v);
      } catch {
        continue;
      }
      if (isNum(du, 0)) continue;
      const ratio = simplify(div(e, du));
      const replaced = simplify(substitute(ratio, u, U));
      if (depends(replaced, v)) continue;
      const inner = [];
      const Fu = integrate(replaced, "u", inner, depth + d + 1);
      if (!Fu) continue;
      steps.push(S(`Substitute $u = ${tex(u)}$, so $du = ${paren(du)}\\,d${v}$.`, `${tex(INT(e, v))} = ${tex(INT(replaced, "u"))}`));
      steps.push(...inner.map(s => ({ ...s, sub: true })));
      const back = simplify(substitute(Fu, "u", u));
      steps.push(S(`Substitute back $u = ${tex(u)}$.`, tex(back)));
      return back;
    }
    return null;
  };

  // ---- integration by parts ----
  const byParts = (e, d) => {
    const factors = e.t === "mul" ? e.a : [e];
    const isTrans = f =>
      (f.t === "pow" && !depends(f.b, v) && linear(f.e)) || (f.t === "fn" && ["sin", "cos", "sinh", "cosh"].includes(f.n) && linear(f.a));
    const isLogLike = f => f.t === "fn" && ["ln", "atan", "asin"].includes(f.n) && linear(f.a);
    let u;
    let dv;
    const logIdx = factors.findIndex(isLogLike);
    if (logIdx >= 0) {
      u = factors[logIdx];
      const rest = factors.filter((_, i) => i !== logIdx);
      dv = rest.length ? (rest.length === 1 ? rest[0] : mul(rest)) : num(1);
      if (!polyFrom(dv, v) && !(dv.t === "pow" && isSym(dv.b, v))) return null;
    } else {
      const ti = factors.findIndex(isTrans);
      if (ti < 0) return null;
      const rest = factors.filter((_, i) => i !== ti);
      if (!rest.length) return null;
      const P = rest.length === 1 ? rest[0] : mul(rest);
      const pp = polyFrom(P, v);
      if (!pp || degree(pp) < 1) return null;
      u = P;
      dv = factors[ti];
    }
    const vq = integrate(dv, v, [], depth + 1);
    if (!vq) return null;
    const du = derivative(u, v);
    const V = tidy(vq);
    steps.push(
      S(
        `Integration by parts, $\\int u\\,dv = uv - \\int v\\,du$, with $u = ${tex(u)}$ and $dv = ${paren(dv)}\\,d${v}$.`,
        `du = ${paren(du)}\\,d${v}, \\qquad v = ${tex(V)}`
      )
    );
    const uv = simplify(mul(u, V));
    const rest = simplify(mul(V, du));
    steps.push(S("Apply the formula.", `${tex(INT(e, v))} = ${tex(uv)} - ${tex(INT(rest, v))}`));
    const R = I(rest, d + 1);
    if (!R) return null;
    return simplify(add(uv, neg(R)));
  };

  const res = I(e0, depth);
  return res ? tidy(res) : null;
}

const paren = e => (e.t === "add" ? `\\left(${tex(e)}\\right)` : tex(e));

// Numeric check that F' = f.
export function checkAntiderivative(Fx, f, v) {
  const Fn = compile(Fx);
  const fn_ = compile(f);
  let tested = 0;
  for (const x of [-2.7, -1.3, -0.6, 0.35, 0.8, 1.7, 2.9, 4.1, 0.15, -0.2]) {
    const y = fn_({ [v]: x });
    const h = 1e-5 * Math.max(1, Math.abs(x));
    const a = Fn({ [v]: x - h });
    const b = Fn({ [v]: x + h });
    if (![y, a, b].every(Number.isFinite) || Math.abs(y) > 1e6) continue;
    const dF = (b - a) / (2 * h);
    if (Math.abs(dF - y) > 1e-4 * Math.max(1, Math.abs(y))) return false;
    tested++;
  }
  return tested >= 2;
}

export function integralResult(f, v, lo = null, hi = null) {
  const definite = lo !== null;
  const problem = tex(INT(f, v, lo, hi));
  const steps = [];
  let Fx;
  try {
    Fx = integrate(f, v, steps);
  } catch {
    Fx = null;
  }
  if (Fx && !checkAntiderivative(Fx, f, v)) Fx = null;
  const graph = { v, fns: [{ e: f, label: `y = ${tex(f)}` }], points: [] };

  if (!definite) {
    if (!Fx)
      return result({
        topic: "Integral",
        problem,
        answers: [],
        graph,
        notes: ["I couldn't find an antiderivative in terms of standard functions. Many integrals (like $e^{-x^2}$) don't have one. Add limits, like “from 0 to 1”, and I'll compute the value numerically."],
      });
    const last = steps[steps.length - 1];
    if (!last || !last.tex?.endsWith(tex(Fx))) steps.push(S("Simplify and add the constant of integration.", `${problem} = ${tex(Fx)} + C`));
    else steps.push(S("Add the constant of integration, since any constant has derivative 0.", `${problem} = ${tex(Fx)} + C`));
    graph.fns.push({ e: Fx, label: `y = ${tex(Fx)}`, dashed: true });
    return result({
      topic: "Indefinite integral",
      problem,
      answers: [`${problem} = ${tex(Fx)} + C`],
      methods: [{ name: "Integrate", steps }],
      graph,
      notes: ["The dashed curve is the antiderivative (with $C = 0$). Its slope at each point equals the height of the original curve."],
    });
  }

  const a = evaluate(lo);
  const b = evaluate(hi);
  const fx = fn1(f, v);
  graph.shade = [{ lo: Math.min(a, b), hi: Math.max(a, b), under: true }];
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return result({ topic: "Definite integral", problem, answers: [], graph, notes: ["Integrals to infinity (improper integrals) aren't supported yet."] });
  }
  let bad = false;
  for (let i = 1; i < 400; i++) {
    const y = fx(a + ((b - a) * i) / 400);
    if (!Number.isFinite(y)) bad = true;
  }
  if (bad)
    return result({
      topic: "Definite integral",
      problem,
      answers: [],
      graph,
      notes: ["The function is undefined somewhere between the limits, so this is an improper integral. It may not have a finite value."],
    });

  const numeric = integrateNumeric(fx, a, b);
  if (!Fx) {
    const named = recognize(numeric);
    return result({
      topic: "Definite integral",
      problem,
      answers: [`${problem} ${named ? `= ${named.tex}` : `\\approx ${dec(numeric)}`}`],
      approx: named ? [`\\approx ${dec(numeric)}`] : [],
      graph,
      notes: ["There's no simple antiderivative, so the value was computed numerically (Simpson's rule). It's the signed area under the curve between the limits."],
    });
  }
  steps.push(S("Find the antiderivative, then evaluate it at the upper limit minus the lower limit.", `\\Big[${tex(Fx)}\\Big]_{${tex(lo)}}^{${tex(hi)}}`));
  const Fb = simplify(substitute(Fx, v, hi));
  const Fa = simplify(substitute(Fx, v, lo));
  let exact = simplify(add(Fb, neg(Fa)));
  const ev = evaluate(exact);
  const goodExact = Number.isFinite(ev) && Math.abs(ev - numeric) < 1e-6 * Math.max(1, Math.abs(numeric));
  if (!goodExact) exact = null;
  steps.push(
    S(
      "Plug in the limits and subtract.",
      exact ? `\\left(${tex(Fb)}\\right) - \\left(${tex(Fa)}\\right) = ${tex(exact)}` : `\\approx ${dec(numeric)}`
    )
  );
  return result({
    topic: "Definite integral",
    problem,
    answers: [`${problem} = ${exact ? tex(exact) : `\\approx ${dec(numeric)}`}`],
    approx: exact && exact.t !== "num" ? [`\\approx ${dec(numeric)}`] : exact && !exact.v.isInt() ? [`= ${dec(numeric)}`] : [],
    methods: [{ name: "Integrate", steps }],
    graph,
    notes: ["The value is the signed area between the curve and the x-axis: area above the axis counts positive, below counts negative."],
  });
}
