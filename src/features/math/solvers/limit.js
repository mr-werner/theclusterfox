// Limits: direct substitution, factor-and-cancel, L'Hôpital's rule,
// highest-power division at infinity, and a numeric estimate as a last resort.

import { add, depends, fn1, isNum, mul, neg, num, pow, substitute, sym } from "../engine/expr.js";
import { expand, simplify } from "../engine/simplify.js";
import { tex } from "../engine/tex.js";
import { degree, polyDiv, polyToExpr, rationalRoots } from "../engine/poly.js";
import { recognize } from "../engine/numeric.js";
import { derivative } from "./derivative.js";
import { toRational } from "./equation.js";
import { S, dec, ft, result } from "./common.js";
import { Frac } from "../engine/frac.js";

const LIM = (v, aTex, side) => `\\lim_{${v} \\to ${aTex}${side ? `^{${side}}` : ""}}`;

// Split into numerator and denominator factors.
function splitFraction(e) {
  const factors = e.t === "mul" ? e.a : [e];
  const top = [];
  const bot = [];
  for (const f of factors) {
    if (f.t === "pow" && isNum(f.e) && f.e.v.sign < 0) bot.push(f.e.v.eq(-1) ? f.b : pow(f.b, num(f.e.v.neg())));
    else top.push(f);
  }
  if (!bot.length) return null;
  const mk = l => (l.length === 0 ? num(1) : l.length === 1 ? l[0] : mul(l));
  return { n: mk(top), d: mk(bot) };
}

function numericLimit(f, a, side) {
  // returns { value, kind: "finite" | "inf" | "-inf" | "dne" }
  const probe = s => {
    const vals = [];
    for (let k = 3; k <= 9; k++) {
      const h = 10 ** -k;
      const x = a === Infinity ? 10 ** k : a === -Infinity ? -(10 ** k) : a + s * h;
      vals.push(f(x));
    }
    return vals;
  };
  const judge = vals => {
    const fin = vals.filter(Number.isFinite);
    if (fin.length < 3) return { kind: "dne" };
    const last = fin.slice(-3);
    if (last.every(x => x > 1e6) && last[2] > last[0]) return { kind: "inf" };
    if (last.every(x => x < -1e6) && last[2] < last[0]) return { kind: "-inf" };
    const spread = Math.abs(last[2] - last[1]);
    if (spread < 1e-4 * Math.max(1, Math.abs(last[2]))) return { kind: "finite", value: last[2] };
    return { kind: "dne" };
  };
  if (a === Infinity || a === -Infinity) return judge(probe(1));
  if (side === "+") return judge(probe(1));
  if (side === "-") return judge(probe(-1));
  const L = judge(probe(-1));
  const R = judge(probe(1));
  if (L.kind === R.kind && (L.kind !== "finite" || Math.abs(L.value - R.value) < 1e-4 * Math.max(1, Math.abs(L.value)))) return R;
  return { kind: "dne", left: L, right: R };
}

const kindTex = r => (r.kind === "inf" ? "\\infty" : r.kind === "-inf" ? "-\\infty" : r.kind === "finite" ? (recognize(r.value, 1e-6)?.tex ?? dec(r.value)) : "\\text{does not exist}");

export function limitResult(e, v, aExpr, side = null) {
  const aVal = aExpr === "inf" ? Infinity : aExpr === "-inf" ? -Infinity : null;
  const aTex = aExpr === "inf" ? "\\infty" : aExpr === "-inf" ? "-\\infty" : tex(aExpr);
  const problem = `${LIM(v, aTex, side)} ${e.t === "add" ? `\\left(${tex(e)}\\right)` : tex(e)}`;
  const steps = [];
  const f = fn1(e, v);
  const a = aVal ?? fn1(aExpr, v)(0);
  const graph = { v, fns: [{ e, label: `y = ${tex(e)}` }], points: [], focusX: Number.isFinite(a) ? a : null };
  const done = (ansTex, approx = [], notes = []) =>
    result({ topic: "Limit", problem, answers: [`${problem} = ${ansTex}`], approx, methods: steps.length ? [{ name: "Evaluate", steps }] : [], graph, notes });

  // ---------- finite point ----------
  if (Number.isFinite(a)) {
    const direct = simplify(substitute(e, v, aExpr));
    const dv = f(a);
    const nl = numericLimit(f, a, side);
    if (Number.isFinite(dv) && nl.kind === "finite" && Math.abs(nl.value - dv) < 1e-5 * Math.max(1, Math.abs(dv)) && !hasNaNNear(f, a)) {
      steps.push(S(`The function is continuous at $${v} = ${aTex}$, so just substitute.`, `${problem} = ${tex(direct)}`));
      graph.points.push({ x: a, y: dv, label: "limit" });
      return done(tex(direct), direct.t === "num" ? [] : [`\\approx ${dec(dv)}`]);
    }
    const fr = splitFraction(simplify(e));
    if (fr) {
      const nA = fn1(fr.n, v)(a);
      const dA = fn1(fr.d, v)(a);
      if (Math.abs(nA) < 1e-12 && Math.abs(dA) < 1e-12) {
        steps.push(S(`Substituting $${v} = ${aTex}$ gives $\\frac{0}{0}$, an indeterminate form. We need to do more work.`, null));
        // rational: factor and cancel
        const rn = toRational(fr.n, v);
        const rd = toRational(fr.d, v);
        if (rn && rd && degree(rn.d) === 0 && degree(rd.d) === 0) {
          const out = cancelRational(rn.n.map(c => c.div(rn.d[0])), rd.n.map(c => c.div(rd.d[0])), v, aExpr, aTex, problem, steps);
          if (out) {
            graph.points.push({ x: a, y: out.value, label: "limit", hollow: true });
            return done(out.tex, out.approx);
          }
        }
        const lh = lhopital(fr.n, fr.d, v, aExpr, a, aTex, problem, steps);
        if (lh) {
          if (lh.kind === "finite") graph.points.push({ x: a, y: lh.value, label: "limit", hollow: true });
          return done(lh.tex, lh.approx);
        }
      } else if (Math.abs(dA) < 1e-12 && Number.isFinite(nA) && nA !== 0) {
        steps.push(S(`Substituting gives $\\frac{${dec(nA)}}{0}$: a nonzero number over zero, so the function blows up. Check the sign on each side.`, null));
        const L = numericLimit(f, a, "-");
        const R = numericLimit(f, a, "+");
        const pick = side === "+" ? R : side === "-" ? L : L.kind === R.kind ? R : { kind: "dne" };
        steps.push(S(`From the left it goes to $${kindTex(L)}$; from the right to $${kindTex(R)}$.`, `${problem} = ${kindTex(pick)}`));
        graph.vlines = [a];
        return done(kindTex(pick), [], pick.kind === "dne" ? ["The one-sided limits disagree, so the two-sided limit doesn't exist."] : []);
      }
    }
    // numeric fallback
    if (nl.kind === "dne" && nl.left && nl.right) {
      steps.push(S(`The left-hand limit is $${kindTex(nl.left)}$ and the right-hand limit is $${kindTex(nl.right)}$. They differ.`, `${problem} \\;\\text{does not exist}`));
      return done("\\text{does not exist}", [], ["A two-sided limit exists only when both sides approach the same value."]);
    }
    return numericDone(nl);
  }

  // ---------- at infinity ----------
  const rat = toRational(e, v);
  if (rat && degree(rat.d) >= 0) {
    const N = rat.n;
    const D = rat.d;
    const dn = degree(N);
    const dd = degree(D);
    const sign = aVal > 0 ? 1 : -1;
    const k = Math.max(dd, 0);
    const xk = k === 0 ? num(1) : k === 1 ? sym(v) : pow(sym(v), num(k));
    if (dd >= 1)
      steps.push(
        S(
          `Divide the top and bottom by $${tex(xk)}$, the highest power in the denominator. Terms like $\\frac{c}{${v}^n}$ go to $0$ as $${v} \\to ${aTex}$.`,
          `${problem} = ${LIM(v, aTex)} \\frac{${tex(expand(mul(polyToExpr(N, v), pow(xk, num(-1)))))}}{${tex(expand(mul(polyToExpr(D, v), pow(xk, num(-1)))))}}`
        )
      );
    if (dn < dd) {
      steps.push(S("The top goes to $0$ while the bottom approaches a nonzero number.", `${problem} = 0`));
      return done("0");
    }
    if (dn === dd) {
      const val = N[dn].div(D[dd]);
      const ratio = `\\frac{${ft(N[dn])}}{${ft(D[dd])}}`;
      steps.push(S("Only the leading terms survive: the limit is the ratio of the leading coefficients.", `${problem} = ${ratio === ft(val) ? "" : `${ratio} = `}${ft(val)}`));
      graph.hlines = [val.valueOf()];
      return done(ft(val));
    }
    const lead = N[dn].div(D[dd]).valueOf();
    const s = Math.sign(lead) * (Math.abs(dn - dd) % 2 === 1 ? sign : 1);
    const ans = s > 0 ? "\\infty" : "-\\infty";
    steps.push(S(`The top has the higher power, so the expression grows without bound like $${tex(simplify(mul(num(N[dn].div(D[dd])), pow(sym(v), num(dn - dd)))))}$.`, `${problem} = ${ans}`));
    return done(ans);
  }
  const fr = splitFraction(simplify(e));
  if (fr) {
    const nl0 = numericLimit(fn1(fr.n, v), aVal);
    const dl0 = numericLimit(fn1(fr.d, v), aVal);
    if (["inf", "-inf"].includes(nl0.kind) && ["inf", "-inf"].includes(dl0.kind)) {
      steps.push(S(`Both top and bottom grow without bound: the form is $\\frac{\\infty}{\\infty}$.`, null));
      const lh = lhopital(fr.n, fr.d, v, aExpr, aVal, aTex, problem, steps);
      if (lh) return done(lh.tex, lh.approx);
    }
  }
  return numericDone(numericLimit(f, aVal));

  function numericDone(nl) {
    const t = kindTex(nl);
    const named = nl.kind === "finite" ? recognize(nl.value, 1e-6) : null;
    steps.push(S(`Evaluate the function at values closer and closer to $${aTex}$${side ? ` from the ${side === "+" ? "right" : "left"}` : ""}. The values settle on the limit.`, `${problem} ${nl.kind === "finite" && !named ? "\\approx" : "="} ${t}`));
    return done(t, named && !/^-?\d+$/.test(named.tex) ? [`\\approx ${dec(named.value)}`] : [], ["This limit was estimated numerically, so treat a tidy-looking answer as a very good guess rather than a proof."]);
  }
}

function hasNaNNear(f, a) {
  return [1e-3, -1e-3, 1e-6, -1e-6].some(h => !Number.isFinite(f(a + h)));
}

function cancelRational(N, D, v, aExpr, aTex, problem, steps) {
  const part = p => (degree(p) === 0 ? (p[0].isOne() ? "" : `\\cdot ${ft(p[0])}`) : `\\left(${tex(polyToExpr(p, v))}\\right)`);
  const { roots: rn } = rationalRoots(N);
  const { roots: rd } = rationalRoots(D);
  const aF = aExpr.t === "num" ? aExpr.v : null;
  if (!aF) return null;
  let n = N;
  let d = D;
  let k = Math.min(rn.find(x => x.r.eq(aF))?.mult ?? 0, rd.find(x => x.r.eq(aF))?.mult ?? 0);
  if (!k) return null;
  const factor = polyToExpr([aF.neg(), new Frac(1)], v);
  for (let i = 0; i < k; i++) {
    n = polyDiv(n, [aF.neg(), new Frac(1)]).q;
    d = polyDiv(d, [aF.neg(), new Frac(1)]).q;
  }
  steps.push(
    S(
      `Factor the top and bottom. Both contain $\\left(${tex(factor)}\\right)$${k > 1 ? `^${k}` : ""}, which is what makes them zero.`,
      `${problem} = ${LIM(v, aTex)} \\frac{\\left(${tex(factor)}\\right)${k > 1 ? `^${k}` : ""}${part(n)}}{\\left(${tex(factor)}\\right)${k > 1 ? `^${k}` : ""}${part(d)}}`
    )
  );
  const reduced = simplify(mul(polyToExpr(n, v), pow(polyToExpr(d, v), num(-1))));
  steps.push(S("Cancel the common factor. (It's allowed because the limit never actually reaches that point.)", `${problem} = ${LIM(v, aTex)} ${reduced.t === "add" ? `\\left(${tex(reduced)}\\right)` : tex(reduced)}`));
  const val = simplify(substitute(reduced, v, aExpr));
  if (val.t !== "num") return null;
  steps.push(S(`Now substitute $${v} = ${aTex}$.`, `${problem} = ${tex(val)}`));
  return { tex: tex(val), value: val.v.valueOf(), approx: val.v.isInt() ? [] : [`\\approx ${dec(val.v.valueOf())}`] };
}

function lhopital(n, d, v, aExpr, a, aTex, problem, steps) {
  let top = n;
  let bot = d;
  for (let i = 0; i < 4; i++) {
    let dt;
    let db;
    try {
      dt = derivative(top, v);
      db = derivative(bot, v);
    } catch {
      return null;
    }
    steps.push(
      S(
        `${i === 0 ? "Use L'Hôpital's rule: differentiate the top and the bottom separately." : "Still indeterminate, so apply L'Hôpital's rule again."}`,
        `${problem} = ${LIM(v, aTex)} \\frac{${tex(dt)}}{${tex(db)}}`
      )
    );
    const ft_ = fn1(dt, v);
    const fb = fn1(db, v);
    if (Number.isFinite(a)) {
      const t = ft_(a);
      const b = fb(a);
      if (Number.isFinite(t) && Number.isFinite(b) && Math.abs(b) > 1e-12) {
        const exact = simplify(mul(substitute(dt, v, aExpr), pow(substitute(db, v, aExpr), num(-1))));
        const val = t / b;
        const ok = Math.abs(fn1(exact, v)(0) - val) < 1e-9 * Math.max(1, Math.abs(val));
        const shown = ok ? tex(exact) : recognize(val)?.tex ?? dec(val);
        steps.push(S(`Now substitute $${v} = ${aTex}$.`, `${problem} = ${shown}`));
        return { kind: "finite", value: val, tex: shown, approx: ok && exact.t === "num" && exact.v.isInt() ? [] : [`\\approx ${dec(val)}`] };
      }
      if (!(Math.abs(t) < 1e-12 && Math.abs(b) < 1e-12)) return null;
    } else {
      const nl = numericLimit(x => ft_(x) / fb(x), a);
      const tl = numericLimit(ft_, a);
      const bl = numericLimit(fb, a);
      const indeterminate = ["inf", "-inf"].includes(tl.kind) && ["inf", "-inf"].includes(bl.kind);
      if (!indeterminate) {
        const t = kindTex(nl);
        steps.push(S("This is no longer indeterminate.", `${problem} = ${t}`));
        return { kind: nl.kind, value: nl.value, tex: t, approx: [] };
      }
    }
    top = dt;
    bot = db;
  }
  return null;
}

export { add, neg, depends };
